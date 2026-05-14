"use client";

import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import { AlertTriangle, Landmark } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { baseApexOptions, getChartTheme } from "@/components/charts/chart-theme";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cents } from "@/lib/money/cents";
import { formatAUD, formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import { useMortgagePlan, useSaveMortgagePlan } from "../hooks";
import type { MortgagePlan, RepaymentFrequency } from "../types";
import { DEFAULT_MORTGAGE_PLAN } from "../types";
import { amortise, PERIODS_PER_YEAR, yearlyBalanceSnapshot } from "../utils/amortise";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── helpers ─────────────────────────────────────────────────────────────────

function centsToDisplay(c: Cents): string {
  return String(Math.round(c / 100));
}

function displayToCents(s: string): Cents {
  const n = Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  return (Number.isFinite(n) ? Math.max(0, n) : 0) as Cents;
}

function pctToDisplay(v: number) {
  return (v * 100).toFixed(2);
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
  const [raw, setRaw] = useState(centsToDisplay(value));
  useEffect(() => setRaw(centsToDisplay(value)), [value]);
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

function NumInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
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
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums leading-tight",
          accent
            ? "bg-gradient-accent bg-clip-text text-transparent"
            : warn
              ? "text-income"
              : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── balance chart ────────────────────────────────────────────────────────────

function BalanceChart({
  withOptimisations: withOpts,
  baseline,
}: {
  withOptimisations: { date: string; balance: Cents }[];
  baseline: { date: string; balance: Cents }[];
}) {
  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "area" },
      stroke: { curve: "smooth", width: 2 },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 0.5, opacityFrom: 0.3, opacityTo: 0.02, stops: [0, 90, 100] },
      },
      colors: [theme.accentFrom, theme.muted],
      xaxis: {
        ...base.xaxis,
        tickAmount: 8,
        labels: {
          rotate: -45,
          rotateAlways: false,
          style: { colors: theme.muted, fontSize: "10px" },
          formatter: (val: string) => (val?.length >= 4 ? val.slice(0, 4) : (val ?? "")),
        },
        title: { text: "Year", style: { color: theme.muted, fontSize: "11px" } },
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
        name: "With offset/extra",
        data: withOpts.map((p) => ({ x: p.date, y: Math.round(p.balance / 100) })),
      },
      {
        name: "Baseline",
        data: baseline.map((p) => ({ x: p.date, y: Math.round(p.balance / 100) })),
      },
    ],
    [withOpts, baseline],
  );

  if (withOpts.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Enter loan details above to see projection
      </div>
    );
  }

  return <ReactApexChart type="area" options={options} series={series} height={260} />;
}

// ─── amortisation schedule table ─────────────────────────────────────────────

const PAGE_SIZE = 30;

