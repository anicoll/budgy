"use client";

import {
  breakEvenVariableRate,
  compareFixedVsVariable,
  estimateBreakCost,
  type FixedVsVariableResult,
  type Frequency,
  RATE_PATH_PRESETS,
  rateOn,
  validateFixedVsVariable,
} from "@budgy/engine";
import { useDeferredValue, useMemo, useState } from "react";
import { BenefitChart } from "@/components/BenefitChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { RateChart } from "@/components/RateChart";
import { SavedBar } from "@/components/SavedBar";
import {
  decodeFixed,
  defaultFixed,
  encodeFixed,
  type FixedForm,
  PATH_CHOICES,
  type PathChoice,
  pathFor,
  presetSteps,
  toFixedInput,
} from "@/lib/fixedRate";
import { money, moneyExact, monthYear, perPeriod } from "@/lib/format";
import { withLoanFields } from "@/lib/saved";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Slider } from "./ui";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "weekly", label: "Weekly" },
];

const SHARES = [0, 25, 50, 75, 100];

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const pill = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent text-accent" : "border-border hover:border-accent"}`;
const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;
const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;
const signed = (c: number) => (c >= 0 ? money(c) : `−${money(-c)}`);

const pathLabel = (p: PathChoice) =>
  p === "custom" ? "Your own path" : RATE_PATH_PRESETS[p].label;

/** "fixing half", "fixing 60%", "fixing the whole loan" */
function planName(share: number) {
  if (share >= 100) return "fixing the whole loan";
  if (share === 50) return "fixing half";
  return `fixing ${share}%`;
}

const FIXED_SAVED: SavedConfig<FixedForm> = {
  tool: "fixed",
  initial: () => defaultFixed(),
  decode: (q) => decodeFixed(q),
  encode: encodeFixed,
  loan: {
    // Its variable rate is the rate on the loan today.
    read: (f) => ({ ...f, ratePct: f.variableRatePct }),
    apply: (f, loan) => ({
      ...withLoanFields(f, loan),
      variableRatePct: loan.ratePct ?? f.variableRatePct,
    }),
  },
};

