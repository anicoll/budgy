"use client";

import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import { AlertTriangle, PiggyBank, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { baseApexOptions, getChartTheme } from "@/components/charts/chart-theme";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cents } from "@/lib/money/cents";
import { formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import { useSaveSuperPlan, useSuperPlan } from "../hooks";
import type { SuperPlan, VoluntaryFrequency, VoluntaryType } from "../types";
import { DEFAULT_SUPER_PLAN } from "../types";
import { DRAWDOWN_YEARS } from "../utils/au-rules";
import { projectSuper } from "../utils/project";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── helpers ───────────────────────────────────────────────────────────────

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

// ─── slider ────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  suffix = "%",
  onChange,
}: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="tabular-nums text-xs font-medium">
          {display}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="super-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-violet-500"
      />
    </div>
  );
}

// ─── money input ────────────────────────────────────────────────────────────

interface MoneyInputProps {
  label: string;
  value: Cents;
  onChange: (v: Cents) => void;
  hint?: string;
}

function MoneyInput({ label, value, onChange, hint }: MoneyInputProps) {
  const [raw, setRaw] = useState(centsToDisplay(value));

  useEffect(() => {
    setRaw(centsToDisplay(value));
  }, [value]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-violet-500/70">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => onChange(displayToCents(raw))}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

// ─── age input ───────────────────────────────────────────────────────────────

interface AgeInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function AgeInput({ label, value, min, max, onChange }: AgeInputProps) {
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

// ─── KPI card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

function KpiCard({ label, value, sub, accent }: KpiCardProps) {
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

// ─── chart ───────────────────────────────────────────────────────────────────

interface ProjectionChartProps {
  nominal: { age: number; value: Cents }[];
  real: { age: number; value: Cents }[];
}

function ProjectionChart({ nominal, real }: ProjectionChartProps) {
  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "area" },
      stroke: { curve: "smooth", width: 2 },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.6,
          opacityFrom: 0.35,
          opacityTo: 0.02,
          stops: [0, 90, 100],
        },
      },
      colors: [theme.accentFrom, theme.accentTo],
      xaxis: {
        ...base.xaxis,
        title: { text: "Age", style: { color: theme.muted, fontSize: "11px" } },
      },
      yaxis: {
        ...base.yaxis,
        labels: {
          style: { colors: theme.muted },
          formatter: (v: number) =>
            new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              notation: "compact",
              maximumFractionDigits: 0,
            }).format(v),
        },
      },
      tooltip: {
        ...base.tooltip,
        y: {
          formatter: (v: number) =>
            new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v),
        },
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "right",
        labels: { colors: theme.muted },
      },
    };
  }, []);

  const series = useMemo<ApexAxisChartSeries>(
    () => [
      {
        name: "Nominal",
        data: nominal.map((p) => ({ x: String(p.age), y: Math.round(p.value / 100) })),
      },
      {
        name: "Real (today's $)",
        data: real.map((p) => ({ x: String(p.age), y: Math.round(p.value / 100) })),
      },
    ],
    [nominal, real],
  );

  if (nominal.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Set retirement age greater than current age to see projection
      </div>
    );
  }

  return <ReactApexChart type="area" options={options} series={series} height={280} />;
}

// ─── main component ───────────────────────────────────────────────────────────

type FormState = Omit<SuperPlan, "id" | "updatedAt">;

function planToForm(plan: SuperPlan): FormState {
  const { id: _id, updatedAt: _u, ...rest } = plan;
  return rest;
}