function ScheduleTable({ result }: { result: ReturnType<typeof amortise> }) {
  const [page, setPage] = useState(0);
  const { rows } = result;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-surface/80 text-left text-muted-foreground">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Opening</th>
              <th className="px-3 py-2 text-right">Interest</th>
              <th className="px-3 py-2 text-right">Principal</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">Extra</th>
              <th className="px-3 py-2 text-right">Closing</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">Cum. Interest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {slice.map((row) => (
              <tr key={row.period} className="transition-colors hover:bg-muted/20">
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{row.period}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.date}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatAUDCompact(row.opening)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-expense">
                  {formatAUD(row.interest)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-income">
                  {formatAUD(row.principal)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums hidden sm:table-cell">
                  {row.extra > 0 ? formatAUD(row.extra) : "–"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {formatAUDCompact(row.closing)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                  {formatAUDCompact(row.cumulativeInterest)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Periods {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of{" "}
            {rows.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded px-2 py-1 hover:bg-muted/40 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded px-2 py-1 hover:bg-muted/40 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type FormState = Omit<MortgagePlan, "id" | "updatedAt">;
type Tab = "summary" | "schedule";

// Rate input with slider + free-text entry
function RateInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(pctToDisplay(value));
  useEffect(() => setText(pctToDisplay(value)), [value]);

  function commitText(raw: string) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0 && n <= 20) {
      onChange(Math.round(n * 1000) / 100000); // round to 3dp then store as decimal
    } else {
      setText(pctToDisplay(value)); // reset to current
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Interest rate (p.a.)</span>
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
        min={1}
        max={15}
        step={0.05}
        value={Math.min(15, Math.max(1, value * 100))}
        onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
        className="super-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border"
      />
    </div>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "schedule", label: "Amortisation" },
];

export function MortgagePageClient() {
  const { data: saved, isPending } = useMortgagePlan();
  const saveMutation = useSaveMortgagePlan();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);

  const [form, setForm] = useState<FormState>(DEFAULT_MORTGAGE_PLAN);
  const [tab, setTab] = useState<Tab>("summary");

  useEffect(() => {
    if (!isPending && !initialised.current) {
      initialised.current = true;
      if (saved) {
        const { id: _id, updatedAt: _u, ...rest } = saved;
        setForm(rest);
      }
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

  const result = useMemo(() => amortise(form), [form]);

  // Chart baseline: original balance (before redraw was paid in), no offset/extra.
  // This makes redraw savings visible in the "Interest saved" KPI and on the chart.
  const baselineResult = useMemo(
    () =>
      amortise({
        ...form,
        currentBalance: (form.currentBalance + form.redrawBalance) as Cents,
        offsetBalance: 0 as Cents,
        extraRepayment: 0 as Cents,
        redrawBalance: 0 as Cents,
      }),
    [form],
  );

  const withOptsSnapshots = useMemo(
    () =>
      yearlyBalanceSnapshot(
        result.rows,
        form.repaymentFrequency,
        form.currentBalance,
        form.startDate,
      ),
    [result.rows, form.repaymentFrequency, form.currentBalance, form.startDate],
  );

  const baselineSnapshots = useMemo(
    () =>
      yearlyBalanceSnapshot(
        baselineResult.rows,
        form.repaymentFrequency,
        (form.currentBalance + form.redrawBalance) as Cents,
        form.startDate,
      ),
    [
      baselineResult.rows,
      form.repaymentFrequency,
      form.currentBalance,
      form.redrawBalance,
      form.startDate,
    ],
  );

  const ppy = PERIODS_PER_YEAR[form.repaymentFrequency];
  const yearsToPayoff = Math.round((result.payoffPeriods / ppy) * 10) / 10;
  const yearsSaved = Math.round((result.periodsSaved / ppy) * 10) / 10;
  const hasOptimisations =
    form.offsetBalance > 0 || form.extraRepayment > 0 || form.redrawBalance > 0;

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
          <Landmark className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Mortgage Projector</h1>
          <p className="text-xs text-muted-foreground">
            Offset + redraw modelling, extra repayments, amortisation schedule
          </p>
        </div>
        {saveMutation.isPending && (
          <span className="ml-auto text-xs text-muted-foreground">Saving…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Inputs panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface/70 p-5 backdrop-blur-md">
          <h2 className="text-sm font-semibold">Loan details</h2>

          <MoneyInput
            label="Current loan balance"
            value={form.currentBalance}
            onChange={(v) => update({ currentBalance: v, loanAmount: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumInput
              label="Term (years)"
              value={form.termYears}
              min={1}
              max={40}
              suffix="yrs"
              onChange={(v) => update({ termYears: v })}
            />
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Repayment</span>
                <select
                  value={form.repaymentFrequency}
                  onChange={(e) =>
                    update({ repaymentFrequency: e.target.value as RepaymentFrequency })
                  }
                  className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
                >
                  <option value="monthly">Monthly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Loan start (month)</span>
              <input
                type="month"
                value={form.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
              />
            </label>
          </div>

          <div className="border-t border-border/40 pt-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rate
            </h3>
            <RateInput value={form.interestRate} onChange={(v) => update({ interestRate: v })} />
          </div>

          <div className="border-t border-border/40 pt-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Offset &amp; redraw
            </h3>
            <div className="flex flex-col gap-3">
              <MoneyInput
                label="Offset account balance"
                value={form.offsetBalance}
                onChange={(v) => update({ offsetBalance: v })}
                hint="Reduces interest-bearing balance each period"
              />
              <MoneyInput
                label="Redraw available"
                value={form.redrawBalance}
                onChange={(v) => update({ redrawBalance: v })}
                hint="Extra principal already paid. Baseline comparison uses current balance + redraw to show your total savings."
              />
            </div>
          </div>

          <div className="border-t border-border/40 pt-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Extra repayments
            </h3>
            <MoneyInput
              label={`Extra per ${form.repaymentFrequency === "monthly" ? "month" : form.repaymentFrequency === "fortnightly" ? "fortnight" : "week"}`}
              value={form.extraRepayment}
              onChange={(v) => update({ extraRepayment: v })}
              hint="On top of minimum repayment"
            />
          </div>

          {/* Minimum repayment callout */}
          <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Min. repayment: </span>
            <span className="font-semibold tabular-nums">{formatAUD(result.minimumRepayment)}</span>
            <span className="text-muted-foreground">
              {" "}
              /{" "}
              {form.repaymentFrequency === "monthly"
                ? "mo"
                : form.repaymentFrequency === "fortnightly"
                  ? "fn"
                  : "wk"}
            </span>
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex items-center border-b border-border/60">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {tab === value && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-accent" />
                )}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  label="Payoff date"
                  value={result.payoffDate}
                  sub={`${yearsToPayoff} years`}
                  accent
                />
                <KpiCard
                  label="Total interest"
                  value={formatAUDCompact(result.totalInterest)}
                  sub="Over loan life"
                />
                <KpiCard
                  label="Interest saved"
                  value={formatAUDCompact(result.interestSaved)}
                  sub={yearsSaved > 0 ? `${yearsSaved} yrs earlier` : "vs no offset/extra"}
                  warn={result.interestSaved > 0}
                />
                <KpiCard
                  label="Redraw available"
                  value={formatAUDCompact(form.redrawBalance)}
                  sub="Can be accessed"
                />
              </div>

              {/* Offset/redraw savings callout */}
              {hasOptimisations && result.interestSaved > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-income/30 bg-income/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-income" />
                  <div>
                    <span className="font-medium text-income">Great progress on your loan!</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Your offset account and extra repayments save{" "}
                      <strong>{formatAUDCompact(result.interestSaved)}</strong> in interest and pay
                      off your loan <strong>{yearsSaved} years</strong> earlier.
                    </p>
                  </div>
                </div>
              )}

              {/* Balance chart */}
              <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                <div className="mb-2 text-sm font-medium">Loan balance over time</div>
                <BalanceChart withOptimisations={withOptsSnapshots} baseline={baselineSnapshots} />
              </div>

              {/* Summary breakdown */}
              <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
                <h3 className="mb-3 text-sm font-medium">Repayment summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Min. repayment</div>
                    <div className="tabular-nums font-semibold">
                      {formatAUD(result.minimumRepayment)}/
                      {form.repaymentFrequency === "monthly"
                        ? "mo"
                        : form.repaymentFrequency === "fortnightly"
                          ? "fn"
                          : "wk"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total repaid</div>
                    <div className="tabular-nums font-semibold">
                      {formatAUDCompact(result.totalRepayments)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Principal</div>
                    <div className="tabular-nums font-semibold text-income">
                      {formatAUDCompact(form.currentBalance)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Interest</div>
                    <div className="tabular-nums font-semibold text-expense">
                      {formatAUDCompact(result.totalInterest)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "schedule" && <ScheduleTable result={result} />}
        </div>
      </div>
    </div>
  );
}
