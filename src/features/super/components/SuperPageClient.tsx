"use client";

import { ChevronDown, PiggyBank, Plus, TrendingUp, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { NumInput } from "@/components/forms/NumInput";
import { SliderWithText } from "@/components/forms/SliderWithText";
import { FieldHint } from "@/components/ui/field-hint";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cents } from "@/lib/money/cents";
import { formatAUDCompact } from "@/lib/money/format";
import { usePrefs } from "@/lib/state/prefs-store";
import { cn } from "@/lib/utils";
import {
  useDeleteSuperPlan,
  useListSuperPlans,
  useSaveOneSuperPlan,
  useSaveSuperSettings,
  useSuperSettings,
} from "../hooks";
import { useProjectionWorker } from "../hooks/useProjectionWorker";
import type { SuperPlan, SuperSettings } from "../types";
import { DEFAULT_SUPER_PLAN, DEFAULT_SUPER_SETTINGS } from "../types";
import { CONCESSIONAL_CAP, DRAWDOWN_YEARS, NON_CONCESSIONAL_CAP } from "../utils/au-rules";
import { FUND_COLORS } from "../utils/project.worker-types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function pctToDisplay(v: number) {
  return (v * 100).toFixed(2);
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  longevityColour,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  longevityColour?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums leading-tight",
          accent
            ? "bg-gradient-accent bg-clip-text text-transparent"
            : longevityColour
              ? longevityColour
              : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── FundCard (accordion item) ───────────────────────────────────────────────

