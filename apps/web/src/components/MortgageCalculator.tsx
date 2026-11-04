"use client";

import {
  type Frequency,
  runScenarios,
  type ScenarioRun,
  type SimulationResult,
  validateLoan,
} from "@budgy/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { duration, money, moneyExact, monthYear, perPeriod } from "@/lib/format";
import {
  type CalculatorState,
  decodeState,
  defaultState,
  encodeState,
  MAX_SCENARIOS,
  type Scenario,
  toChanges,
  toLoanInput,
} from "@/lib/state";

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

export function MortgageCalculator() {
  const [state, setState] = useState<CalculatorState>(() => defaultState());
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read the URL once on load, then keep it in step with the inputs.
  useEffect(() => {
    if (window.location.search) setState(decodeState(window.location.search, defaultState()));
    setLoaded(true);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      window.history.replaceState(null, "", `?${encodeState(state)}`);
    }, 300);
  }, [state, loaded]);

  const { base } = state;
  const input = useMemo(() => toLoanInput(base), [base]);
  const errors = useMemo(() => validateLoan(input), [input]);

  const results = useMemo(() => {
    if (errors.length) return null;
    try {
      return runScenarios(
        input,
        state.scenarios.map((s) => toChanges(s)),
      );
    } catch {
      return null;
    }
  }, [input, errors, state.scenarios]);

  const setBase = (patch: Partial<CalculatorState["base"]>) =>
    setState((s) => ({ ...s, base: { ...s.base, ...patch } }));
  const setScenario = (i: number, patch: Partial<Scenario>) =>
    setState((s) => ({
      ...s,
      scenarios: s.scenarios.map((sc, j) => (j === i ? { ...sc, ...patch } : sc)),
    }));
  const addScenario = (preset: Omit<Scenario, "name">) =>
    setState((s) => {
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
        <a href=".." className="text-sm text-muted hover:text-text">
          ← All tools
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Mortgage what-if</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Enter your loan, then try changes. Results update as you type, and your numbers never
          leave your device.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className="space-y-4" aria-label="Your loan and scenarios">
          <div className={card}>
            <h2 className="mb-3 font-semibold">Your loan today</h2>
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
          </div>

          {state.scenarios.map((sc, i) => (
            <ScenarioCard
              key={i}
              index={i}
              scenario={sc}
              baseRatePct={base.ratePct}
              baseOffset={base.offset}
              startDate={base.startDate}
              onChange={(patch) => setScenario(i, patch)}
              onRemove={() => removeScenario(i)}
            />
          ))}

          {state.scenarios.length < MAX_SCENARIOS && (
            <div className={`${card} border-dashed`}>
              <h2 className="mb-2 text-sm font-medium">Add a scenario</h2>
              <div className="flex flex-wrap gap-2">
                {presets(base.startDate).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => addScenario(p.scenario)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addScenario({})}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                >
                  Blank
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Results ────────────────────────────────────────────── */}
        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!results ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check your loan: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results
              base={results.base}
              runs={results.scenarios}
              names={state.scenarios.map((s) => s.name)}
              frequency={base.frequency}
              onCopy={copyLink}
              copied={copied}
            />
          )}
          <Method />
        </section>
      </div>

      {results && <MobileSummary base={results.base} runs={results.scenarios} />}
    </main>
  );
}

/** Phones show the inputs first, so keep the answer in view at the bottom. */
function MobileSummary({ base, runs }: { base: SimulationResult; runs: ScenarioRun[] }) {
  const best = runs.reduce<ScenarioRun | undefined>(
    (b, r) => (!b || r.vsBase.interestSaved > b.vsBase.interestSaved ? r : b),
    undefined,
  );
  return (
    <a
      href="#results"
      className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
    >
      <span className="num min-w-0">
        Debt-free <strong>{monthYear((best?.result ?? base).payoffDate)}</strong>
        {best && best.vsBase.interestSaved > 0 && (
          <>
            {" "}
            · save <strong className="text-good">{money(best.vsBase.interestSaved)}</strong>
          </>
        )}
      </span>
      <span className="shrink-0 text-accent">See results ↓</span>
    </a>
  );
}

