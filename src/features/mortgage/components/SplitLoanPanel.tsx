"use client";

import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import { Plus, Scale, Trash2, Users, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import { baseApexOptions, getChartTheme } from "@/components/charts/chart-theme";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field-hint";
import { ulid } from "@/lib/id/ulid";
import type { Cents } from "@/lib/money/cents";
import { formatAUD, formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import type { LoanSplit, MortgagePlan, RepaymentFrequency, SplitParty } from "../types";
import { PERIODS_PER_YEAR } from "../utils/amortise";
import {
  defaultSplitParties,
  type SplitResult,
  shareTotal,
  splitAmortise,
  splitYearly,
} from "../utils/split";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MAX_PARTIES = 6;

// Fixed palette so each party keeps its colour across the share bar, cards and chart.
const PARTY_COLOURS = [
  "hsl(262 70% 60%)",
  "hsl(190 75% 45%)",
  "hsl(32 90% 55%)",
  "hsl(152 55% 42%)",
  "hsl(340 70% 58%)",
  "hsl(220 15% 55%)",
];

function colourFor(i: number) {
  return PARTY_COLOURS[i % PARTY_COLOURS.length];
}

function periodNoun(freq: RepaymentFrequency) {
  return freq === "monthly" ? "month" : freq === "fortnightly" ? "fortnight" : "week";
}

function periodAbbr(freq: RepaymentFrequency) {
  return freq === "monthly" ? "mo" : freq === "fortnightly" ? "fn" : "wk";
}

function years(periods: number, freq: RepaymentFrequency) {
  return Math.round((periods / PERIODS_PER_YEAR[freq]) * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Spread 100% evenly; the last party absorbs the rounding so the total is exact. */
function evenShares(n: number): number[] {
  const each = Math.floor((100 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? round2(100 - each * (n - 1)) : each));
}

// ─── small inputs ────────────────────────────────────────────────────────────

function TextCommitInput({
  value,
  onCommit,
  className,
  placeholder,
  inputMode,
  ariaLabel,
}: {
  value: string;
  onCommit: (raw: string) => void;
  className?: string;
  placeholder?: string;
  inputMode?: "decimal" | "text";
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      key={value}
      type="text"
      aria-label={ariaLabel}
      inputMode={inputMode}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={() => onCommit(ref.current?.value ?? "")}
      onKeyDown={(e) => e.key === "Enter" && onCommit(ref.current?.value ?? "")}
      className={cn("min-w-0 bg-transparent text-sm tabular-nums outline-none", className)}
    />
  );
}

function PercentField({
  label,
  value,
  placeholder,
  tooltip,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  tooltip?: string;
  onCommit: (raw: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tooltip && <FieldHint text={tooltip} />}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-ring">
        <TextCommitInput
          ariaLabel={label}
          value={value}
          placeholder={placeholder}
          inputMode="decimal"
          onCommit={onCommit}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

// ─── share bar ───────────────────────────────────────────────────────────────

function ShareBar({ parties, total }: { parties: SplitParty[]; total: number }) {
  const scale = Math.max(100, total);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {parties.map((p, i) => (
          <div
            key={p.id}
            style={{
              width: `${(Math.max(0, p.sharePct) / scale) * 100}%`,
              background: colourFor(i),
            }}
            className="h-full first:rounded-l-full"
            title={`${p.name}: ${p.sharePct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {parties.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: colourFor(i) }} />
            {p.name} · {p.sharePct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── party editor ────────────────────────────────────────────────────────────

function PartyEditor({
  party,
  index,
  loanRate,
  freq,
  canRemove,
  onChange,
  onRemove,
}: {
  party: SplitParty;
  index: number;
  loanRate: number;
  freq: RepaymentFrequency;
  canRemove: boolean;
  onChange: (patch: Partial<SplitParty>) => void;
  onRemove: () => void;
}) {
  function commitShare(raw: string) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) onChange({ sharePct: round2(n) });
  }

  function commitRate(raw: string) {
    if (raw.trim() === "") return onChange({ interestRate: null });
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 20)
      onChange({ interestRate: Math.round(n * 1000) / 100000 });
  }

  function commitName(raw: string) {
    const name = raw.trim();
    if (name) onChange({ name: name.slice(0, 40) });
  }

  function addLumpSum() {
    const today = new Date().toISOString().slice(0, 7);
    onChange({
      lumpSums: [...party.lumpSums, { id: ulid(), date: today, amount: 0 as Cents }],
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colourFor(index) }} />
        <TextCommitInput
          ariaLabel="Name"
          value={party.name}
          onCommit={commitName}
          className="flex-1 rounded border border-transparent px-1 py-0.5 font-medium hover:border-border/60 focus:border-ring"
        />
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={`Remove ${party.name}`}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PercentField
          label="Share of loan"
          value={String(party.sharePct)}
          onCommit={commitShare}
          tooltip="This person's portion of the current loan balance. Shares must add up to 100%."
        />
        <PercentField
          label="Rate (optional)"
          value={party.interestRate === null ? "" : String(round2(party.interestRate * 100))}
          placeholder={String(round2(loanRate * 100))}
          onCommit={commitRate}
          tooltip="Leave blank to use the loan rate. Set it when this portion sits in a different split (for example a fixed portion alongside a variable one)."
        />
        <MoneyInput
          label={`Extra per ${periodNoun(freq)}`}
          value={party.extraRepayment}
          onChange={(v) => onChange({ extraRepayment: v })}
          tooltip="Paid on top of this person's minimum. Only reduces their own portion."
        />
        <MoneyInput
          label="Own offset"
          value={party.offsetBalance}
          onChange={(v) => onChange({ offsetBalance: v })}
          tooltip="Savings this person holds in the offset. The interest benefit is credited to their portion only."
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Lump sums</span>
          <Button type="button" variant="ghost" size="xs" onClick={addLumpSum}>
            <Plus /> Add
          </Button>
        </div>
        {party.lumpSums.length === 0 && (
          <span className="text-[11px] text-muted-foreground">
            One-off payments, e.g. a bonus or sale proceeds.
          </span>
        )}
        {party.lumpSums.map((l) => (
          <div key={l.id} className="flex items-end gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Month</span>
              <input
                type="month"
                value={l.date}
                onChange={(e) =>
                  onChange({
                    lumpSums: party.lumpSums.map((x) =>
                      x.id === l.id ? { ...x, date: e.target.value } : x,
                    ),
                  })
                }
                className="w-40 rounded-lg border border-border/60 bg-surface px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
            </label>
            <MoneyInput
              label="Amount"
              className="min-w-0 flex-1"
              value={l.amount}
              onChange={(v) =>
                onChange({
                  lumpSums: party.lumpSums.map((x) => (x.id === l.id ? { ...x, amount: v } : x)),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove lump sum"
              onClick={() => onChange({ lumpSums: party.lumpSums.filter((x) => x.id !== l.id) })}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── results ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PartyResultCard({
  result,
  party,
  index,
  freq,
}: {
  result: SplitResult["parties"][number];
  party: SplitParty;
  index: number;
  freq: RepaymentFrequency;
}) {
  const paying = (result.minimumRepayment + party.extraRepayment) as Cents;
  const diff = result.proRataInterest - result.totalInterest;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: colourFor(index) }} />
        <span className="font-medium">{result.name}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {result.sharePct}% · {formatAUDCompact(result.portion)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat
          label="Paying"
          value={`${formatAUD(paying)}/${periodAbbr(freq)}`}
          sub={`Min. ${formatAUD(result.minimumRepayment)}`}
        />
        <Stat
          label="Portion cleared"
          value={result.payoffDate}
          sub={`${years(result.payoffPeriods, freq)} years`}
        />
        <Stat
          label="Interest charged"
          value={formatAUDCompact(result.totalInterest)}
          sub={`${formatAUDCompact(result.totalPaid)} repaid in total`}
        />
        <Stat
          label="Saved vs minimum"
          value={formatAUDCompact(result.interestSaved)}
          sub={
            result.periodsSaved > 0
              ? `${years(result.periodsSaved, freq)} yrs earlier`
              : "On minimum schedule"
          }
        />
      </div>
      {Math.abs(diff) >= 10_000 && (
        <div className="rounded-lg bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Splitting the loan&apos;s interest by share alone would charge{" "}
          <strong className="text-foreground">{formatAUDCompact(result.proRataInterest)}</strong>,{" "}
          {diff > 0 ? (
            <span className="text-expense">{formatAUDCompact(diff as Cents)} too much</span>
          ) : (
            <span className="text-income">
              {formatAUDCompact(Math.abs(diff) as Cents)} too little
            </span>
          )}
          .
        </div>
      )}
    </div>
  );
}

function SplitBalanceChart({ result, freq }: { result: SplitResult; freq: RepaymentFrequency }) {
  const yearly = useMemo(() => splitYearly(result, freq), [result, freq]);

  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "area", stacked: true },
      stroke: { curve: "smooth", width: 1.5 },
      fill: { type: "solid", opacity: 0.35 },
      colors: result.parties.map((_, i) => colourFor(i)),
      dataLabels: { enabled: false },
      xaxis: {
        ...base.xaxis,
        type: "category",
        tickAmount: 8,
        labels: {
          style: { colors: theme.muted, fontSize: "10px" },
          formatter: (val: string) => (val?.length >= 4 ? val.slice(0, 4) : (val ?? "")),
        },
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
        shared: true,
        y: {
          formatter: (v: number) =>
            new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(v),
        },
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "right",
        labels: { colors: theme.muted },
      },
    };
  }, [result.parties]);

  const series = useMemo<ApexAxisChartSeries>(
    () =>
      result.parties.map((p, i) => ({
        name: p.name,
        data: [
          { x: result.rows[0]?.date ?? "", y: Math.round(p.portion / 100) },
          ...yearly.map((y) => ({ x: y.date, y: Math.round(y.parties[i].closing / 100) })),
        ],
      })),
    [result, yearly],
  );

  return <ReactApexChart type="area" options={options} series={series} height={260} />;
}

function YearlyTable({ result, freq }: { result: SplitResult; freq: RepaymentFrequency }) {
  const yearly = useMemo(() => splitYearly(result, freq), [result, freq]);
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-surface/80 text-left text-muted-foreground">
            <th className="px-3 py-2">Year</th>
            {result.parties.map((p, i) => (
              <th key={p.id} className="px-3 py-2 text-right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: colourFor(i) }} />
                  {p.name}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-right">Loan left</th>
          </tr>
          <tr className="border-b border-border/60 bg-surface/80 text-[10px] text-muted-foreground">
            <th />
            {result.parties.map((p) => (
              <th key={p.id} className="px-3 pb-1.5 text-right font-normal">
                paid · owing
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {yearly.map((y) => (
            <tr key={y.year} className="hover:bg-muted/20">
              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                {y.year} <span className="hidden sm:inline">({y.date.slice(0, 4)})</span>
              </td>
              {y.parties.map((p, i) => (
                <td
                  key={result.parties[i].id}
                  className={cn(
                    "px-3 py-1.5 text-right tabular-nums",
                    p.closing === 0 && p.paid === 0 && "text-muted-foreground/50",
                  )}
                >
                  {formatAUDCompact(p.paid)} ·{" "}
                  {p.closing === 0 ? (
                    <span className="text-income">cleared</span>
                  ) : (
                    formatAUDCompact(p.closing)
                  )}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                {formatAUDCompact(y.totalClosing)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── panel ───────────────────────────────────────────────────────────────────

type PlanInput = Omit<MortgagePlan, "id" | "updatedAt">;

export function SplitLoanPanel({
  plan,
  onChange,
}: {
  plan: PlanInput;
  onChange: (split: LoanSplit) => void;
}) {
  const split = plan.split;
  const enabled = !!split?.enabled && split.parties.length >= 2;
  const parties = split?.parties ?? [];
  const freq = plan.repaymentFrequency;

  const result = useMemo(
    () =>
      enabled
        ? splitAmortise({
            currentBalance: plan.currentBalance,
            interestRate: plan.interestRate,
            termYears: plan.termYears,
            repaymentFrequency: freq,
            startDate: plan.startDate,
            parties,
          })
        : null,
    [
      enabled,
      plan.currentBalance,
      plan.interestRate,
      plan.termYears,
      freq,
      plan.startDate,
      parties,
    ],
  );

  function setParties(next: SplitParty[]) {
    onChange({ enabled: true, parties: next });
  }

  function enable() {
    onChange({
      enabled: true,
      parties: parties.length >= 2 ? parties : defaultSplitParties(ulid),
    });
  }

  function addParty() {
    if (parties.length >= MAX_PARTIES) return;
    const name = `Party ${String.fromCharCode(65 + parties.length)}`;
    const shares = evenShares(parties.length + 1);
    setParties([
      ...parties.map((p, i) => ({ ...p, sharePct: shares[i] })),
      {
        id: ulid(),
        name,
        sharePct: shares[parties.length],
        extraRepayment: 0 as Cents,
        offsetBalance: 0 as Cents,
        interestRate: null,
        lumpSums: [],
      },
    ]);
  }

  function removeParty(id: string) {
    setParties(parties.filter((p) => p.id !== id));
  }

  function splitEvenly() {
    const shares = evenShares(parties.length);
    setParties(parties.map((p, i) => ({ ...p, sharePct: shares[i] })));
  }

  if (!enabled) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-surface/70 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Split this loan between people</h3>
        </div>
        <p className="max-w-prose text-xs text-muted-foreground">
          For a loan held jointly by two or more people or households. Give each person a share of
          the balance and their own repayment plan. Each share is tracked separately: interest is
          charged only on what that person still owes, so whoever repays faster stops paying
          interest on their cleared share while everyone else continues at their own pace.
        </p>
        <Button type="button" size="sm" onClick={enable}>
          <Users /> Set up split
        </Button>
      </div>
    );
  }

  const total = shareTotal(parties);
  const totalOk = result?.valid ?? false;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Split between {parties.length} people</h3>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="xs" onClick={splitEvenly}>
              <Scale /> Even shares
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={addParty}
              disabled={parties.length >= MAX_PARTIES}
            >
              <Plus /> Add person
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange({ enabled: false, parties })}
            >
              Turn off
            </Button>
          </div>
        </div>
        <ShareBar parties={parties} total={total} />
        {!totalOk && (
          <div className="rounded-lg border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
            Shares add up to {round2(total)}%. Adjust them to total exactly 100% to see the split.
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Uses the balance, rate, term and frequency from Loan details. Offset and extra repayments
          are set per person here and replace the single-loan figures for this view.
        </p>
      </div>

      {/* Party editors */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {parties.map((p, i) => (
          <PartyEditor
            key={p.id}
            party={p}
            index={i}
            loanRate={plan.interestRate}
            freq={freq}
            canRemove={parties.length > 2}
            onChange={(patch) =>
              setParties(parties.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
            }
            onRemove={() => removeParty(p.id)}
          />
        ))}
      </div>

      {result?.valid && (
        <>
          {/* Combined */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-surface/70 p-4 text-sm backdrop-blur-md sm:grid-cols-4">
            <Stat
              label="Loan fully cleared"
              value={result.payoffDate}
              sub={`${years(result.payoffPeriods, freq)} years`}
            />
            <Stat
              label="Combined minimum"
              value={`${formatAUD(result.combinedMinimum)}/${periodAbbr(freq)}`}
              sub="Sum of each share's minimum"
            />
            <Stat
              label="Total interest"
              value={formatAUDCompact(result.totalInterest)}
              sub="All shares combined"
            />
            <Stat label="Total repaid" value={formatAUDCompact(result.totalPaid)} />
          </div>

          {/* Per party */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {result.parties.map((r, i) => (
              <PartyResultCard key={r.id} result={r} party={parties[i]} index={i} freq={freq} />
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
            <div className="mb-2 text-sm font-medium">Who owes what over time</div>
            <SplitBalanceChart result={result} freq={freq} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Year by year</div>
            <YearlyTable result={result} freq={freq} />
          </div>

          <div className="rounded-lg bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How the split is calculated. </span>
            Each share starts as its percentage of the current balance and has its own minimum
            repayment over the remaining term, so the minimums add up to the whole loan&apos;s
            minimum. Every {periodNoun(freq)}, interest is charged on each share&apos;s own
            outstanding balance less that person&apos;s offset, and their repayments, extras and
            lump sums reduce only their share. The lender still sees one loan; this shows how to
            divide it fairly between you.
          </div>
        </>
      )}
    </div>
  );
}
