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
import { NextSteps } from "@/components/NextSteps";
import { RateChart } from "@/components/RateChart";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  EditSheet,
  IdeaCard,
  Ideas,
  SummaryRow,
  SummaryRows,
  ToolHeader,
  ToolPage,
  ToolSection,
  useEditSheet,
  useIdea,
} from "@/components/tool";
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
  const { ref: sheet, open: edit } = useEditSheet();

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

  return (
    <ToolPage>
      <ToolHeader
        title="Fixed or variable"
        intro="What fixing all or part of your loan would save or cost if rates rise, fall or stay put."
        saved={saved}
      />

      {!result ? (
        <div className="space-y-8">
          <div className={`${card} text-warn`}>
            {errors.length
              ? `Check your numbers: ${errors.join("; ")}.`
              : "Something in the inputs doesn't add up."}{" "}
            <button type="button" onClick={() => edit("loan")} className="text-accent underline">
              Edit your loan
            </button>
          </div>
          <Controls form={form} onChange={set} onPath={choosePath} />
        </div>
      ) : (
        <Results
          r={result}
          form={form}
          onChange={set}
          onPath={choosePath}
          edit={edit}
          loanHint={`${money(Math.round(form.balance * 100))} · ${form.variableRatePct}% variable · ${form.termYears} yrs`}
          fixedHint={`${form.fixedRatePct}% for ${years(form.fixedYears)}${
            form.lockFee > 0 ? ` · ${money(Math.round(form.lockFee * 100))} fee` : ""
          }`}
        />
      )}

      <EditSheet ref={sheet} title="Your loan and the fixed rate">
        <div id="loan" className="scroll-mt-20">
          <h3 className="mb-3 font-semibold">Your loan</h3>
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

        <div id="fixed" className="scroll-mt-20">
          <h3 className="mb-3 font-semibold">The fixed rate</h3>
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
            <MoneyField
              className="col-span-2"
              label="Rate lock or fixing fee"
              hint="Some lenders charge to lock in the rate before settlement, often $500 to $1,000. Counted against fixing."
              value={form.lockFee}
              onChange={(v) => set({ lockFee: v ?? 0 })}
            />
          </div>
        </div>
      </EditSheet>
    </ToolPage>
  );
}