function FundCard({
  plan,
  color,
  isOpen,
  isActive,
  annualSalary,
  employerContributionPct,
  globalCurrentAge,
  globalRetirementAge,
  onToggle,
  onUpdate,
  onSetActive,
  onDelete,
}: {
  plan: SuperPlan;
  color: string;
  isOpen: boolean;
  isActive: boolean;
  annualSalary: Cents;
  employerContributionPct: number;
  globalCurrentAge: number;
  globalRetirementAge: number;
  onToggle: () => void;
  onUpdate: (patch: Partial<Omit<SuperPlan, "id" | "updatedAt">>) => void;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  const isIndependent = plan.ownerSalary !== undefined;
  const effectiveSalary = isIndependent ? plan.ownerSalary : annualSalary;
  const effectiveSgPct = isIndependent
    ? (plan.ownerEmployerPct ?? employerContributionPct)
    : employerContributionPct;
  const sgPerYear = Math.round((effectiveSalary ?? 0) * effectiveSgPct) as Cents;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 text-sm font-medium truncate">{plan.name}</span>
        {isIndependent && (
          <span className="shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
            {plan.ownerLabel ?? "Spouse"}
          </span>
        )}
        {!isIndependent && isActive && (
          <span className="shrink-0 rounded-full bg-income/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-income">
            Active
          </span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatAUDCompact(plan.currentBalance)}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-border/40 px-4 pb-4 pt-3">
          {/* Fund name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Fund name</span>
            <input
              type="text"
              key={plan.id + plan.name}
              defaultValue={plan.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== plan.name) onUpdate({ name: v });
              }}
              className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>

          <MoneyInput
            label="Current balance"
            value={plan.currentBalance}
            onChange={(v) => onUpdate({ currentBalance: v })}
          />

          {/* Employer SG note */}
          {isActive || isIndependent ? (
            <div className="rounded-lg bg-income/10 border border-income/30 px-3 py-2 text-xs text-income">
              Receiving employer SG: <strong>{formatAUDCompact(sgPerYear)}/yr</strong>
              <span className="text-muted-foreground ml-1">
                ({pctToDisplay(effectiveSgPct)}% of salary)
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No employer contributions — returns only
            </div>
          )}

          {/* Independent owner section */}
          <div className="border-t border-border/30 pt-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Owner
              </h4>
              <button
                type="button"
                onClick={() => {
                  if (isIndependent) {
                    onUpdate({
                      ownerSalary: undefined,
                      ownerLabel: undefined,
                      ownerCurrentAge: undefined,
                      ownerRetirementAge: undefined,
                      ownerEmployerPct: undefined,
                    });
                  } else {
                    onUpdate({ ownerSalary: 0 as Cents });
                  }
                }}
                className={cn(
                  "text-[11px] rounded-md border px-2 py-0.5 transition-colors",
                  isIndependent
                    ? "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {isIndependent ? "Remove owner override" : "Different owner (e.g. spouse)"}
              </button>
            </div>

            {isIndependent && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Owner label</span>
                  <input
                    type="text"
                    key={plan.id + (plan.ownerLabel ?? "")}
                    defaultValue={plan.ownerLabel ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      onUpdate({ ownerLabel: v || undefined });
                    }}
                    placeholder="e.g. Spouse"
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-ring"
                  />
                </label>
                <MoneyInput
                  label="Annual salary"
                  value={plan.ownerSalary ?? (0 as Cents)}
                  onChange={(v) => onUpdate({ ownerSalary: v })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumInput
                    label="Current age"
                    value={
                      Number.isFinite(plan.ownerCurrentAge)
                        ? (plan.ownerCurrentAge as number)
                        : globalCurrentAge
                    }
                    min={18}
                    max={74}
                    suffix="yrs"
                    onChange={(v) =>
                      onUpdate({
                        ownerCurrentAge: Math.min(
                          v,
                          (Number.isFinite(plan.ownerRetirementAge)
                            ? (plan.ownerRetirementAge as number)
                            : globalRetirementAge) - 1,
                        ),
                      })
                    }
                  />
                  <NumInput
                    label="Retirement age"
                    value={
                      Number.isFinite(plan.ownerRetirementAge)
                        ? (plan.ownerRetirementAge as number)
                        : globalRetirementAge
                    }
                    min={
                      (Number.isFinite(plan.ownerCurrentAge)
                        ? (plan.ownerCurrentAge as number)
                        : globalCurrentAge) + 1
                    }
                    max={80}
                    suffix="yrs"
                    onChange={(v) =>
                      onUpdate({
                        ownerRetirementAge: Math.max(
                          v,
                          (Number.isFinite(plan.ownerCurrentAge)
                            ? (plan.ownerCurrentAge as number)
                            : globalCurrentAge) + 1,
                        ),
                      })
                    }
                  />
                </div>
                <SliderWithText
                  label="Employer SG rate"
                  value={plan.ownerEmployerPct ?? employerContributionPct}
                  min={9}
                  max={15}
                  step={0.5}
                  onChange={(v) => onUpdate({ ownerEmployerPct: v })}
                  tooltip="The Superannuation Guarantee is the minimum % your employer must contribute. Currently 11.5% (FY2024–25), rising to 12% from 1 July 2025. Check your payslip or contract if your employer pays more."
                />
              </div>
            )}
          </div>

          <div className="border-t border-border/30 pt-2">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rates
            </h4>
            <div className="flex flex-col gap-3">
              <SliderWithText
                label="Expected return (p.a.)"
                value={plan.expectedReturnPct}
                min={2}
                max={14}
                step={0.25}
                onChange={(v) => onUpdate({ expectedReturnPct: v })}
                tooltip="Average annual investment return before fees. A diversified balanced fund has historically returned 6–8% p.a. Higher assumptions represent a more growth-oriented (higher risk) investment mix."
              />
              <SliderWithText
                label="Annual fees"
                value={plan.feesPct}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => onUpdate({ feesPct: v })}
                tooltip="Annual management fee as a % of balance. Fees compound — an extra 0.5% on $300k costs ~$1,500/yr and reduces your retirement balance by tens of thousands over 30 years. Check your fund's PDS."
              />
            </div>
          </div>

          <div className="border-t border-border/30 pt-2">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voluntary contributions
            </h4>
            <div className="flex flex-col gap-2">
              <MoneyInput
                label="Amount"
                value={plan.voluntaryContribution}
                onChange={(v) => onUpdate({ voluntaryContribution: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Frequency</span>
                  <select
                    value={plan.voluntaryFrequency}
                    onChange={(e) =>
                      onUpdate({
                        voluntaryFrequency: e.target.value as SuperPlan["voluntaryFrequency"],
                      })
                    }
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <FieldHint text="Concessional (pre-tax): taxed at 15% in the fund instead of your marginal rate — worthwhile if your rate exceeds 19%. Annual cap: $30,000 including employer SG. Non-concessional (after-tax): no extra tax, higher cap of $120,000/yr." />
                  </div>
                  <select
                    value={plan.voluntaryType}
                    onChange={(e) =>
                      onUpdate({
                        voluntaryType: e.target.value as SuperPlan["voluntaryType"],
                      })
                    }
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="concessional">Concessional</option>
                    <option value="non-concessional">Non-concessional</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {!isActive && !isIndependent && (
              <button
                type="button"
                onClick={onSetActive}
                className="text-xs text-primary hover:text-primary hover:underline"
              >
                Set as active fund
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-expense"
            >
              <X className="h-3 w-3" />
              Remove fund
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SuperPageClient() {
  const { data: settings, isPending: settingsPending } = useSuperSettings();
  const { data: plans = [], isPending: plansPending } = useListSuperPlans();
  const savePlanMutation = useSaveOneSuperPlan();
  const deletePlanMutation = useDeleteSuperPlan();
  const saveSettingsMutation = useSaveSuperSettings();

  const [openId, setOpenId] = useState<string | null>(null);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsSalary = usePrefs((s) => s.annualSalary);

  const isPending = settingsPending || plansPending;

  // ── Settings: live-preview patch ─────────────────────────────────────────
  // liveSettingsPatch holds in-flight changes so the worker re-runs immediately
  // on every slider move without waiting for the 600ms DB debounce.
  // pendingPatch is a ref (not state) so accumulating changes doesn't cause
  // extra renders — only the merged liveSettingsPatch state does.
  const [liveSettingsPatch, setLiveSettingsPatch] = useState<Partial<SuperSettings>>({});
  const pendingPatch = useRef<Partial<SuperSettings>>({});

  const updateSettings = useCallback(
    (patch: Partial<Omit<SuperSettings, "id" | "updatedAt">>) => {
      if (!settings) return;
      // Accumulate into pending (ref — no re-render)
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      // Trigger immediate worker re-run via state (one re-render)
      setLiveSettingsPatch({ ...pendingPatch.current });
      // Debounce the DB write
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => {
        const next = { ...settings, ...pendingPatch.current };
        saveSettingsMutation.mutate(next, {
          onSettled: () => {
            pendingPatch.current = {};
            setLiveSettingsPatch({});
          },
        });
      }, 600);
    },
    [settings, saveSettingsMutation],
  );

  function setActiveFund(planId: string) {
    if (!settings) return;
    saveSettingsMutation.mutate({ ...settings, activePlanId: planId });
  }

  // ── plan helpers ──────────────────────────────────────────────────────────

  function updatePlan(id: string, patch: Partial<Omit<SuperPlan, "id" | "updatedAt">>) {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    savePlanMutation.mutate({ ...plan, ...patch });
  }

  function addFund() {
    const isFirst = plans.length === 0;
    savePlanMutation.mutate(
      { ...DEFAULT_SUPER_PLAN, name: `Fund ${plans.length + 1}` },
      {
        onSuccess: (created) => {
          setOpenId(created.id);
          if (isFirst && settings) {
            saveSettingsMutation.mutate({ ...settings, activePlanId: created.id });
          }
        },
      },
    );
  }

  function deleteFund(id: string) {
    deletePlanMutation.mutate(id);
    if (openId === id) setOpenId(null);
    if (settings?.activePlanId === id) {
      const remaining = plans.filter((p) => p.id !== id);
      saveSettingsMutation.mutate({
        ...settings,
        activePlanId: remaining[0]?.id ?? null,
      });
    }
  }

  // ── Worker-based projections ──────────────────────────────────────────────

  const resolvedSettings = useMemo(
    () => settings ?? { ...DEFAULT_SUPER_SETTINGS, id: "primary", updatedAt: "" },
    [settings],
  );

  // Merge the live in-flight patch so the worker sees slider values immediately,
  // without waiting for the 600ms DB debounce + React Query refetch cycle.
  const effectiveSettings = useMemo(
    () =>
      Object.keys(liveSettingsPatch).length > 0
        ? { ...resolvedSettings, ...liveSettingsPatch }
        : resolvedSettings,
    [resolvedSettings, liveSettingsPatch],
  );

  // Stable input object for the worker — recreates when data or live patch changes.
  const superInput = useMemo(
    () =>
      isPending ? null : { plans, settings: effectiveSettings, prefsSalary: prefsSalary ?? 0 },
    [plans, effectiveSettings, prefsSalary, isPending],
  );

  const { result, isComputing } = useProjectionWorker(superInput);

  // Colour map for the fund list — computed on the main thread so FundCards
  // update instantly when a fund is added/removed without waiting for the worker.
  const planColors = useMemo(
    () => new Map(plans.map((p, i) => [p.id, FUND_COLORS[i % FUND_COLORS.length]])),
    [plans],
  );

  // Destructure worker output with safe fallbacks for the initial render
  const {
    fundProjections = [],
    chartSeries = [],
    totalNominal = 0 as Cents,
    totalReal = 0 as Cents,
    totalDrawdown = 0 as Cents,
    yearsToRetirement = 0,
    hasMultipleOwners = false,
    capBreaches = [],
    drawdownProjection = null,
    depletionAge = null,
    longevityColour = "text-income",
    topUpFortnightly = null,
    maxSustainableWithdrawal = 0,
  } = result ?? {};

  if (isPending || result === null) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-[580px]" />
          <Skeleton className="h-[580px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
          <PiggyBank className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Super Projector</h1>
          <p className="text-xs text-muted-foreground">
            Month-by-month growth across all your funds
          </p>
        </div>
        {(saveSettingsMutation.isPending || savePlanMutation.isPending || isComputing) && (
          <span className="ml-auto text-xs text-muted-foreground">
            {isComputing ? "Recalculating…" : "Saving…"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Left panel ── */}
        <div className="flex flex-col gap-0 rounded-xl border border-border/60 bg-surface/70 backdrop-blur-md overflow-hidden">
          {/* Primary settings */}
          <div className="flex flex-col gap-4 p-5 border-b border-border/40">
            <h2 className="text-sm font-semibold">Primary settings</h2>

            <div className="grid grid-cols-2 gap-3">
              <NumInput
                label="Current age"
                value={effectiveSettings.currentAge}
                min={18}
                max={74}
                suffix="yrs"
                onChange={(v: number) =>
                  updateSettings({ currentAge: Math.min(v, effectiveSettings.retirementAge - 1) })
                }
              />
              <NumInput
                label="Retirement age"
                value={effectiveSettings.retirementAge}
                min={effectiveSettings.currentAge + 1}
                max={80}
                suffix="yrs"
                onChange={(v: number) =>
                  updateSettings({ retirementAge: Math.max(v, effectiveSettings.currentAge + 1) })
                }
              />
            </div>

            <SliderWithText
              label="Employer SG rate"
              value={effectiveSettings.employerContributionPct}
              min={9}
              max={15}
              step={0.5}
              onChange={(v) => updateSettings({ employerContributionPct: v })}
              tooltip="The Superannuation Guarantee is the minimum % your employer must contribute. Currently 11.5% (FY2024–25), rising to 12% from 1 July 2025. Check your payslip or contract if your employer pays more."
            />

            <SliderWithText
              label="Inflation (p.a.)"
              value={effectiveSettings.inflationPct}
              min={0}
              max={8}
              step={0.25}
              onChange={(v) => updateSettings({ inflationPct: v })}
              tooltip="Used to convert projected balances into today's purchasing power. The 'real' balance shown is what your projected super would be worth in today's dollars. RBA targets 2–3%; the long-run AU average is ~2.5%."
            />

            <div className="flex flex-col gap-1">
              <MoneyInput
                label="Monthly income target (today's $)"
                value={effectiveSettings.monthlyDrawdownTarget ?? (0 as Cents)}
                onChange={(v) => updateSettings({ monthlyDrawdownTarget: v > 0 ? v : undefined })}
                hint="How much you want per month in retirement"
              />
              {maxSustainableWithdrawal > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({ monthlyDrawdownTarget: maxSustainableWithdrawal as Cents })
                  }
                  className="self-start text-[11px] text-primary hover:underline tabular-nums"
                >
                  Maximise to age 100 → {formatAUDCompact(maxSustainableWithdrawal as Cents)}/mo
                </button>
              )}
            </div>
          </div>

          {/* Fund list */}
          <div className="flex flex-col gap-0 p-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Funds
            </h3>

            {plans.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No funds yet. Add your first to start projecting.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {plans.map((plan) => (
                <FundCard
                  key={plan.id}
                  plan={plan}
                  color={planColors.get(plan.id) ?? FUND_COLORS[0]}
                  isOpen={openId === plan.id}
                  isActive={resolvedSettings.activePlanId === plan.id}
                  annualSalary={(prefsSalary ?? 0) as Cents}
                  employerContributionPct={effectiveSettings.employerContributionPct}
                  globalCurrentAge={effectiveSettings.currentAge}
                  globalRetirementAge={effectiveSettings.retirementAge}
                  onToggle={() => setOpenId(openId === plan.id ? null : plan.id)}
                  onUpdate={(patch) => updatePlan(plan.id, patch)}
                  onSetActive={() => setActiveFund(plan.id)}
                  onDelete={() => deleteFund(plan.id)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addFund}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add fund
            </button>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-4">
          {plans.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-surface/70 p-12 text-center backdrop-blur-md">
              <PiggyBank className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No super funds yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your first fund to see projections
              </p>
              <button
                type="button"
                onClick={addFund}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary/20 px-4 py-2 text-sm text-primary hover:bg-primary/30 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add fund
              </button>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  label="At retirement (nominal)"
                  value={formatAUDCompact(totalNominal)}
                  sub={
                    hasMultipleOwners
                      ? "Combined across all funds"
                      : `In ${yearsToRetirement} years`
                  }
                  accent
                />
                <KpiCard
                  label="At retirement (real)"
                  value={formatAUDCompact(totalReal)}
                  sub="Today's dollars"
                />
                <KpiCard
                  label="Monthly income"
                  value={
                    drawdownProjection
                      ? formatAUDCompact(drawdownProjection.monthlyWithdrawal)
                      : formatAUDCompact(totalDrawdown)
                  }
                  sub={
                    drawdownProjection
                      ? "Nominal at retirement"
                      : `${DRAWDOWN_YEARS}yr estimate (real)`
                  }
                />
                {/* Longevity — funds last to age X */}
                <KpiCard
                  label="Funds last to age"
                  value={depletionAge === null ? "100+" : String(depletionAge)}
                  sub={
                    depletionAge === null
                      ? "Sustainable ✓"
                      : depletionAge < 90
                        ? "Consider increasing contributions"
                        : "Good longevity"
                  }
                  longevityColour={longevityColour}
                />
              </div>

              {/* Top-up needed */}
              {topUpFortnightly !== null && (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                    topUpFortnightly === 0
                      ? "border-income/30 bg-income/10"
                      : "border-warning/30 bg-warning/10",
                  )}
                >
                  <div className="flex-1">
                    {topUpFortnightly === 0 ? (
                      <span className="font-medium text-income">
                        On track ✓ — your balance covers your target income
                      </span>
                    ) : (
                      <span className="font-medium text-warning">
                        Add{" "}
                        <strong className="tabular-nums">
                          {formatAUDCompact(topUpFortnightly)}/fn
                        </strong>{" "}
                        more to reach your income target
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Cap warnings */}
              {capBreaches.length > 0 && (
                <div className="flex flex-col gap-2">
                  {capBreaches.map((fp) => (
                    <div
                      key={fp.plan.id}
                      className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
                    >
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: fp.color }}
                      />
                      <div>
                        <span className="font-medium text-warning">{fp.plan.name}</span>
                        {fp.projection.concessionalCapBreached && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Concessional cap exceeded:{" "}
                            <strong>
                              {formatAUDCompact(fp.projection.annualConcessionalContrib)}/yr
                            </strong>{" "}
                            &gt; ${(CONCESSIONAL_CAP / 100).toLocaleString("en-AU")} cap
                          </p>
                        )}
                        {fp.projection.nonConcessionalCapBreached && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Non-concessional cap exceeded:{" "}
                            <strong>
                              {formatAUDCompact(fp.projection.annualNonConcessionalContrib)}/yr
                            </strong>{" "}
                            &gt; ${(NON_CONCESSIONAL_CAP / 100).toLocaleString("en-AU")} cap
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Accumulation chart */}
              <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Balance projection (accumulation)</span>
                  <span className="ml-auto text-xs text-muted-foreground">Year →</span>
                </div>
                <AreaChart series={chartSeries} height={260} stacked />
              </div>

              {/* Drawdown chart */}
              {drawdownProjection && drawdownProjection.drawdownYears.length > 1 && (
                <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Retirement drawdown</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {depletionAge === null
                        ? "Funds last beyond age 100"
                        : `Funds depleted at age ${depletionAge}`}
                    </span>
                  </div>
                  <AreaChart
                    series={[
                      {
                        name: "Portfolio balance",
                        data: drawdownProjection.drawdownYears.map((y) => ({
                          x: String(y.age),
                          y: y.balance as number,
                        })),
                        color:
                          depletionAge !== null && depletionAge < 90
                            ? "hsl(0 72% 60%)"
                            : depletionAge !== null
                              ? "hsl(38 92% 55%)"
                              : "hsl(152 65% 50%)",
                      },
                    ]}
                    height={220}
                  />
                </div>
              )}

              {/* Per-fund contribution summary */}
              <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                <h3 className="mb-3 text-sm font-medium">Annual contribution summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Fund</th>
                        <th className="pb-2 pr-4 text-right">Employer SG</th>
                        <th className="pb-2 pr-4 text-right">Voluntary</th>
                        <th className="pb-2 pr-4 text-right">Concessional</th>
                        <th className="pb-2 text-right">Non-concessional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {fundProjections.map((fp) => {
                        const isIndep = fp.plan.ownerSalary !== undefined;
                        const isPrim = !isIndep && resolvedSettings.activePlanId === fp.plan.id;
                        const salaryForTable = isIndep
                          ? (fp.plan.ownerSalary ?? 0)
                          : isPrim
                            ? (prefsSalary ?? 0)
                            : 0;
                        const sgPctForTable = isIndep
                          ? (fp.plan.ownerEmployerPct ?? effectiveSettings.employerContributionPct)
                          : isPrim
                            ? effectiveSettings.employerContributionPct
                            : 0;
                        const employerAnnual = Math.round(salaryForTable * sgPctForTable) as Cents;
                        const voluntaryAnnual = (fp.projection.annualConcessionalContrib +
                          fp.projection.annualNonConcessionalContrib -
                          employerAnnual) as Cents;
                        return (
                          <tr key={fp.plan.id} className="hover:bg-muted/10">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: fp.color }}
                                />
                                {fp.plan.name}
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {employerAnnual > 0 ? `${formatAUDCompact(employerAnnual)}/yr` : "—"}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                              {voluntaryAnnual > 0
                                ? `${formatAUDCompact(voluntaryAnnual)}/yr`
                                : "—"}
                            </td>
                            <td
                              className={cn(
                                "py-2 pr-4 text-right tabular-nums",
                                fp.projection.concessionalCapBreached && "text-warning",
                              )}
                            >
                              {formatAUDCompact(fp.projection.annualConcessionalContrib)}/yr
                            </td>
                            <td
                              className={cn(
                                "py-2 text-right tabular-nums",
                                fp.projection.nonConcessionalCapBreached && "text-warning",
                              )}
                            >
                              {fp.projection.annualNonConcessionalContrib > 0
                                ? `${formatAUDCompact(fp.projection.annualNonConcessionalContrib)}/yr`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