export function SuperPageClient() {
  const { data: saved, isPending } = useSuperPlan();
  const saveMutation = useSaveSuperPlan();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormState>(DEFAULT_SUPER_PLAN);
  const initialised = useRef(false);

  useEffect(() => {
    if (!isPending && !initialised.current) {
      initialised.current = true;
      if (saved) setForm(planToForm(saved));
    }
  }, [saved, isPending]);

  const scheduleSave = useCallback(
    (next: FormState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveMutation.mutate(next), 600);
    },
    [saveMutation],
  );

  function update(patch: Partial<FormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    scheduleSave(next);
  }

  const projection = useMemo(() => projectSuper(form), [form]);

  const yearsToRetirement = Math.max(0, form.retirementAge - form.currentAge);

  if (isPending) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
          <PiggyBank className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Super Projector</h1>
          <p className="text-xs text-muted-foreground">
            Month-by-month growth to retirement using AU SG rules
          </p>
        </div>
        {saveMutation.isPending && (
          <span className="ml-auto text-xs text-muted-foreground">Saving…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Inputs panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface/70 p-5 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-foreground">Assumptions</h2>

          <MoneyInput
            label="Current super balance"
            value={form.currentBalance}
            onChange={(v) => update({ currentBalance: v })}
          />
          <MoneyInput
            label="Annual salary (gross)"
            value={form.annualSalary}
            onChange={(v) => update({ annualSalary: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <AgeInput
              label="Current age"
              value={form.currentAge}
              min={18}
              max={74}
              onChange={(v) => update({ currentAge: Math.min(v, form.retirementAge - 1) })}
            />
            <AgeInput
              label="Retirement age"
              value={form.retirementAge}
              min={form.currentAge + 1}
              max={80}
              onChange={(v) => update({ retirementAge: Math.max(v, form.currentAge + 1) })}
            />
          </div>

          <div className="border-t border-border/40 pt-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rates
            </h3>
            <div className="flex flex-col gap-4">
              <SliderRow
                label="Employer SG rate"
                value={form.employerContributionPct * 100}
                min={9}
                max={15}
                step={0.5}
                display={pctToDisplay(form.employerContributionPct)}
                onChange={(v) => update({ employerContributionPct: v / 100 })}
              />
              <SliderRow
                label="Expected return (p.a.)"
                value={form.expectedReturnPct * 100}
                min={2}
                max={14}
                step={0.25}
                display={pctToDisplay(form.expectedReturnPct)}
                onChange={(v) => update({ expectedReturnPct: v / 100 })}
              />
              <SliderRow
                label="Inflation (p.a.)"
                value={form.inflationPct * 100}
                min={0}
                max={8}
                step={0.25}
                display={pctToDisplay(form.inflationPct)}
                onChange={(v) => update({ inflationPct: v / 100 })}
              />
              <SliderRow
                label="Annual fees"
                value={form.feesPct * 100}
                min={0}
                max={3}
                step={0.05}
                display={pctToDisplay(form.feesPct)}
                onChange={(v) => update({ feesPct: v / 100 })}
              />
            </div>
          </div>

          <div className="border-t border-border/40 pt-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voluntary contributions
            </h3>
            <div className="flex flex-col gap-3">
              <MoneyInput
                label="Amount"
                value={form.voluntaryContribution}
                onChange={(v) => update({ voluntaryContribution: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Frequency</span>
                  <select
                    value={form.voluntaryFrequency}
                    onChange={(e) =>
                      update({ voluntaryFrequency: e.target.value as VoluntaryFrequency })
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
                    value={form.voluntaryType}
                    onChange={(e) => update({ voluntaryType: e.target.value as VoluntaryType })}
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
                  >
                    <option value="concessional">Concessional</option>
                    <option value="non-concessional">Non-concessional</option>
                  </select>
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Concessional = pre-tax / salary sacrifice (counts toward $30k cap). Non-concessional
                = after-tax (cap $120k/yr).
              </p>
            </div>
          </div>
        </div>

        {/* ── Right panel: KPIs + chart + warnings ─────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="At retirement (nominal)"
              value={formatAUDCompact(projection.retirementNominal)}
              sub={`In ${yearsToRetirement} years`}
              accent
            />
            <KpiCard
              label="At retirement (real)"
              value={formatAUDCompact(projection.retirementReal)}
              sub="Today's dollars"
            />
            <KpiCard
              label={`Monthly income`}
              value={formatAUDCompact(projection.monthlyDrawdown)}
              sub={`${DRAWDOWN_YEARS}yr drawdown (real)`}
            />
            <KpiCard
              label="Years to retirement"
              value={String(yearsToRetirement)}
              sub={`Age ${form.currentAge} → ${form.retirementAge}`}
            />
          </div>

          {/* Cap warnings */}
          {(projection.concessionalCapBreached || projection.nonConcessionalCapBreached) && (
            <div className="flex flex-col gap-2">
              {projection.concessionalCapBreached && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <span className="font-medium text-warning">Concessional cap exceeded</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Your employer SG + salary sacrifice totals{" "}
                      <strong>{formatAUDCompact(projection.annualConcessionalContrib)}/yr</strong>,
                      above the $30,000 concessional cap. Excess is taxed at marginal rate + 31.5%
                      excess charge.
                    </p>
                  </div>
                </div>
              )}
              {projection.nonConcessionalCapBreached && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <span className="font-medium text-warning">Non-concessional cap exceeded</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Your after-tax contributions total{" "}
                      <strong>
                        {formatAUDCompact(projection.annualNonConcessionalContrib)}/yr
                      </strong>
                      , above the $120,000 non-concessional cap. Excess attracts a 47% tax.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Projection chart */}
          <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium">Balance projection</span>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Net {((form.expectedReturnPct - form.feesPct) * 100).toFixed(2)}% return p.a. after{" "}
              {(form.feesPct * 100).toFixed(2)}% fees
            </p>
            <ProjectionChart
              nominal={projection.years.map((y) => ({ age: y.age, value: y.nominal }))}
              real={projection.years.map((y) => ({ age: y.age, value: y.real }))}
            />
          </div>

          {/* Contribution breakdown */}
          <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
            <h3 className="mb-3 text-sm font-medium">Annual contribution summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Employer SG</div>
                <div className="tabular-nums font-semibold">
                  {formatAUDCompact(
                    Math.round(form.annualSalary * form.employerContributionPct) as Cents,
                  )}
                  /yr
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Voluntary</div>
                <div className="tabular-nums font-semibold">
                  {formatAUDCompact(
                    (form.voluntaryType === "concessional"
                      ? projection.annualConcessionalContrib -
                        Math.round(form.annualSalary * form.employerContributionPct)
                      : projection.annualNonConcessionalContrib) as Cents,
                  )}
                  /yr
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Concessional total</div>
                <div
                  className={cn(
                    "tabular-nums font-semibold",
                    projection.concessionalCapBreached ? "text-warning" : "",
                  )}
                >
                  {formatAUDCompact(projection.annualConcessionalContrib)}/yr
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Non-concessional</div>
                <div
                  className={cn(
                    "tabular-nums font-semibold",
                    projection.nonConcessionalCapBreached ? "text-warning" : "",
                  )}
                >
                  {formatAUDCompact(projection.annualNonConcessionalContrib)}/yr
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
