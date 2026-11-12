"use client";

import {
  type Cents,
  type Frequency,
  type LoanInput,
  runScenarios,
  type ScenarioRun,
  type SimulationResult,
  simulateLoan,
  toDay,
  toIso,
  validateLoan,
} from "@budgy/engine";
import { useId, useMemo, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { NextSteps } from "@/components/NextSteps";
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
import { duration, money, moneyExact, monthYear, perPeriod } from "@/lib/format";
import { OWN_LINK_PARAM, withLoanFields } from "@/lib/saved";
import { encodeSplitState, splitFromBaseLoan } from "@/lib/splitState";
import {
  type CalculatorState,
  decodeState,
  defaultState,
  encodeState,
  MAX_INTEREST_ONLY_YEARS,
  MAX_SCENARIOS,
  type Scenario,
  toChanges,
  toLoanInput,
} from "@/lib/state";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const COLORS = ["var(--series-a)", "var(--series-b)", "var(--series-c)"];
const LETTERS = "ABC";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "weekly", label: "Weekly" },
];

function addYearsIso(iso: string, years: number) {
  return `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;
}

function presets(start: string): { label: string; scenario: Omit<Scenario, "name"> }[] {
  return [
    { label: "+$200 a repayment", scenario: { extra: 200 } },
    { label: "Move $20k into offset", scenario: { offset: 20_000 } },
    {
      label: "Rates up 0.5%",
      scenario: { rateChange: { date: addYearsIso(start, 1), ratePct: NaN } },
    },
    {
      label: "$10k bonus each year",
      scenario: { lumpSum: { amount: 10_000, date: addYearsIso(start, 1), yearly: true } },
    },
  ];
}

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const chip =
  "min-h-10 rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent";

const MORTGAGE_SAVED: SavedConfig<CalculatorState> = {
  tool: "mortgage",
  initial: () => defaultState(),
  decode: (q) => decodeState(q, defaultState()),
  encode: encodeState,
  loan: {
    read: ({ base }) => base,
    apply: (s, loan) => ({ ...s, base: withLoanFields(s.base, loan) }),
  },
};

export function MortgageCalculator() {
  const saved = useSavedState(MORTGAGE_SAVED);
  const { state, setState } = saved;
  const { ref: sheet, open: edit } = useEditSheet();
  const { idea, toggle } = useIdea<"offset" | "compare">();
  const [spare, setSpare] = useState<number | undefined>(20_000);

  const { base } = state;
  const input = useMemo(() => toLoanInput(base), [base]);
  const errors = useMemo(() => validateLoan(input), [input]);

  const results = useMemo(() => {
    if (errors.length) return null;
    try {
      return runScenarios(
        input,
        state.scenarios.map((s) => toChanges(s, base.termYears)),
      );
    } catch {
      return null;
    }
  }, [input, errors, state.scenarios, base.termYears]);
  const offsetRuns = useOffsetRuns(input, results ? spare : undefined);

  const setBase = (patch: Partial<CalculatorState["base"]>) =>
    setState((s) => ({ ...s, base: { ...s.base, ...patch } }));
  const setScenario = (i: number, patch: Partial<Scenario>) =>
    setState((s) => ({
      ...s,
      scenarios: s.scenarios.map((sc, j) => (j === i ? { ...sc, ...patch } : sc)),
    }));
  const addScenario = (preset: Omit<Scenario, "name">) =>
    setState((s) => {
      if (s.scenarios.length >= MAX_SCENARIOS) return s;
      const name = `Scenario ${LETTERS[s.scenarios.length]}`;
      const sc: Scenario = { name, ...preset };
      if (sc.rateChange && Number.isNaN(sc.rateChange.ratePct)) {
        sc.rateChange = {
          ...sc.rateChange,
          ratePct: Math.round((s.base.ratePct + 0.5) * 100) / 100,
        };
      }
      return { ...s, scenarios: [...s.scenarios, sc] };
    });
  const removeScenario = (i: number) =>
    setState((s) => ({
      ...s,
      scenarios: s.scenarios
        .filter((_, j) => j !== i)
        .map((sc, j) =>
          /^Scenario [ABC]$/.test(sc.name) ? { ...sc, name: `Scenario ${LETTERS[j]}` } : sc,
        ),
    }));

  const names = state.scenarios.map((s) => s.name);
  const cols: Col[] = results
    ? [{ name: "Today", result: results.base, run: undefined } as Col].concat(
        results.scenarios.map((r, i) => ({ name: names[i], result: r.result, run: r })),
      )
    : [];
  const atMax = state.scenarios.length >= MAX_SCENARIOS;
  const presetChips = (
    <div className="flex flex-wrap gap-2">
      {presets(base.startDate).map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => addScenario(p.scenario)}
          className={chip}
        >
          {p.label}
        </button>
      ))}
      <button type="button" onClick={() => addScenario({})} className={chip}>
        Blank
      </button>
    </div>
  );

  const offsetSaved = offsetRuns
    ? offsetRuns.base.totalInterest - offsetRuns.offset.totalInterest
    : null;
  const pair = results && results.scenarios.length >= 2 ? results.scenarios.slice(0, 2) : null;

  return (
    <ToolPage>
      <ToolHeader
        title="Mortgage what-if"
        intro="See how a change to your home loan moves your interest and your debt-free date."
        saved={saved}
      />

      <div className="space-y-8">
        <ToolSection id="loan-h" title="Your loan">
          <SummaryRows>
            <SummaryRow
              title="Your loan today"
              hint={`${money(Math.round(base.balance * 100))} · ${base.ratePct}% · ${base.termYears} yrs${
                results
                  ? ` · ${moneyExact(results.base.repayment)} ${perPeriod[base.frequency]}`
                  : ""
              }`}
              onClick={() => edit("loan")}
            />
          </SummaryRows>
        </ToolSection>

        {!results ? (
          <div className={`${card} text-warn`}>
            {errors.length
              ? `Check your loan: ${errors.join("; ")}.`
              : "Something in the inputs doesn't add up."}{" "}
            <button type="button" onClick={() => edit("loan")} className="text-accent underline">
              Edit your loan
            </button>
          </div>
        ) : (
          <>
            <ToolSection id="try-h" title="Try a change">
              {atMax ? (
                <p className="text-sm text-muted">
                  You&apos;re comparing {MAX_SCENARIOS} changes. Remove one below to try another.
                </p>
              ) : (
                presetChips
              )}
              <AnswerRow>
                <AnswerCard label={answerLabel(results.scenarios, names)}>
                  <Answer base={results.base} runs={results.scenarios} names={names} />
                </AnswerCard>
                <figure className={`${card} min-w-0 rounded-3xl`}>
                  <figcaption className="mb-2 font-semibold">Loan balance</figcaption>
                  <BalanceChart series={chartSeries(cols)} />
                </figure>
              </AnswerRow>
            </ToolSection>

            {state.scenarios.length > 0 && (
              <ToolSection id="changes-h" title="Your changes">
                <div className="grid gap-4 lg:grid-cols-2">
                  {state.scenarios.map((sc, i) => (
                    <ScenarioCard
                      key={i}
                      index={i}
                      scenario={sc}
                      baseRatePct={base.ratePct}
                      baseOffset={base.offset}
                      termYears={base.termYears}
                      startDate={base.startDate}
                      onChange={(patch) => setScenario(i, patch)}
                      onRemove={() => removeScenario(i)}
                    />
                  ))}
                </div>
              </ToolSection>
            )}

            <Ideas
              cards={
                <>
                  <IdeaCard
                    title="Offset or extra repayment?"
                    open={idea === "offset"}
                    onClick={() => toggle("offset")}
                  >
                    {offsetSaved !== null ? (
                      <>
                        {money(Math.round((spare ?? 0) * 100))} saves about{" "}
                        <strong className="num text-good">{money(offsetSaved)}</strong> in interest
                        either way.
                      </>
                    ) : (
                      "Keep spare money in your offset or pay it into the loan, and see what each saves."
                    )}
                  </IdeaCard>
                  <IdeaCard
                    title="Compare two changes"
                    open={idea === "compare"}
                    onClick={() => toggle("compare")}
                  >
                    {pair ? (
                      <>
                        <strong style={{ color: COLORS[0] }}>{names[0]}</strong> saves{" "}
                        <strong className="num text-good">
                          {money(pair[0].vsBase.interestSaved)}
                        </strong>
                        , <strong style={{ color: COLORS[1] }}>{names[1]}</strong>{" "}
                        <strong className="num text-good">
                          {money(pair[1].vsBase.interestSaved)}
                        </strong>
                        .
                      </>
                    ) : (
                      "Add a second change and see both against today on the chart."
                    )}
                  </IdeaCard>
                </>
              }
            >
              {idea === "offset" && (
                <OffsetVsRedraw amount={spare} onAmount={setSpare} runs={offsetRuns} />
              )}
              {idea === "compare" && (
                <div className={`${card} space-y-3`}>
                  <p className="text-sm text-muted">
                    Each change is worked out against your loan today, so you can line them up on
                    the chart and in &ldquo;Side by side&rdquo; below.
                  </p>
                  {atMax ? (
                    <p className="text-sm">
                      You&apos;re comparing {MAX_SCENARIOS} changes. Remove one to try another.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Add another change</p>
                      {presetChips}
                    </>
                  )}
                </div>
              )}
            </Ideas>

            <Detail>
              <Disclosure title="Side by side" hint="today and each change">
                <SideBySide cols={cols} frequency={base.frequency} />
              </Disclosure>
              <Disclosure title="Year by year" hint="interest, principal and balance">
                <YearByYear cols={cols} />
              </Disclosure>
              <Disclosure title="Good to know" hint="tips and things to check">
                <GoodToKnow tool="mortgage" bare />
              </Disclosure>
              <Disclosure title="How this is calculated" hint="daily interest, offsets and extras">
                <Method />
              </Disclosure>
            </Detail>
            <NextSteps tool="mortgage" className="pt-2" />
          </>
        )}
      </div>

      <EditSheet ref={sheet} title="Your loan today">
        <div id="loan" className="scroll-mt-20">
          <div className="grid grid-cols-2 gap-3">
            <MoneyField
              className="col-span-2"
              label="Loan balance"
              hint="What you owe now, not the original loan."
              value={base.balance}
              onChange={(v) => v !== undefined && setBase({ balance: v })}
            />
            <NumberField
              label="Interest rate"
              suffix="%"
              min={0}
              max={20}
              step={0.01}
              value={base.ratePct}
              onChange={(v) => v !== undefined && setBase({ ratePct: v })}
            />
            <NumberField
              label="Years left"
              suffix="yrs"
              min={1}
              max={40}
              step={1}
              value={base.termYears}
              onChange={(v) => v !== undefined && setBase({ termYears: v })}
            />
            <SelectField
              label="Repayments"
              value={base.frequency}
              options={FREQUENCIES}
              onChange={(frequency) => setBase({ frequency })}
            />
            <MoneyField
              label="Offset balance"
              value={base.offset}
              onChange={(v) => setBase({ offset: v ?? 0 })}
            />
            {base.frequency === "fortnightly" && (
              <SelectField
                className="col-span-2"
                label="How your bank sets fortnightly repayments"
                hint="Most banks halve the monthly amount, which adds about one extra monthly repayment a year."
                value={base.fortnightlyMethod}
                options={[
                  { value: "half-monthly", label: "Half the monthly repayment (most common)" },
                  { value: "true", label: "True fortnightly amount" },
                ]}
                onChange={(fortnightlyMethod) => setBase({ fortnightlyMethod })}
              />
            )}
            <DateField
              className="col-span-2"
              label="Starting from"
              hint="Usually today. Your next repayment is one period after this."
              value={base.startDate}
              onChange={(startDate) => setBase({ startDate })}
            />
          </div>
          <a
            href={`../split/?${encodeSplitState(splitFromBaseLoan(base))}&${OWN_LINK_PARAM}=1`}
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Sharing this loan? Split it between borrowers →
          </a>
        </div>
      </EditSheet>
    </ToolPage>
  );
}

interface Col {
  name: string;
  result: SimulationResult;
  run?: ScenarioRun;
}

function chartSeries(cols: Col[]): Series[] {
  return cols.map((c, i) => ({
    name: c.name,
    color: i ? COLORS[i - 1] : "var(--series-base)",
    points: c.result.balances,
    payoffDate: c.result.payoffDate,
  }));
}

/** The scenario that saves the most interest leads the answer. */
function bestRun(runs: ScenarioRun[]) {
  let best = -1;
  runs.forEach((r, i) => {
    if (best < 0 || r.vsBase.interestSaved > runs[best].vsBase.interestSaved) best = i;
  });
  return best;
}

function answerLabel(runs: ScenarioRun[], names: string[]) {
  const i = bestRun(runs);
  return i < 0 ? "Your loan today" : names[i];
}

function Answer({
  base,
  runs,
  names,
}: {
  base: SimulationResult;
  runs: ScenarioRun[];
  names: string[];
}) {
  const bi = bestRun(runs);
  const warnings = [...new Set([base, ...runs.map((r) => r.result)].flatMap((r) => r.warnings))];
  const rest = runs.map((r, i) => ({ r, i })).filter(({ i }) => i !== bi);
  const best = bi >= 0 ? runs[bi] : undefined;
  return (
    <>
      {best ? (
        <>
          <p className="text-sm font-semibold text-on-primary-container">
            {best.vsBase.interestSaved >= 0 ? "Interest saved" : "Extra interest"}
          </p>
          <p
            className={`num -mt-2 text-4xl leading-none font-bold tracking-tight sm:text-5xl ${
              best.vsBase.interestSaved < 0 ? "text-warn" : ""
            }`}
          >
            {money(Math.abs(best.vsBase.interestSaved))}
          </p>
          <p className="text-lg">
            Debt-free in <strong>{monthYear(best.result.payoffDate)}</strong>
            {best.vsBase.daysSaved > 15 && (
              <>
                , <strong className="text-good">{duration(best.vsBase.daysSaved)} sooner</strong>
              </>
            )}
            {best.vsBase.daysSaved < -15 && <>, {duration(-best.vsBase.daysSaved)} later</>}
            {Math.abs(best.vsBase.daysSaved) <= 15 && <>, about the same time</>}. Today it&apos;s{" "}
            {monthYear(base.payoffDate)}, paying{" "}
            <strong className="num">{money(base.totalInterest)}</strong> in interest.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-on-primary-container">Debt-free</p>
          <p className="num -mt-2 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
            {monthYear(base.payoffDate)}
          </p>
          <p className="text-lg">
            Paying <strong className="num">{money(base.totalInterest)}</strong> in interest. Pick a
            change above to see what it saves.
          </p>
        </>
      )}
      {rest.length > 0 && (
        <div className="space-y-1 border-t border-on-primary-container/20 pt-3">
          {rest.map(({ r, i }) => (
            <Headline key={i} name={names[i]} color={COLORS[i]} result={r.result} run={r} />
          ))}
        </div>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-sm text-warn">
          {w}
        </p>
      ))}
    </>
  );
}

function SideBySide({ cols, frequency }: { cols: Col[]; frequency: Frequency }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1.5 pr-3 font-medium" />
            {cols.map((c, i) => (
              <th
                key={i}
                className="py-1.5 pr-3 text-right font-medium"
                style={{ color: i ? COLORS[i - 1] : undefined }}
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
          <tr>
            <td>Repayment {perPeriod[frequency]}*</td>
            {cols.map((c, i) => (
              <td key={i}>{moneyExact(c.result.repayment)}</td>
            ))}
          </tr>
          {cols.some((c) => c.result.afterInterestOnly) && (
            <tr>
              <td>Repayment after interest only*</td>
              {cols.map((c, i) => (
                <td key={i}>
                  {c.result.afterInterestOnly
                    ? `${moneyExact(c.result.afterInterestOnly.repayment)} from ${monthYear(c.result.afterInterestOnly.date)}`
                    : "–"}
                </td>
              ))}
            </tr>
          )}
          <tr>
            <td>Debt-free</td>
            {cols.map((c, i) => (
              <td key={i}>{monthYear(c.result.payoffDate)}</td>
            ))}
          </tr>
          <tr>
            <td>Total interest</td>
            {cols.map((c, i) => (
              <td key={i}>{money(c.result.totalInterest)}</td>
            ))}
          </tr>
          <tr>
            <td>Total repaid</td>
            {cols.map((c, i) => (
              <td key={i}>{money(c.result.totalPaid)}</td>
            ))}
          </tr>
          <tr>
            <td>Interest saved</td>
            {cols.map((c, i) => (
              <td key={i}>{c.run ? money(c.run.vsBase.interestSaved) : "–"}</td>
            ))}
          </tr>
          <tr>
            <td>Time saved</td>
            {cols.map((c, i) => (
              <td key={i}>
                {c.run && c.run.vsBase.daysSaved > 15 ? duration(c.run.vsBase.daysSaved) : "–"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        *At the start, including any extra. A scenario with a different repayment frequency shows
        its own per-repayment amount. After an interest-only period the repayment is worked out on
        the balance at the time, over the years left, before any extra.
      </p>
    </div>
  );
}

function YearByYear({ cols }: { cols: Col[] }) {
  const [detail, setDetail] = useState(0);
  const shown = (cols[detail] ?? cols[0]).result;
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        {cols.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setDetail(i)}
            className={`rounded-full border px-3 py-1 text-sm ${
              detail === i ? "border-accent text-accent" : "border-border"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
              <th className="text-left">Year</th>
              <th>Interest</th>
              <th>Principal</th>
              <th>Balance at end</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-3 [&_td]:text-right">
            {shown.yearly.map((y) => (
              <tr key={y.year}>
                <td className="!text-left">
                  {y.year} <span className="text-muted">({y.endDate.slice(0, 7)})</span>
                </td>
                <td>{money(y.interest)}</td>
                <td>{money(y.principal)}</td>
                <td>{money(y.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScenarioCard({
  index,
  scenario: sc,
  baseRatePct,
  baseOffset,
  termYears,
  startDate,
  onChange,
  onRemove,
}: {
  index: number;
  scenario: Scenario;
  baseRatePct: number;
  baseOffset: number;
  termYears: number;
  startDate: string;
  onChange: (patch: Partial<Scenario>) => void;
  onRemove: () => void;
}) {
  const nextYear = addYearsIso(startDate, 1);
  const hasOther = Boolean(
    sc.offset !== undefined ||
      sc.offsetDeposit ||
      sc.lumpSum ||
      sc.rateChange ||
      sc.interestOnlyYears ||
      sc.frequency,
  );
  // Open from the start when a preset or shared link set something beyond the extra repayment.
  const [more, setMore] = useState(hasOther);
  const moreId = useId();
  return (
    <div className={card} style={{ borderLeft: `4px solid ${COLORS[index]}` }}>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="Scenario name"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus:underline"
          value={sc.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button type="button" onClick={onRemove} className="text-sm text-muted hover:text-warn">
          Remove
        </button>
      </div>
      <MoneyField
        label="Extra each repayment"
        optional
        placeholder="0"
        value={sc.extra}
        onChange={(extra) => onChange({ extra })}
      />
      <button
        type="button"
        aria-expanded={more}
        aria-controls={moreId}
        onClick={() => setMore((m) => !m)}
        className="mt-3 min-h-10 text-sm font-semibold text-accent hover:underline"
      >
        {more ? "Fewer changes" : "More changes"}
      </button>
      <div id={moreId} hidden={!more} className="mt-2 grid grid-cols-2 gap-3">
        <MoneyField
          label="Offset balance"
          optional
          placeholder={baseOffset.toLocaleString("en-AU")}
          hint="Blank keeps your current offset."
          value={sc.offset}
          onChange={(offset) => onChange({ offset })}
        />
        <MoneyField
          className="col-span-2"
          label="Added to offset each month"
          optional
          placeholder="0"
          value={sc.offsetDeposit}
          onChange={(offsetDeposit) => onChange({ offsetDeposit })}
        />
        <MoneyField
          label="Lump sum"
          optional
          placeholder="0"
          value={sc.lumpSum?.amount}
          onChange={(amount) =>
            onChange({
              lumpSum: amount
                ? { date: nextYear, yearly: false, ...sc.lumpSum, amount }
                : undefined,
            })
          }
        />
        {sc.lumpSum ? (
          <DateField
            label="Paid on"
            value={sc.lumpSum.date}
            onChange={(date) => sc.lumpSum && onChange({ lumpSum: { ...sc.lumpSum, date } })}
          />
        ) : (
          <div />
        )}
        {sc.lumpSum && (
          <Checkbox
            className="col-span-2 -mt-1 flex items-center gap-2 text-sm"
            isSelected={sc.lumpSum.yearly}
            onChange={(v) => sc.lumpSum && onChange({ lumpSum: { ...sc.lumpSum, yearly: v } })}
          >
            Repeat every year (a tax refund or bonus)
          </Checkbox>
        )}
        <NumberField
          label="New interest rate"
          suffix="%"
          optional
          min={0}
          max={20}
          step={0.01}
          placeholder={String(baseRatePct)}
          value={sc.rateChange?.ratePct}
          onChange={(ratePct) =>
            onChange({
              rateChange:
                ratePct === undefined ? undefined : { date: nextYear, ...sc.rateChange, ratePct },
            })
          }
        />
        {sc.rateChange ? (
          <DateField
            label="From"
            value={sc.rateChange.date}
            onChange={(date) =>
              sc.rateChange && onChange({ rateChange: { ...sc.rateChange, date } })
            }
          />
        ) : (
          <div />
        )}
        {sc.rateChange && sc.rateChange.ratePct < baseRatePct && (
          <SelectField
            className="col-span-2"
            label="When the rate falls"
            hint="Lenders often lower your minimum. Paying the same clears the loan sooner."
            value={sc.rateChange.followMinimum ? "minimum" : "keep"}
            options={[
              { value: "keep", label: "Keep paying the same" },
              { value: "minimum", label: "Pay the new, lower minimum" },
            ]}
            onChange={(v) =>
              sc.rateChange &&
              onChange({
                rateChange: {
                  date: sc.rateChange.date,
                  ratePct: sc.rateChange.ratePct,
                  ...(v === "minimum" ? { followMinimum: true } : {}),
                },
              })
            }
          />
        )}
        <NumberField
          className="col-span-2"
          label="Interest only for"
          suffix="yrs"
          optional
          placeholder="0"
          hint="Repayments cover interest only, then jump to principal and interest over the rest of the term."
          min={0}
          max={Math.max(0, Math.min(MAX_INTEREST_ONLY_YEARS, termYears - 1))}
          step={1}
          value={sc.interestOnlyYears}
          onChange={(v) => onChange({ interestOnlyYears: v ? v : undefined })}
        />
        <SelectField
          className="col-span-2"
          label="Repayments"
          value={sc.frequency ?? ("same" as Frequency)}
          options={[{ value: "same" as Frequency, label: "Same as my loan" }, ...FREQUENCIES]}
          onChange={(f) => onChange({ frequency: (f as string) === "same" ? undefined : f })}
        />
      </div>
    </div>
  );
}

function Headline({
  name,
  color,
  result,
  run,
}: {
  name: string;
  color: string;
  result: SimulationResult;
  run?: ScenarioRun;
}) {
  if (!run) {
    return (
      <p>
        <span className="font-semibold">Today:</span> debt-free in{" "}
        <strong>{monthYear(result.payoffDate)}</strong>, paying{" "}
        <strong className="num">{money(result.totalInterest)}</strong> in interest.
      </p>
    );
  }
  const { daysSaved, interestSaved } = run.vsBase;
  const sooner = daysSaved > 15;
  const later = daysSaved < -15;
  return (
    <p>
      <span className="font-semibold" style={{ color }}>
        {name}:
      </span>{" "}
      debt-free in <strong>{monthYear(result.payoffDate)}</strong>
      {sooner && <>, {duration(daysSaved)} sooner</>}
      {later && <>, {duration(daysSaved)} later</>}
      {!sooner && !later && <>, about the same time</>}.{" "}
      {interestSaved >= 0 ? (
        <>
          You save <strong className="num text-good">{money(interestSaved)}</strong> in interest.
        </>
      ) : (
        <>
          You pay <strong className="num text-warn">{money(-interestSaved)}</strong> more interest.
        </>
      )}
    </p>
  );
}

function Method() {
  return (
    <div className="space-y-2 text-sm text-muted">
      <p>
        This works the way Australian lenders run a variable home loan. Interest is worked out daily
        on your balance less your offset (your rate ÷ 365), and added to the loan once a month.
        Repayments fall on real calendar dates.
      </p>
      <p>
        The minimum repayment is the standard formula over the years left, rounded up to the cent.
        Fortnightly repayments are either half the monthly repayment, which most banks use, or a
        true fortnightly amount. Because a year has about 26.09 fortnights, true fortnightly and
        weekly repayments finish a little early.
      </p>
      <p>
        When the rate changes, the minimum is worked out again over the years left. If you already
        pay more than the new minimum, you keep paying the same, unless you pick the new, lower
        minimum when the rate falls. If you pay less, it rises to the minimum. Extra repayments and
        lump sums cut the balance on the day they are paid, and in a real loan usually sit in
        redraw.
      </p>
      <p>
        Your bank&apos;s figures may differ by a few dollars because of rounding, fees and the exact
        day it charges interest. This is general information, not financial advice.
      </p>
    </div>
  );
}

/**
 * The same spare money two ways: sitting in the offset, or paid into the loan
 * (where it can be redrawn). The simulation charges interest daily on the
 * balance less the offset, so both save about the same interest. What differs
 * is access and a few lender rules, which the list below sets out.
 */
function useOffsetRuns(input: LoanInput, amount: number | undefined) {
  const spare = Math.round((amount ?? 0) * 100) as Cents;
  return useMemo(() => {
    if (spare <= 0 || spare >= input.balance) return null;
    try {
      const base = simulateLoan(input);
      const offset = simulateLoan({
        ...input,
        offsetBalance: ((input.offsetBalance ?? 0) + spare) as Cents,
      });
      // Paid into the loan on the first day, then repayments carry on as before.
      const redraw = simulateLoan({
        ...input,
        lumpSums: [
          ...(input.lumpSums ?? []),
          { date: toIso(toDay(input.startDate) + 1), amount: spare },
        ],
      });
      return { base, offset, redraw };
    } catch {
      return null;
    }
  }, [input, spare]);
}

function OffsetVsRedraw({
  amount,
  onAmount,
  runs,
}: {
  amount: number | undefined;
  onAmount: (v: number | undefined) => void;
  runs: ReturnType<typeof useOffsetRuns>;
}) {
  return (
    <div className={card}>
      <p className="text-sm text-muted">
        The same spare money, kept in your offset account or paid into the loan (where it can be
        redrawn). Uses your loan today, and your current repayment stays the same.
      </p>
      <div className="mt-3 max-w-xs">
        <MoneyField label="Spare money" value={amount} onChange={onAmount} optional />
      </div>
      {runs ? (
        <div className="mt-3 overflow-x-auto">
          <table className="num w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 pr-3 font-medium" />
                <th className="py-1.5 pr-3 text-right font-medium">In offset</th>
                <th className="py-1.5 pr-3 text-right font-medium">Extra repayment</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
              <tr>
                <td>Total interest</td>
                <td>{money(runs.offset.totalInterest)}</td>
                <td>{money(runs.redraw.totalInterest)}</td>
              </tr>
              <tr>
                <td>Interest saved</td>
                <td>{money(runs.base.totalInterest - runs.offset.totalInterest)}</td>
                <td>{money(runs.base.totalInterest - runs.redraw.totalInterest)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            {Math.abs(runs.offset.totalInterest - runs.redraw.totalInterest) <
            Math.max(100_00, runs.base.totalInterest * 0.002) ? (
              <>The interest saved is about the same either way.</>
            ) : (
              <>The two differ by more than rounding, so check the inputs.</>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Enter an amount below your loan balance.</p>
      )}
      <p className="mt-3 text-sm font-medium">Where they differ</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>
          <strong className="text-text">Access.</strong> Offset money stays in an account you can
          spend from any time. Money paid into the loan has to be redrawn, and lenders set their own
          rules for how and when. Offset money also stays out of the loan balance, so the loan
          itself only falls when you use that money to repay it.
        </li>
        <li>
          <strong className="text-text">Tax.</strong> On a home you live in, the interest you avoid
          isn&apos;t income, so neither option is taxed. On an investment loan, redrawing money for
          personal use can mix private and investment purposes, which can affect the interest you
          can claim. An offset leaves the loan balance alone.
        </li>
        <li>
          <strong className="text-text">Your repayment.</strong> Some lenders lower the minimum
          repayment after extra repayments, others keep it the same. An offset doesn&apos;t change
          it. This comparison keeps your repayment the same.
        </li>
        <li>
          <strong className="text-text">Your loan.</strong> Not every loan has an offset, and fixed
          loans often limit offsets and extra repayments. Check your loan&apos;s terms.
        </li>
      </ul>
    </div>
  );
}