export function FixedVariableCalculator() {
  const saved = useSavedState(FIXED_SAVED);
  const { state: form, setState: setForm } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toFixedInput(form), [form]);
  const errors = useMemo(() => validateFixedVsVariable(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return compareFixedVsVariable(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const set = (patch: Partial<FixedForm>) => setForm((f) => ({ ...f, ...patch }));

  const choosePath = (path: PathChoice) => {
    if (path === "custom" && form.path !== "custom") {
      const seed = presetSteps(form.path, form.variableRatePct);
      set({
        path,
        customPath: seed.length ? seed : [{ months: 12, ratePct: form.variableRatePct }],
      });
    } else set({ path });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Fixed or variable</h1>
        <p className="mt-1 max-w-2xl text-muted">
          What if rates rise 1% next year, or you fix half? Pick a path for rates and see what
          fixing all or part of your loan would save or cost. Coming off a fixed rate? Enter the
          balance you&apos;ll owe on the roll-off date. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="space-y-4" aria-label="Your loan, the rate path and the fixed offer">
          <div className={card}>
            <h2 className="mb-3 font-semibold">Your loan</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                className="col-span-2"
                label="Loan balance"
                hint="What you owe now, not the original loan."
                value={form.balance}
                onChange={(v) => v !== undefined && set({ balance: v })}
              />
              <NumberField
                label="Variable rate"
                suffix="%"
                hint="What you'd pay if you don't fix."
                min={0}
                max={20}
                step={0.01}
                value={form.variableRatePct}
                onChange={(v) => v !== undefined && set({ variableRatePct: v })}
              />
              <NumberField
                label="Years left"
                suffix="yrs"
                min={1}
                max={40}
                step={1}
                value={form.termYears}
                onChange={(v) => v !== undefined && set({ termYears: v })}
              />
              <SelectField
                label="Repayments"
                value={form.frequency}
                options={FREQUENCIES}
                onChange={(frequency) => set({ frequency })}
              />
              <MoneyField
                label="Extra each time"
                hint="On the variable part."
                value={form.extra}
                onChange={(v) => set({ extra: v ?? 0 })}
              />
              {form.frequency === "fortnightly" && (
                <SelectField
                  className="col-span-2"
                  label="How your bank sets fortnightly repayments"
                  value={form.fortnightlyMethod}
                  options={[
                    { value: "half-monthly", label: "Half the monthly repayment (most common)" },
                    { value: "true", label: "True fortnightly amount" },
                  ]}
                  onChange={(fortnightlyMethod) => set({ fortnightlyMethod })}
                />
              )}
              <MoneyField
                label="Offset balance"
                hint="Only works on the variable part."
                value={form.offset}
                onChange={(v) => set({ offset: v ?? 0 })}
              />
              <DateField
                label="Starting"
                value={form.startDate}
                onChange={(startDate) => set({ startDate })}
              />
            </div>
          </div>

          <div className={card} style={{ borderLeft: "4px solid var(--series-b)" }}>
            <h2 className="mb-1 font-semibold">Where variable rates go</h2>
            <p className="mb-3 text-xs text-muted">
              Nobody knows. Try a few and see how much it matters.
            </p>
            <div className="flex flex-wrap gap-2">
              {[...PATH_CHOICES, "custom" as const].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={pill(form.path === p)}
                  aria-pressed={form.path === p}
                  onClick={() => choosePath(p)}
                >
                  {p === "custom" ? "Customise" : RATE_PATH_PRESETS[p].label}
                </button>
              ))}
            </div>
            {form.path === "custom" && (
              <CustomPath form={form} onChange={(customPath) => set({ customPath })} />
            )}
          </div>

          <div className={card} style={{ borderLeft: "4px solid var(--series-a)" }}>
            <h2 className="mb-3 font-semibold">The fixed rate</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Fixed rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={form.fixedRatePct}
                onChange={(v) => v !== undefined && set({ fixedRatePct: v })}
              />
              <NumberField
                label="Fixed for"
                suffix="yrs"
                min={1}
                max={10}
                step={1}
                value={form.fixedYears}
                onChange={(v) => v !== undefined && set({ fixedYears: v })}
              />
              <fieldset className="col-span-2">
                <legend className="mb-1.5 text-sm font-medium">How much to fix</legend>
                <div className="flex flex-wrap gap-2">
                  {SHARES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={pill(form.fixedSharePct === s)}
                      aria-pressed={form.fixedSharePct === s}
                      onClick={() => set({ fixedSharePct: s })}
                    >
                      {s === 0 ? "None" : s === 100 ? "All" : `${s}%`}
                    </button>
                  ))}
                </div>
                <Slider
                  label="Share of the loan to fix"
                  className="mt-1"
                  min={0}
                  max={100}
                  step={5}
                  value={form.fixedSharePct}
                  onChange={(fixedSharePct) => set({ fixedSharePct })}
                />
                <p className="num text-xs text-muted">
                  {money(form.balance * form.fixedSharePct)} fixed,{" "}
                  {money(form.balance * (100 - form.fixedSharePct))} variable
                </p>
              </fieldset>
              <NumberField
                className="col-span-2"
                label="Revert rate vs your variable rate"
                suffix="%"
                hint="When the fix ends it rolls to the lender's standard variable rate, often higher than new customers get. 0 = the same as your variable rate."
                min={-5}
                max={5}
                step={0.05}
                value={form.revertMarginPct}
                onChange={(v) => v !== undefined && set({ revertMarginPct: v })}
              />
            </div>
          </div>
        </section>

        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!result ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check your numbers: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results r={result} form={form} onChange={set} onCopy={copyLink} copied={copied} />
          )}
          <GoodToKnow tool="fixed" />
          <Method />
        </section>
      </div>

      {result && form.fixedSharePct > 0 && <MobileSummary r={result} form={form} />}
    </main>
  );
}

