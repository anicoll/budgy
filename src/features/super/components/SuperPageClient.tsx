"use client";

import { ChevronDown, PiggyBank, Plus, TrendingUp, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
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
import type { SuperPlan, SuperSettings } from "../types";
import { DEFAULT_SUPER_PLAN, DEFAULT_SUPER_SETTINGS } from "../types";
import { CONCESSIONAL_CAP, DRAWDOWN_YEARS, NON_CONCESSIONAL_CAP } from "../utils/au-rules";
import { projectSuper } from "../utils/project";

// ─── constants ────────────────────────────────────────────────────────────────

const FUND_COLORS = [
  "hsl(262 83% 65%)",
  "hsl(190 95% 55%)",
  "hsl(152 65% 50%)",
  "hsl(38 92% 55%)",
  "hsl(330 80% 65%)",
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function pctToDisplay(v: number) {
  return (v * 100).toFixed(2);
}

function centsToDisplay(c: Cents): string {
  return String(Math.round(c / 100));
}

function displayToCents(s: string): Cents {
  const n = Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  return (Number.isFinite(n) ? Math.max(0, n) : 0) as Cents;
}

// ─── shared input atoms ───────────────────────────────────────────────────────

function MoneyInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: Cents;
  onChange: (v: Cents) => void;
  hint?: string;
}) {
  // Uncontrolled input — key={value} resets the field when the stored value changes externally
  const localRef = useRef<HTMLInputElement>(null);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-violet-500/70">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          ref={localRef}
          type="text"
          inputMode="numeric"
          key={value}
          defaultValue={centsToDisplay(value)}
          onBlur={() => onChange(displayToCents(localRef.current?.value ?? ""))}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SliderWithText({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(pctToDisplay(value));
  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    setText(pctToDisplay(value));
  }

  function commitText(raw: string) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= min && n <= max) {
      onChange(Math.round(n * 1000) / 100000);
    } else {
      setText(pctToDisplay(value));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitText(text)}
            className="w-14 rounded border border-border/60 bg-surface px-1.5 py-0.5 text-right text-xs tabular-nums focus:border-violet-500/70 focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value * 100))}
        onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
        className="super-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border"
      />
    </div>
  );
}

function AgeInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-violet-500/70">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
        <span className="text-xs text-muted-foreground">yrs</span>
      </div>
    </label>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums leading-tight",
          accent ? "bg-gradient-accent bg-clip-text text-transparent" : "text-foreground",
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
  settings,
  onToggle,
  onUpdate,
  onSetActive,
  onDelete,
}: {
  plan: SuperPlan;
  color: string;
  isOpen: boolean;
  isActive: boolean;
  settings: SuperSettings;
  onToggle: () => void;
  onUpdate: (patch: Partial<Omit<SuperPlan, "id" | "updatedAt">>) => void;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  const sgPerYear = Math.round(settings.annualSalary * settings.employerContributionPct) as Cents;

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
        {isActive && (
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
              className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
            />
          </label>

          <MoneyInput
            label="Current balance"
            value={plan.currentBalance}
            onChange={(v) => onUpdate({ currentBalance: v })}
          />

          {/* Employer SG note */}
          {isActive ? (
            <div className="rounded-lg bg-income/10 border border-income/30 px-3 py-2 text-xs text-income">
              Receiving employer SG: <strong>{formatAUDCompact(sgPerYear)}/yr</strong>
              <span className="text-muted-foreground ml-1">
                ({pctToDisplay(settings.employerContributionPct)}% of salary)
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No employer contributions — returns only
            </div>
          )}

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
              />
              <SliderWithText
                label="Annual fees"
                value={plan.feesPct}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => onUpdate({ feesPct: v })}
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
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <select
                    value={plan.voluntaryType}
                    onChange={(e) =>
                      onUpdate({
                        voluntaryType: e.target.value as SuperPlan["voluntaryType"],
                      })
                    }
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
                  >
                    <option value="concessional">Concessional</option>
                    <option value="non-concessional">Non-concessional</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {!isActive && (
              <button
                type="button"
                onClick={onSetActive}
                className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
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
  const [salaryBannerDismissed, setSalaryBannerDismissed] = useState(false);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsSalary = usePrefs((s) => s.annualSalary);

  const isPending = settingsPending || plansPending;

  // Show a banner if prefs.annualSalary is set but super settings still has the default ($100K)
  const showSalaryBanner =
    !salaryBannerDismissed &&
    !!settings &&
    !!prefsSalary &&
    prefsSalary > 0 &&
    settings.annualSalary === DEFAULT_SUPER_SETTINGS.annualSalary &&
    prefsSalary !== settings.annualSalary;

  // ── settings helpers ──────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<Omit<SuperSettings, "id" | "updatedAt">>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => saveSettingsMutation.mutate(next), 600);
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

  // ── projections ───────────────────────────────────────────────────────────

  const resolvedSettings = settings ?? { ...DEFAULT_SUPER_SETTINGS, id: "primary", updatedAt: "" };

  const fundProjections = useMemo(() => {
    return plans.map((plan, i) => ({
      plan,
      projection: projectSuper({
        currentBalance: plan.currentBalance,
        annualSalary:
          plan.id === resolvedSettings.activePlanId ? resolvedSettings.annualSalary : (0 as Cents),
        employerContributionPct:
          plan.id === resolvedSettings.activePlanId ? resolvedSettings.employerContributionPct : 0,
        voluntaryContribution: plan.voluntaryContribution,
        voluntaryFrequency: plan.voluntaryFrequency,
        voluntaryType: plan.voluntaryType,
        expectedReturnPct: plan.expectedReturnPct,
        feesPct: plan.feesPct,
        inflationPct: resolvedSettings.inflationPct,
        currentAge: resolvedSettings.currentAge,
        retirementAge: resolvedSettings.retirementAge,
      }),
      color: FUND_COLORS[i % FUND_COLORS.length],
    }));
  }, [plans, resolvedSettings]);

  // Stacked area — each fund is a coloured band; the stack top = total. No explicit Total series needed.
  const chartSeries = useMemo(
    () =>
      fundProjections.map((fp) => ({
        name: fp.plan.name,
        data: fp.projection.years.map((y) => ({ x: String(y.age), y: y.nominal as number })),
        color: fp.color,
      })),
    [fundProjections],
  );

  const totalNominal = fundProjections.reduce(
    (s, fp) => (s + fp.projection.retirementNominal) as Cents,
    0 as Cents,
  );
  const totalReal = fundProjections.reduce(
    (s, fp) => (s + fp.projection.retirementReal) as Cents,
    0 as Cents,
  );
  const totalDrawdown = fundProjections.reduce(
    (s, fp) => (s + fp.projection.monthlyDrawdown) as Cents,
    0 as Cents,
  );
  const yearsToRetirement = Math.max(
    0,
    resolvedSettings.retirementAge - resolvedSettings.currentAge,
  );

  const capBreaches = fundProjections.filter(
    (fp) => fp.projection.concessionalCapBreached || fp.projection.nonConcessionalCapBreached,
  );

  if (isPending) {
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
          <PiggyBank className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Super Projector</h1>
          <p className="text-xs text-muted-foreground">
            Month-by-month growth across all your funds
          </p>
        </div>
        {(saveSettingsMutation.isPending || savePlanMutation.isPending) && (
          <span className="ml-auto text-xs text-muted-foreground">Saving…</span>
        )}
      </div>

      {/* Salary sync banner */}
      {showSalaryBanner && prefsSalary && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm">
          <span className="text-lg">💡</span>
          <span className="flex-1 text-muted-foreground">
            Your saved salary is{" "}
            <strong className="text-foreground">{formatAUDCompact(prefsSalary)}/yr</strong>. Use it
            in the super projector?
          </span>
          <button
            type="button"
            onClick={() => {
              if (settings) saveSettingsMutation.mutate({ ...settings, annualSalary: prefsSalary });
              setSalaryBannerDismissed(true);
            }}
            className="shrink-0 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/30"
          >
            Yes, update
          </button>
          <button
            type="button"
            onClick={() => setSalaryBannerDismissed(true)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Left panel ── */}
        <div className="flex flex-col gap-0 rounded-xl border border-border/60 bg-surface/70 backdrop-blur-md overflow-hidden">
          {/* Global settings */}
          <div className="flex flex-col gap-4 p-5 border-b border-border/40">
            <h2 className="text-sm font-semibold">Global settings</h2>

            <div className="grid grid-cols-2 gap-3">
              <AgeInput
                label="Current age"
                value={resolvedSettings.currentAge}
                min={18}
                max={74}
                onChange={(v) =>
                  updateSettings({ currentAge: Math.min(v, resolvedSettings.retirementAge - 1) })
                }
              />
              <AgeInput
                label="Retirement age"
                value={resolvedSettings.retirementAge}
                min={resolvedSettings.currentAge + 1}
                max={80}
                onChange={(v) =>
                  updateSettings({ retirementAge: Math.max(v, resolvedSettings.currentAge + 1) })
                }
              />
            </div>

            <MoneyInput
              label="Annual salary (gross)"
              value={resolvedSettings.annualSalary}
              onChange={(v) => updateSettings({ annualSalary: v })}
              hint="Applied to your active fund"
            />

            <SliderWithText
              label="Employer SG rate"
              value={resolvedSettings.employerContributionPct}
              min={9}
              max={15}
              step={0.5}
              onChange={(v) => updateSettings({ employerContributionPct: v })}
            />

            <SliderWithText
              label="Inflation (p.a.)"
              value={resolvedSettings.inflationPct}
              min={0}
              max={8}
              step={0.25}
              onChange={(v) => updateSettings({ inflationPct: v })}
            />
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
              {fundProjections.map((fp) => (
                <FundCard
                  key={fp.plan.id}
                  plan={fp.plan}
                  color={fp.color}
                  isOpen={openId === fp.plan.id}
                  isActive={resolvedSettings.activePlanId === fp.plan.id}
                  settings={resolvedSettings}
                  onToggle={() => setOpenId(openId === fp.plan.id ? null : fp.plan.id)}
                  onUpdate={(patch) => updatePlan(fp.plan.id, patch)}
                  onSetActive={() => setActiveFund(fp.plan.id)}
                  onDelete={() => deleteFund(fp.plan.id)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addFund}
              className="mt-3 flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
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
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/30 transition-colors"
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
                  sub={`In ${yearsToRetirement} years`}
                  accent
                />
                <KpiCard
                  label="At retirement (real)"
                  value={formatAUDCompact(totalReal)}
                  sub="Today's dollars"
                />
                <KpiCard
                  label="Monthly income"
                  value={formatAUDCompact(totalDrawdown)}
                  sub={`${DRAWDOWN_YEARS}yr drawdown (real)`}
                />
                <KpiCard
                  label="Years to retirement"
                  value={String(yearsToRetirement)}
                  sub={`Age ${resolvedSettings.currentAge} → ${resolvedSettings.retirementAge}`}
                />
              </div>

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

              {/* Combined chart */}
              <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium">Balance projection</span>
                  <span className="ml-auto text-xs text-muted-foreground">Age →</span>
                </div>
                <AreaChart series={chartSeries} height={280} stacked />
              </div>

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
                        const employerAnnual =
                          resolvedSettings.activePlanId === fp.plan.id
                            ? (Math.round(
                                resolvedSettings.annualSalary *
                                  resolvedSettings.employerContributionPct,
                              ) as Cents)
                            : (0 as Cents);
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