/** Where variable rates go, and how much to fix: these stay on the page by the answer. */
function Controls({
  form,
  onChange,
  onPath,
}: {
  form: FixedForm;
  onChange: (patch: Partial<FixedForm>) => void;
  onPath: (p: PathChoice) => void;
}) {
  return (
    <ToolSection id="try-h" title="Try a rate path">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card} style={{ borderLeft: "4px solid var(--series-b)" }}>
          <h3 className="mb-1 font-semibold">Where variable rates go</h3>
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
                onClick={() => onPath(p)}
              >
                {p === "custom" ? "Customise" : RATE_PATH_PRESETS[p].label}
              </button>
            ))}
          </div>
          {form.path === "custom" && (
            <CustomPath form={form} onChange={(customPath) => onChange({ customPath })} />
          )}
        </div>

        <div className={card} style={{ borderLeft: "4px solid var(--series-a)" }}>
          <fieldset>
            <legend className="mb-1.5 font-semibold">How much to fix</legend>
            <div className="flex flex-wrap gap-2">
              {SHARES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={pill(form.fixedSharePct === s)}
                  aria-pressed={form.fixedSharePct === s}
                  onClick={() => onChange({ fixedSharePct: s })}
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
              onChange={(fixedSharePct) => onChange({ fixedSharePct })}
            />
            <p className="num text-xs text-muted">
              {money(form.balance * form.fixedSharePct)} fixed,{" "}
              {money(form.balance * (100 - form.fixedSharePct))} variable
            </p>
          </fieldset>
        </div>
      </div>
    </ToolSection>
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
  onPath,
  edit,
  loanHint,
  fixedHint,
}: {
  r: FixedVsVariableResult;
  form: FixedForm;
  onChange: (patch: Partial<FixedForm>) => void;
  onPath: (p: PathChoice) => void;
  edit: (focusId?: string) => void;
  loanHint: string;
  fixedHint: string;
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

  const { idea, toggle } = useIdea<"grid" | "break">();
  const pathName = pathLabel(form.path)
    .toLowerCase()
    .replace(/^rates /, "");

  const summary = (
    <ToolSection id="loan-h" title="Your numbers">
      <SummaryRows>
        <SummaryRow title="Your loan" hint={loanHint} onClick={() => edit("loan")} />
        <SummaryRow title="The fixed rate" hint={fixedHint} onClick={() => edit("fixed")} />
      </SummaryRows>
    </ToolSection>
  );

  const ratesChart = <RatesCard rates={rates} fixedMonths={fixedMonths} showFixed={share > 0} />;

  const ideas = (
    <Ideas
      cards={
        <>
          <IdeaCard
            title="Every rate path, every split"
            open={idea === "grid"}
            onClick={() => toggle("grid")}
          >
            {share > 0 ? (
              <>
                {name[0].toUpperCase() + name.slice(1)} {a >= 0 ? "saves" : "costs"}{" "}
                <strong className={`num ${a >= 0 ? "text-good" : "text-warn"}`}>
                  {money(Math.abs(a))}
                </strong>{" "}
                if rates {pathName}. See every path and split side by side.
              </>
            ) : (
              "See what fixing 25%, 50%, 75% or all of the loan does under every rate path."
            )}
          </IdeaCard>
          <IdeaCard
            title="If you need to break the fix"
            open={idea === "break"}
            onClick={() => toggle("break")}
          >
            {share === 0 ? (
              "Fix some of the loan to see a break cost."
            ) : breakCost === null ? (
              "Breaking after the fix ends has no break cost."
            ) : breakCost === 0 ? (
              "With rates no lower, there's usually little or no break cost."
            ) : (
              <>
                Breaking after {years(form.breakAfterYears)} could cost about{" "}
                <strong className="num text-warn">{money(breakCost)}</strong>.
              </>
            )}
          </IdeaCard>
        </>
      }
    >
      {idea === "grid" && <Grid grid={grid} form={form} onChange={onChange} />}
      {idea === "break" && (
        <div className={card}>
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
      )}
    </Ideas>
  );

  const detail = (
    <Detail>
      {share > 0 && (
        <Disclosure title="Interest rates" hint="variable and fixed, month by month">
          {ratesChart}
        </Disclosure>
      )}
      {share > 0 && (
        <Disclosure title="The numbers" hint="interest over the fix and debt-free date">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Interest over the fix"
              value={money(r.planInterestFixedPeriod)}
              note={`${money(r.variableInterestFixedPeriod)} all variable`}
            />
            <Stat
              label="Over the fix"
              value={signed(a)}
              note={`${a >= 0 ? "saved by fixing" : "extra by fixing"}${r.fixingFee > 0 ? `, after the ${money(r.fixingFee)} fee` : ""}`}
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
        </Disclosure>
      )}
      <Disclosure title="Good to know" hint="tips and things to check">
        <GoodToKnow tool="fixed" bare />
      </Disclosure>
      <Disclosure title="How this is calculated" hint="two runs, one variable and one split">
        <Method />
      </Disclosure>
    </Detail>
  );

  if (share === 0) {
    return (
      <div className="space-y-8">
        <AnswerRow>
          <AnswerCard label="Staying fully variable">
            <p className="text-sm font-semibold text-on-primary-container">Debt-free</p>
            <p className="num -mt-2 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
              {monthYear(r.variable.payoffDate)}
            </p>
            <p className="text-lg">
              Your repayment starts at{" "}
              <strong className="num">{moneyExact(r.variableRepayment)}</strong> {per}, if rates{" "}
              {pathName}. Choose how much to fix to compare.
            </p>
          </AnswerCard>
          {ratesChart}
        </AnswerRow>
        <Controls form={form} onChange={onChange} onPath={onPath} />
        {summary}
        {ideas}
        {detail}
        <NextSteps tool="fixed" className="pt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnswerRow>
        <AnswerCard label={`If rates ${pathName}, ${name} for ${years(form.fixedYears)}`}>
          <p className="text-sm font-semibold text-on-primary-container">
            {a >= 0 ? "Interest saved by fixing" : "Extra interest from fixing"}
          </p>
          <p
            className={`num -mt-2 text-4xl leading-none font-bold tracking-tight sm:text-5xl ${
              a < 0 ? "text-warn" : ""
            }`}
          >
            {money(Math.abs(a))}
          </p>
          <p className="text-lg">
            {r.fixingFee > 0
              ? `Over the fixed period, counting the ${money(r.fixingFee)} fee.`
              : "Over the fixed period."}
          </p>
          {breakEven !== null && (
            <p className="text-base">
              Fixing comes out ahead if the variable rate averages more than{" "}
              <strong className="num">{pct(breakEven)}</strong> over the next{" "}
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
          <p className="text-base">
            Your repayment starts at <strong className="num">{moneyExact(r.planRepayment)}</strong>{" "}
            {per}
            {r.planRepayment !== r.variableRepayment && (
              <> ({moneyExact(r.variableRepayment)} all variable)</>
            )}
            . When the fix ends in {monthYear(r.fixedEndDate)}, the fixed part rolls to about{" "}
            <strong className="num">{pct(r.revertRate)}</strong>.
          </p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-warn">
              {w}
            </p>
          ))}
        </AnswerCard>
        <figure className={`${card} min-w-0 rounded-3xl`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <figcaption className="font-semibold">Interest saved by fixing</figcaption>
            <div className="flex gap-2">
              <button
                type="button"
                className={pill(range === "fix")}
                onClick={() => setRange("fix")}
              >
                Fixed period
              </button>
              <button
                type="button"
                className={pill(range === "all")}
                onClick={() => setRange("all")}
              >
                Whole loan
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
        </figure>
      </AnswerRow>
      <Controls form={form} onChange={onChange} onPath={onPath} />
      {summary}
      {ideas}
      {detail}
      <NextSteps tool="fixed" className="pt-2" />
    </div>
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
    <figure className={`${card} min-w-0 rounded-3xl`}>
      <figcaption className="mb-2 font-semibold">Interest rates</figcaption>
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
    </figure>
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
    <div className="space-y-2 text-sm text-muted">
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
        When a variable rate changes, the lender recalculates your minimum. A higher minimum is paid
        from then on; when rates fall, we assume you keep paying what you were, which is what most
        lenders do unless you ask.
      </p>
      <p>
        Real loans can differ by a few dollars because of rounding and the exact day each lender
        charges interest. This is general information, not financial advice.
      </p>
    </div>
  );
}