function CustomPath({
  form,
  onChange,
}: {
  form: FixedForm;
  onChange: (steps: FixedForm["customPath"]) => void;
}) {
  const steps = form.customPath;
  const update = (i: number, patch: Partial<FixedForm["customPath"][number]>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted">
        Today: {form.variableRatePct.toFixed(2)}%. Each step holds until the next.
      </p>
      {steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps have no identity beyond their place
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <NumberField
            label="From month"
            min={1}
            max={form.termYears * 12}
            step={1}
            value={s.months}
            onChange={(v) => v !== undefined && update(i, { months: Math.round(v) })}
          />
          <NumberField
            label="Rate"
            suffix="%"
            min={0}
            max={20}
            step={0.05}
            value={s.ratePct}
            onChange={(v) => v !== undefined && update(i, { ratePct: v })}
          />
          <button
            type="button"
            aria-label={`Remove step ${i + 1}`}
            className="mb-0.5 rounded-lg border border-border px-3 py-2 text-sm hover:border-warn hover:text-warn"
            onClick={() => onChange(steps.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {steps.length < 24 && (
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          onClick={() => {
            const last = steps.at(-1);
            onChange([
              ...steps,
              {
                months: (last?.months ?? 0) + 6,
                ratePct: last?.ratePct ?? form.variableRatePct,
              },
            ]);
          }}
        >
          Add a step
        </button>
      )}
    </div>
  );
}

function MobileSummary({ r, form }: { r: FixedVsVariableResult; form: FixedForm }) {
  const a = r.aheadFixedPeriod;
  return (
    <a
      href="#results"
      className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
    >
      <span className="num min-w-0">
        Over the fix:{" "}
        <strong className={a >= 0 ? "text-good" : "text-warn"}>
          {a >= 0 ? `${money(a)} saved` : `${money(-a)} extra`}
        </strong>{" "}
        <span className="text-muted">({pathLabel(form.path).toLowerCase()})</span>
      </span>
      <span className="shrink-0 text-accent">See results ↓</span>
    </a>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

function Results({
  r,
  form,
  onChange,
  onCopy,
  copied,
}: {
  r: FixedVsVariableResult;
  form: FixedForm;
  onChange: (patch: Partial<FixedForm>) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const [range, setRange] = useState<"fix" | "all">("fix");
  const fixedMonths = Math.round(form.fixedYears * 12);
  const share = form.fixedSharePct;
  const name = planName(share);
  const a = r.aheadFixedPeriod;
  const per = perPeriod[form.frequency];

  // The grid and break-even run dozens of simulations: let typing stay snappy.
  const later = useDeferredValue(form);
  const breakEven = useMemo(() => breakEvenVariableRate(toFixedInput(later)), [later]);

  // Every rate path against a few splits, over the fixed period.
  const grid = useMemo(() => {
    const paths: PathChoice[] = [
      ...PATH_CHOICES,
      ...(later.path === "custom" ? ["custom" as const] : []),
    ];
    const shares = [
      ...new Set([25, 50, 75, 100, ...(later.fixedSharePct > 0 ? [later.fixedSharePct] : [])]),
    ].sort((x, y) => x - y);
    const rows = paths.map((path) => ({
      path,
      cells: shares.map((s) => {
        try {
          return compareFixedVsVariable(toFixedInput(later, { path, fixedSharePct: s }));
        } catch {
          return null;
        }
      }),
    }));
    return { shares, rows };
  }, [later]);

  // Rates month by month for the chart.
  const rates = useMemo(() => {
    const loan = { annualRate: form.variableRatePct / 100, rateChanges: pathFor(form.path, form) };
    const lastStep = Math.max(
      0,
      ...form.customPath.map((s) => s.months),
      form.path === "rise-2" ? 24 : 12,
    );
    const months = Math.min(
      Math.round(form.termYears * 12),
      Math.max(fixedMonths + 24, lastStep + 12),
    );
    const dates = r.timeline.slice(0, months + 1).map((p) => p.date);
    const variable = dates.map((d) => rateOn(loan, d));
    const fixed = dates.map((d, i) =>
      i < fixedMonths
        ? form.fixedRatePct / 100
        : Math.min(0.2, Math.max(0, rateOn(loan, d) + form.revertMarginPct / 100)),
    );
    return { dates, variable, fixed };
  }, [form, fixedMonths, r.timeline]);

  // Rough break cost on the fixed part.
  const breakMonth = Math.round(form.breakAfterYears * 12);
  const breakCost = useMemo(() => {
    if (!r.fixed || breakMonth >= fixedMonths) return null;
    const at = r.fixed.balances[Math.min(breakMonth, r.fixed.balances.length - 1)];
    return estimateBreakCost(
      at.balance,
      form.fixedRatePct / 100,
      Math.max(0, (form.fixedRatePct - form.breakDropPct) / 100),
      fixedMonths - breakMonth,
    );
  }, [r.fixed, breakMonth, fixedMonths, form.fixedRatePct, form.breakDropPct]);

  const points = (range === "fix" ? r.timeline.slice(0, fixedMonths + 1) : r.timeline).map((p) => ({
    date: p.date,
    benefit: p.ahead,
  }));
  const warnings = [...new Set([...r.warnings, ...r.variable.warnings])];

  if (share === 0) {
    return (
      <>
        <div className={`${card} space-y-2 text-lg leading-relaxed`}>
          <p>
            Staying fully variable, your repayment starts at{" "}
            <strong className="num">{moneyExact(r.variableRepayment)}</strong> {per} and you&apos;re
            debt-free in <strong>{monthYear(r.variable.payoffDate)}</strong>, if rates{" "}
            {pathLabel(form.path)
              .toLowerCase()
              .replace(/^rates /, "")}
            .
          </p>
          <p className="text-base text-muted">
            Choose how much to fix to compare. The table below shows every split at once.
          </p>
        </div>
        <RatesCard rates={rates} fixedMonths={fixedMonths} showFixed={false} />
        <Grid grid={grid} form={form} onChange={onChange} />
      </>
    );
  }

  return (
    <>
      <div className={`${card} space-y-2 text-lg leading-relaxed`}>
        <p>
          If rates{" "}
          {pathLabel(form.path)
            .toLowerCase()
            .replace(/^rates /, "")}
          , {name} for {years(form.fixedYears)}{" "}
          {a >= 0 ? (
            <>
              saves you <strong className="num text-good">{money(a)}</strong>
            </>
          ) : (
            <>
              costs you <strong className="num text-warn">{money(-a)}</strong> more
            </>
          )}{" "}
          in interest over the fixed period.
        </p>
        {breakEven !== null && (
          <p className="text-base text-muted">
            Fixing comes out ahead if the variable rate averages more than{" "}
            <strong className="num text-text">{pct(breakEven)}</strong> over the next{" "}
            {years(form.fixedYears)}
            {breakEven > form.variableRatePct / 100 + 0.00005 ? (
              <>, {((breakEven - form.variableRatePct / 100) * 100).toFixed(2)}% above today.</>
            ) : breakEven < form.variableRatePct / 100 - 0.00005 ? (
              <>
                . That&apos;s below today&apos;s rate, so rates would have to fall to make staying
                variable the better bet.
              </>
            ) : (
              <>, about where it is today.</>
            )}
          </p>
        )}
        <p className="text-base text-muted">
          Your repayment starts at{" "}
          <strong className="num text-text">{moneyExact(r.planRepayment)}</strong> {per}
          {r.planRepayment !== r.variableRepayment && (
            <> ({moneyExact(r.variableRepayment)} all variable)</>
          )}
          . When the fix ends in {monthYear(r.fixedEndDate)}, the fixed part rolls to about{" "}
          <strong className="num text-text">{pct(r.revertRate)}</strong>.
        </p>
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Interest over the fix"
          value={money(r.planInterestFixedPeriod)}
          note={`${money(r.variableInterestFixedPeriod)} all variable`}
        />
        <Stat
          label="Over the fix"
          value={signed(a)}
          note={a >= 0 ? "saved by fixing" : "extra by fixing"}
        />
        <Stat
          label="Over the whole loan"
          value={signed(r.aheadLifetime)}
          note={r.aheadLifetime >= 0 ? "saved by fixing" : "extra by fixing"}
        />
        <Stat
          label="Debt-free"
          value={monthYear(r.planPayoffDate)}
          note={`${monthYear(r.variable.payoffDate)} all variable`}
        />
      </div>

      <RatesCard rates={rates} fixedMonths={fixedMonths} showFixed />

      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Interest saved by fixing</h2>
          <div className="flex gap-2">
            <button type="button" className={pill(range === "fix")} onClick={() => setRange("fix")}>
              Fixed period
            </button>
            <button type="button" className={pill(range === "all")} onClick={() => setRange("all")}>
              Whole loan
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
        <BenefitChart
          points={points}
          markerMonth={fixedMonths}
          label="Interest saved by fixing compared with staying variable, over time"
        />
        <p className="mt-1 text-xs text-muted">
          Interest on your plan compared with staying fully variable. Above $0 means fixing is
          ahead. The dot marks the end of the fix.
        </p>
      </div>

      <Grid grid={grid} form={form} onChange={onChange} />

      <div className={card}>
        <h2 className="mb-1 font-semibold">If you need to break the fix</h2>
        <p className="mb-3 text-sm text-muted">
          Selling, refinancing or paying a lot off early can trigger a break cost if fixed rates
          have fallen since you fixed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Break after"
            suffix="yrs"
            min={0}
            max={10}
            step={0.5}
            value={form.breakAfterYears}
            onChange={(v) => v !== undefined && onChange({ breakAfterYears: v })}
          />
          <NumberField
            label="Fixed rates have fallen by"
            suffix="%"
            min={0}
            max={5}
            step={0.25}
            value={form.breakDropPct}
            onChange={(v) => v !== undefined && onChange({ breakDropPct: v })}
          />
        </div>
        <p className="mt-3">
          {breakCost === null ? (
            <span className="text-muted">
              That&apos;s after the fix ends, so there&apos;s no break cost.
            </span>
          ) : breakCost === 0 ? (
            <span className="text-muted">
              With rates no lower, there&apos;s usually little or no break cost.
            </span>
          ) : (
            <>
              Expect a break cost in the region of{" "}
              <strong className="num text-warn">{money(breakCost)}</strong>, plus any break fee.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          A ballpark only. Each lender has its own formula, based on its funding costs.
        </p>
      </div>
    </>
  );
}

function RatesCard({
  rates,
  fixedMonths,
  showFixed,
}: {
  rates: { dates: string[]; variable: number[]; fixed: number[] };
  fixedMonths: number;
  showFixed: boolean;
}) {
  return (
    <div className={card}>
      <h2 className="mb-2 font-semibold">Interest rates</h2>
      <RateChart
        dates={rates.dates}
        markerMonth={showFixed ? fixedMonths : undefined}
        series={[
          { name: "Variable", color: "var(--series-b)", rates: rates.variable },
          ...(showFixed
            ? [{ name: "Fixed part", color: "var(--series-a)", rates: rates.fixed }]
            : []),
        ]}
      />
    </div>
  );
}

function Grid({
  grid,
  form,
  onChange,
}: {
  grid: {
    shares: number[];
    rows: { path: PathChoice; cells: (FixedVsVariableResult | null)[] }[];
  };
  form: FixedForm;
  onChange: (patch: Partial<FixedForm>) => void;
}) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <h2 className="mb-1 font-semibold">Every rate path, every split</h2>
      <p className="mb-3 text-sm text-muted">
        Interest saved (or extra) by fixing for {years(form.fixedYears)}, compared with staying
        fully variable. Pick a row or column to try it.
      </p>
      <table className="num w-full min-w-[440px] text-sm [&_td:not(:first-child)]:whitespace-nowrap">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1.5 pr-3 font-medium">If rates…</th>
            {grid.shares.map((s) => (
              <th key={s} className="py-1.5 pr-3 text-right font-medium">
                <button
                  type="button"
                  className={`underline-offset-2 hover:underline ${s === form.fixedSharePct ? "text-accent" : ""}`}
                  onClick={() => onChange({ fixedSharePct: s })}
                >
                  {s === 100 ? "Fix all" : `Fix ${s}%`}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
          {grid.rows.map((row) => (
            <tr key={row.path} className={row.path === form.path ? "bg-accent/5" : undefined}>
              <td>
                <button
                  type="button"
                  className={`text-left underline-offset-2 hover:underline ${row.path === form.path ? "text-accent" : ""}`}
                  onClick={() => onChange({ path: row.path })}
                >
                  {pathLabel(row.path)
                    .replace(/^Rates /, "")
                    .replace(/^./, (c) => c.toLowerCase())}
                </button>
              </td>
              {row.cells.map((c, i) => (
                <td
                  key={grid.shares[i]}
                  className={
                    c === null ? "text-muted" : c.aheadFixedPeriod >= 0 ? "text-good" : "text-warn"
                  }
                >
                  {c === null ? "–" : signed(c.aheadFixedPeriod)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Your loan is run twice from the start date, the way Australian lenders run a home loan:
          interest worked out daily, added monthly, with repayments on real calendar dates. Once
          staying fully variable, following the rate path you picked, and once with your split.
        </p>
        <p>
          A split loan is two accounts. Each has its own minimum repayment over the years left, so
          your total repayment changes with the split. Extra repayments and your offset go on the
          variable part, because most fixed loans cap extras and don&apos;t have an offset. When the
          fix ends, the fixed part rolls onto the variable path plus the revert gap you entered, and
          its minimum repayment is recalculated.
        </p>
        <p>
          We compare the interest you&apos;re charged. The principal you repay is still your money
          (it&apos;s in the house), so interest is the real cost. The break-even rate is the flat
          variable rate at which the fixed period costs the same either way.
        </p>
        <p>
          When a variable rate changes, the lender recalculates your minimum. A higher minimum is
          paid from then on; when rates fall, we assume you keep paying what you were, which is what
          most lenders do unless you ask.
        </p>
        <p>
          Real loans can differ by a few dollars because of rounding and the exact day each lender
          charges interest. This is general information, not financial advice.
        </p>
      </div>
    </details>
  );
}