function ScenarioCard({
  index,
  scenario: sc,
  baseRatePct,
  baseOffset,
  startDate,
  onChange,
  onRemove,
}: {
  index: number;
  scenario: Scenario;
  baseRatePct: number;
  baseOffset: number;
  startDate: string;
  onChange: (patch: Partial<Scenario>) => void;
  onRemove: () => void;
}) {
  const nextYear = addYearsIso(startDate, 1);
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
      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label="Extra each repayment"
          optional
          placeholder="0"
          value={sc.extra}
          onChange={(extra) => onChange({ extra })}
        />
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
          <label className="col-span-2 -mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sc.lumpSum.yearly}
              onChange={(e) =>
                sc.lumpSum && onChange({ lumpSum: { ...sc.lumpSum, yearly: e.target.checked } })
              }
            />
            Repeat every year (a tax refund or bonus)
          </label>
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

function Results({
  base,
  runs,
  names,
  frequency,
  onCopy,
  copied,
}: {
  base: SimulationResult;
  runs: ScenarioRun[];
  names: string[];
  frequency: Frequency;
  onCopy: () => void;
  copied: boolean;
}) {
  const [detail, setDetail] = useState(-1);
  const series: Series[] = [
    {
      name: "Today",
      color: "var(--series-base)",
      points: base.balances,
      payoffDate: base.payoffDate,
    },
    ...runs.map((r, i) => ({
      name: names[i],
      color: COLORS[i],
      points: r.result.balances,
      payoffDate: r.result.payoffDate,
    })),
  ];
  const cols = [{ name: "Today", result: base, run: undefined as ScenarioRun | undefined }].concat(
    runs.map((r, i) => ({ name: names[i], result: r.result, run: r })),
  );
  const shown = detail < 0 ? base : (runs[detail]?.result ?? base);
  const warnings = [...new Set(cols.flatMap((c) => c.result.warnings))];

  return (
    <>
      <div className={`${card} space-y-2 text-lg leading-relaxed`}>
        {cols.map((c, i) => (
          <Headline
            key={c.name + i}
            name={c.name}
            color={i ? COLORS[i - 1] : "var(--text)"}
            result={c.result}
            run={c.run}
          />
        ))}
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Loan balance</h2>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
        <BalanceChart series={series} />
      </div>

      <div className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Side by side</h2>
        <table className="num w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 pr-3 font-medium" />
              {cols.map((c, i) => (
                <th
                  key={c.name + i}
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
                  {c.run
                    ? c.run.vsBase.daysSaved > 15
                      ? duration(c.run.vsBase.daysSaved)
                      : "–"
                    : "–"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          *At the start, including any extra. A scenario with a different repayment frequency shows
          its own per-repayment amount.
        </p>
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-semibold">Year by year</summary>
        <div className="mt-3 mb-2 flex flex-wrap gap-2">
          {cols.map((c, i) => (
            <button
              key={c.name + i}
              type="button"
              onClick={() => setDetail(i - 1)}
              className={`rounded-full border px-3 py-1 text-sm ${
                detail === i - 1 ? "border-accent text-accent" : "border-border"
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
      </details>
    </>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          This works the way Australian lenders run a variable home loan. Interest is worked out
          daily on your balance less your offset (your rate ÷ 365), and added to the loan once a
          month. Repayments fall on real calendar dates.
        </p>
        <p>
          The minimum repayment is the standard formula over the years left, rounded up to the cent.
          Fortnightly repayments are either half the monthly repayment, which most banks use, or a
          true fortnightly amount. Because a year has about 26.09 fortnights, true fortnightly and
          weekly repayments finish a little early.
        </p>
        <p>
          When the rate changes, the minimum is worked out again over the years left. If you already
          pay more than the new minimum, you keep paying the same; if you pay less, it rises to the
          minimum. Extra repayments and lump sums cut the balance on the day they are paid, and in a
          real loan usually sit in redraw.
        </p>
        <p>
          Your bank&apos;s figures may differ by a few dollars because of rounding, fees and the
          exact day it charges interest. This is general information, not financial advice.
        </p>
      </div>
    </details>
  );
}
