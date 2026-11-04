"use client";

import {
  compareSuperOrMortgage,
  rulesFor,
  SOM_MAX_PEOPLE,
  type SomOption,
  type SomWarning,
  type SuperOrMortgageResult,
  validateSuperOrMortgage,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { MoneyField, NumberField, SelectField } from "@/components/fields";
import { SavedBar } from "@/components/SavedBar";
import { duration, money, monthYear } from "@/lib/format";
import {
  applySomLoan,
  decodeSomState,
  defaultSomState,
  encodeSomState,
  newSomPerson,
  readSomLoan,
  type SomPersonRow,
  type SomState,
  type SparePer,
  spareMonthly,
  toSomInput,
} from "@/lib/superMortgageState";
import { nextId } from "@/lib/superState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const PERSON_COLORS = ["var(--series-a)", "var(--series-b)", "var(--series-base)", "var(--text)"];
const MORTGAGE_COLOR = "var(--series-c)";
const chip =
  "rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent";

const SOM_SAVED: SavedConfig<SomState> = {
  tool: "super-mortgage",
  initial: () => defaultSomState(),
  decode: (q) => decodeSomState(q),
  encode: encodeSomState,
  loan: { read: readSomLoan, apply: applySomLoan },
};

const PER_LABEL: Record<SparePer, string> = {
  week: "a week",
  fortnight: "a fortnight",
  month: "a month",
  year: "a year",
};

/** "$67,500": a headline gap, rounded to $100 so it doesn't look falsely exact. */
const roughly = (cents: number) => money(Math.round(cents / 10_000) * 10_000);
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export function SuperOrMortgage() {
  const saved = useSavedState(SOM_SAVED);
  const { state, setState } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toSomInput(state), [state]);
  const errors = useMemo(() => validateSuperOrMortgage(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return compareSuperOrMortgage(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const colorOf = (personId: string) =>
    PERSON_COLORS[
      Math.max(
        0,
        state.people.findIndex((p) => p.id === personId),
      )
    ];
  const nameOf = (personId: string) =>
    state.people.find((p) => p.id === personId)?.name || "Someone";

  const setPerson = (id: string, patch: Partial<SomPersonRow>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const setLoan = (patch: Partial<SomState["loan"]>) =>
    setState((s) => ({ ...s, loan: { ...s.loan, ...patch } }));
  const addPerson = () =>
    setState((s) => {
      const id = nextId(
        "p",
        s.people.map((p) => p.id),
      );
      return { ...s, people: [...s.people, newSomPerson(id, `Person ${s.people.length + 1}`)] };
    });
  const removePerson = (id: string) =>
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      compareTo: s.compareTo === id ? undefined : s.compareTo,
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

  const compareValue = state.compareYears !== undefined ? "years" : (state.compareTo ?? "first");
  const firstId = state.people[0]?.id;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <a href=".." className="text-sm text-muted hover:text-text">
          ← All tools
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Super or mortgage?
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          You have spare cash each month. Should it go on the home loan, or into super through
          salary sacrifice? Compare both, for everyone in your household, at retirement and every
          year before it. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className="space-y-4" aria-label="Your details">
          <div className={card}>
            <h2 className="mb-3 font-semibold">Spare cash</h2>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,150px)] items-start gap-3">
              <MoneyField
                label="Take-home pay you can spare"
                value={state.spare}
                onChange={(v) => v !== undefined && setState((s) => ({ ...s, spare: v }))}
              />
              <SelectField
                label="How often"
                value={state.sparePer}
                onChange={(sparePer) => setState((s) => ({ ...s, sparePer }))}
                options={(Object.keys(PER_LABEL) as SparePer[]).map((k) => ({
                  value: k,
                  label: PER_LABEL[k],
                }))}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              The same take-home dollars go to each option, so it&apos;s a fair test.
            </p>
          </div>

          {state.people.map((p, i) => (
            <PersonCard
              key={p.id}
              person={p}
              color={PERSON_COLORS[i]}
              onChange={(patch) => setPerson(p.id, patch)}
              onRemove={state.people.length > 1 ? () => removePerson(p.id) : undefined}
            />
          ))}
          {state.people.length < SOM_MAX_PEOPLE && (
            <button type="button" onClick={addPerson} className={chip}>
              + Add a person
            </button>
          )}

          <div className={card}>
            <h2 className="mb-3 font-semibold">Home loan</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                label="Owing"
                value={state.loan.balance}
                onChange={(v) => v !== undefined && setLoan({ balance: v })}
              />
              <NumberField
                label="Rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={state.loan.ratePct}
                onChange={(v) => v !== undefined && setLoan({ ratePct: v })}
              />
              <NumberField
                label="Years left"
                min={1}
                max={40}
                step={1}
                value={state.loan.termYears}
                onChange={(v) => v !== undefined && setLoan({ termYears: v })}
              />
              <MoneyField
                label="Offset balance"
                value={state.loan.offset}
                onChange={(v) => setLoan({ offset: v ?? 0 })}
              />
              <SelectField
                className="col-span-2"
                label="Repayments"
                value={state.loan.frequency}
                onChange={(frequency) => setLoan({ frequency })}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "fortnightly", label: "Fortnightly" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-3 font-semibold">Assumptions</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Super return"
                suffix="%"
                min={-10}
                max={20}
                step={0.1}
                value={state.superReturnPct}
                onChange={(v) => v !== undefined && setState((s) => ({ ...s, superReturnPct: v }))}
              />
              <NumberField
                label="Inflation"
                suffix="%"
                min={0}
                max={20}
                step={0.1}
                value={state.inflationPct}
                onChange={(v) => v !== undefined && setState((s) => ({ ...s, inflationPct: v }))}
              />
              <SelectField
                className="col-span-2"
                label="Compare until"
                value={compareValue}
                onChange={(v) =>
                  setState((s) =>
                    v === "years"
                      ? {
                          ...s,
                          compareYears: Math.min(
                            60,
                            Math.max(1, Math.round(s.people[0].retireAge - s.people[0].age)),
                          ),
                        }
                      : {
                          ...s,
                          compareYears: undefined,
                          compareTo: v === "first" ? undefined : v,
                        },
                  )
                }
                options={[
                  ...state.people.map((p) => ({
                    value: p.id === firstId ? "first" : p.id,
                    label: `${p.name || "Someone"} retires`,
                  })),
                  { value: "years", label: "A number of years" },
                ]}
              />
              {state.compareYears !== undefined && (
                <NumberField
                  label="Years"
                  min={1}
                  max={60}
                  step={1}
                  value={state.compareYears}
                  onChange={(v) => v !== undefined && setState((s) => ({ ...s, compareYears: v }))}
                />
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              Super return is after fees and tax, as your fund reports it. Tax uses{" "}
              {result?.taxYear ?? "this year's"} ATO rates.
            </p>
          </div>
        </section>

        {/* ── Results ────────────────────────────────────────────── */}
        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!result ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check the inputs: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results
              result={result}
              state={state}
              colorOf={colorOf}
              nameOf={nameOf}
              onCopy={copyLink}
              copied={copied}
            />
          )}
          <Method />
        </section>
      </div>

      {result && result.best.gain > 0 && (
        <a
          href="#results"
          className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
        >
          <span className="num min-w-0">
            {short(result.best, nameOf)},{" "}
            <strong>+{roughly(result.best.gain - rival(result).gain)}</strong>
          </span>
          <span className="shrink-0 text-accent">See results ↓</span>
        </a>
      )}
    </main>
  );
}

function PersonCard({
  person: p,
  color,
  onChange,
  onRemove,
}: {
  person: SomPersonRow;
  color: string;
  onChange: (patch: Partial<SomPersonRow>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className={card} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="Name"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus:underline"
          value={p.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-muted hover:text-warn">
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label="Salary a year"
          hint="Before tax, without super."
          value={p.salary}
          onChange={(v) => v !== undefined && onChange({ salary: v })}
        />
        <MoneyField
          label="Already sacrificing"
          hint="A year."
          value={p.sacrificing}
          onChange={(v) => onChange({ sacrificing: v ?? 0 })}
        />
        <NumberField
          label="Age"
          min={15}
          max={99}
          step={1}
          value={p.age}
          onChange={(v) => v !== undefined && onChange({ age: v })}
        />
        <NumberField
          label="Retire at"
          min={16}
          max={100}
          step={1}
          value={p.retireAge}
          onChange={(v) => v !== undefined && onChange({ retireAge: v })}
        />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">
          Super balance, HELP debt, private cover
        </summary>
        <div className="mt-3 space-y-3">
          <MoneyField
            label="Super balance"
            hint="Under $500,000 lets you use unused cap from the last five years."
            value={p.superBalance}
            onChange={(v) => onChange({ superBalance: v ?? 0 })}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.help}
              onChange={(e) => onChange({ help: e.target.checked })}
            />
            Has a HELP or other study loan
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.privateCover}
              onChange={(e) => onChange({ privateCover: e.target.checked })}
            />
            Has private hospital cover
          </label>
        </div>
      </details>
    </div>
  );
}

const short = (o: SomOption, nameOf: (id: string) => string) =>
  o.kind === "mortgage" ? "Extra repayments" : `${nameOf(o.personId)}'s super`;

/** The option the best one is measured against: the mortgage, or the best super option. */
function rival(r: SuperOrMortgageResult): SomOption {
  return r.best.kind === "super"
    ? r.mortgage
    : (r.options.find((o) => o.kind === "super") ?? r.best);
}

function Results({
  result: r,
  state,
  colorOf,
  nameOf,
  onCopy,
  copied,
}: {
  result: SuperOrMortgageResult;
  state: SomState;
  colorOf: (id: string) => string;
  nameOf: (id: string) => string;
  onCopy: () => void;
  copied: boolean;
}) {
  const [view, setView] = useState<"gain" | "reachable">("gain");
  const supers = r.options.filter((o) => o.kind === "super");
  const bestSuper = supers[0];
  const endYear = r.endDate.slice(0, 4);
  const spare = spareMonthly(state);

  if (spare <= 0) {
    return (
      <div className={`${card} text-lg`}>
        Enter how much take-home pay you can spare to compare super with the mortgage.
      </div>
    );
  }

  const gap = r.best.gain - rival(r).gain;
  const superWins = r.best.kind === "super";
  const sac = bestSuper?.sacrifice;
  const lineColor = (o: SomOption) =>
    o.kind === "mortgage" ? MORTGAGE_COLOR : colorOf(o.personId);
  const series: Series[] = [r.mortgage, ...supers].map((o) => ({
    name: o.kind === "mortgage" ? "Extra repayments" : `Into ${nameOf(o.personId)}'s super`,
    color: lineColor(o),
    points: o.rows.map((row) => ({ date: row.date, balance: row[view] })),
    payoffDate: r.endDate,
  }));

  // Every five years, and the end.
  const rows = r.mortgage.rows
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => i > 0 && (row.year % 5 === 0 || i === r.mortgage.rows.length - 1));

  const ppy = { weekly: 52, fortnightly: 26, monthly: 12 }[state.loan.frequency];
  const freedMonthly = (r.baseLoan.repayment * ppy) / 12 + spare;

  return (
    <>
      <div className={`${card} space-y-2`}>
        <p className="text-sm text-muted">By {endYear}, in today&apos;s dollars</p>
        <p className="text-xl leading-relaxed">
          {gap <= 0 ? (
            <>Both come out about even.</>
          ) : superWins ? (
            <>
              Salary sacrificing into{" "}
              <strong style={{ color: colorOf(r.best.personId) }}>
                {nameOf(r.best.personId)}&apos;s super
              </strong>{" "}
              comes out <strong className="num text-good">{roughly(gap)} ahead</strong> of extra
              mortgage repayments.
            </>
          ) : (
            <>
              <strong style={{ color: MORTGAGE_COLOR }}>Extra mortgage repayments</strong> come out{" "}
              <strong className="num text-good">{roughly(gap)} ahead</strong> of putting it into{" "}
              {nameOf(rival(r).personId)}&apos;s super.
            </>
          )}
        </p>
        {r.breakEvenReturn !== null && (
          <p className="text-muted">
            {superWins ? "Super wins as long as it earns more than " : "Super would need to earn "}
            <strong className="num text-text">{pct(r.breakEvenReturn)} a year</strong>
            {superWins ? "." : " to win."}
            {sac && sac.sacrifice > 0 && (
              <>
                {" "}
                Your loan costs {pct(state.loan.ratePct / 100)}, but sacrificing saves{" "}
                {nameOf(bestSuper.personId)} about{" "}
                {Math.round((sac.taxSaved / sac.sacrifice) * 100)}c in tax on every dollar and super
                takes {Math.round((sac.contributionsTax / sac.sacrifice) * 100)}c.
              </>
            )}
          </p>
        )}
        {r.warnings.map((w) => (
          <p key={JSON.stringify(w)} className="text-sm text-warn">
            {warningText(w, nameOf, r)}
          </p>
        ))}
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {r.options.map((o, i) => (
          <li
            key={`${o.kind}${o.personId}`}
            className={`rounded-xl bg-surface p-4 ${
              i === 0 ? "border-2 border-good" : "border border-border"
            }`}
          >
            <p
              className={`text-xs font-semibold tracking-wide ${i === 0 ? "text-good" : "text-muted"}`}
            >
              {i === 0 ? "BEST" : i === 1 ? "2ND" : i === 2 ? "3RD" : `${i + 1}TH`}
            </p>
            <p className="mt-1 font-semibold" style={{ color: lineColor(o) }}>
              {o.kind === "mortgage" ? "Extra repayments" : `Into ${nameOf(o.personId)}'s super`}
            </p>
            <p className="num mt-2 text-2xl font-semibold">{money(o.gain)}</p>
            <p className="mt-1 text-sm text-muted">
              {o.kind === "mortgage" ? (
                <>
                  Loan gone {monthYear(o.loanPaidOff)}
                  {r.monthsSooner > 0 && <>, {duration(r.monthsSooner * 30.4375)} sooner</>}. Saves{" "}
                  {money(r.interestSaved)} interest.
                </>
              ) : (
                <>
                  Sacrifice {money(o.sacrifice?.sacrifice ?? 0)} a year
                  {(o.sacrifice?.afterTax ?? 0) >= 100 &&
                    ` and ${money(o.sacrifice?.afterTax ?? 0)} after tax`}
                  .
                </>
              )}
            </p>
          </li>
        ))}
      </ol>

      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">How far ahead, year by year</h2>
          <div className="flex flex-wrap gap-2">
            <fieldset className="flex gap-1 text-sm">
              <legend className="sr-only">Show</legend>
              {(
                [
                  ["gain", "Total"],
                  ["reachable", "What you can reach"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full border px-3 py-1 ${
                    view === v ? "border-accent text-accent" : "border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent"
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
        <BalanceChart
          series={series}
          markEnd
          label="How far ahead each option is, each year, in today's dollars"
        />
        <p className="text-xs text-muted">
          {view === "gain"
            ? "Ahead of spending the money: a smaller loan, plus extra super. The extra repayments line moves into super once the loan's gone."
            : "Only what you could get at that year: money in the loan, plus super once its owner can draw it."}
        </p>
      </div>

      {bestSuper && (
        <div className={card}>
          <h2 className="font-semibold">In between: what you could get at</h2>
          <p className="mb-3 text-sm text-muted">
            Super is locked until 65, or until you retire after 60. Money on the loan you can redraw
            or get back by selling.
          </p>
          <div className="overflow-x-auto">
            <table className="num w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
                  <th className="text-left">Year</th>
                  <th>Extra repayments</th>
                  <th>{nameOf(bestSuper.personId)}&apos;s super</th>
                  <th>Most you can reach</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td]:text-right">
                {rows.map(({ row, i }) => {
                  const s = bestSuper.rows[i];
                  // The option you could get the most from that year.
                  const top = r.options.reduce((m, o) =>
                    o.rows[i].reachable > m.rows[i].reachable ? o : m,
                  );
                  return (
                    <tr key={row.date}>
                      <td className="!text-left">{row.date.slice(0, 4)}</td>
                      <td>{money(row.gain)}</td>
                      <td>{money(s.gain)}</td>
                      <td className="text-good">
                        {top.kind === "mortgage" ? "Repayments" : `${nameOf(top.personId)}'s super`}
                        , {money(top.rows[i].reachable)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bestSuper && sac && (
        <div className={card}>
          <h2 className="mb-3 font-semibold">Where {money(spare)} a month goes</h2>
          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold" style={{ color: colorOf(bestSuper.personId) }}>
                {nameOf(bestSuper.personId)} salary sacrifices
              </p>
              <dl className="num grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
                <dt className="text-muted">Sacrificed before tax</dt>
                <dd>{money(sac.sacrifice)} a year</dd>
                <dt className="text-muted">Tax {nameOf(bestSuper.personId)} no longer pays</dt>
                <dd>− {money(sac.taxSaved)}</dd>
                <dt className="text-muted">Costs in take-home pay</dt>
                <dd>{money(sac.takeHome - sac.afterTax)}</dd>
                {sac.afterTax >= 100 && (
                  <>
                    <dt className="text-muted">Over the cap, put in after tax</dt>
                    <dd>{money(sac.afterTax)}</dd>
                  </>
                )}
                <dt className="text-muted">Contributions tax</dt>
                <dd>− {money(sac.contributionsTax)}</dd>
                <dt className="font-semibold">Lands in super</dt>
                <dd className="font-semibold">{money(sac.intoSuper)}</dd>
              </dl>
            </div>
            <div>
              <p className="mb-2 font-semibold" style={{ color: MORTGAGE_COLOR }}>
                Extra repayments
              </p>
              <dl className="num grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
                <dt className="text-muted">On the loan</dt>
                <dd>{money(spare * 12)} a year</dd>
                <dt className="text-muted">Earns, risk free</dt>
                <dd>{pct(state.loan.ratePct / 100)} a year</dd>
                <dt className="text-muted">Loan gone</dt>
                <dd>{monthYear(r.mortgage.loanPaidOff)}</dd>
                <dt className="text-muted">Then into super</dt>
                <dd>{money(freedMonthly)} a month</dd>
                <dt className="font-semibold">Interest saved</dt>
                <dd className="font-semibold">{money(r.interestSaved)}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}

      <WorthKnowing result={r} breakEven={r.breakEvenReturn} startDate={state.startDate} />
    </>
  );
}

function warningText(
  w: SomWarning,
  nameOf: (id: string) => string,
  r: SuperOrMortgageResult,
): string {
  switch (w.kind) {
    case "over-cap":
      return `${nameOf(w.personId)} reaches the concessional cap, so ${money(w.afterTax)} a year goes in after tax instead, with no tax saving.`;
    case "division-293":
      return `${nameOf(w.personId)} pays Division 293 tax, another ${money(w.extra)} a year on the sacrifice. It's included.`;
    case "locked":
      return `${nameOf(w.personId)} can't reach their super until ${w.releaseAge}, after ${r.endDate.slice(0, 4)}.`;
    case "rules-carried-forward":
      return `This uses the ${w.year} super rules, the latest published.`;
    case "loan":
      return w.message;
  }
}

function WorthKnowing({
  result: r,
  breakEven,
  startDate,
}: {
  result: SuperOrMortgageResult;
  breakEven: number | null;
  startDate: string;
}) {
  const rules = rulesFor(startDate).rules;
  return (
    <div className={`${card} text-sm text-muted`}>
      <h2 className="mb-2 font-semibold text-text">Worth knowing</h2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          Super returns go up and down; the loan rate is a sure thing.
          {breakEven !== null && ` A cautious fund may earn less than ${pct(breakEven)}.`}
        </li>
        <li>
          Salary sacrifice counts toward the $
          {(rules.concessionalCap / 100).toLocaleString("en-AU")} concessional cap in {rules.year},
          along with employer super. Anything over it goes in after tax here.
        </li>
        <li>
          An offset account saves the same interest as extra repayments, and keeps the money to
          hand.
        </li>
        <li>
          Compared over {r.years} years. General information, not financial advice. Age Pension not
          included. Sources:{" "}
          <a className="text-accent hover:underline" href={rules.sources[1]}>
            ATO contribution caps
          </a>
          .
        </li>
      </ul>
    </div>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Each option uses the same take-home dollars every month. On the mortgage, they go on the
          loan as extra repayments, which are charged interest daily like a lender does. Once the
          loan is gone, the repayment it frees up and the spare cash go into super through whoever
          gets the most in per dollar, until the original loan would have ended. After that, just
          the spare cash does.
        </p>
        <p>
          Into super, we find the salary sacrifice that costs exactly that much take-home pay, using
          this year&apos;s tax, Medicare and HELP rates. It loses 15% contributions tax on the way
          in, more with Division 293, less with the low income super tax offset. Past the
          concessional cap, the rest goes in after tax. It grows at your super return.
        </p>
        <p>
          Each option&apos;s figure is how far ahead it puts you compared with spending the money: a
          smaller loan, plus extra super, in today&apos;s dollars. Tax is worked out on this
          year&apos;s pay for every year, which leans slightly toward the mortgage.
        </p>
      </div>
    </details>
  );
}
