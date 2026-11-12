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
import { GoodToKnow } from "@/components/GoodToKnow";
import { NextSteps } from "@/components/NextSteps";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  EditSheet,
  SummaryRow,
  SummaryRows,
  ToolHeader,
  ToolPage,
  ToolSection,
  tonalBtn,
  useEditSheet,
} from "@/components/tool";
import { duration, money, monthYear } from "@/lib/format";
import { SOM_PEOPLE } from "@/lib/household";
import { isYou, objectName, possessive, verb } from "@/lib/names";
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
import { Checkbox } from "./ui";

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
  people: SOM_PEOPLE,
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
  const { ref: sheet, open: edit } = useEditSheet();

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

  const compareValue = state.compareYears !== undefined ? "years" : (state.compareTo ?? "first");
  const firstId = state.people[0]?.id;

  return (
    <ToolPage>
      <ToolHeader
        title="Super or mortgage?"
        intro="Whether your spare cash does more on the home loan or in super through salary sacrifice."
        saved={saved}
        actions={
          <button type="button" onClick={() => edit()} className={tonalBtn}>
            Edit your numbers
          </button>
        }
      />

      <div className="space-y-8">
        {!result ? (
          <div className={`${card} text-warn`}>
            {errors.length
              ? `Check the inputs: ${errors.join("; ")}.`
              : "Something in the inputs doesn't add up."}{" "}
            <button type="button" onClick={() => edit()} className="text-accent underline">
              Edit your numbers
            </button>
          </div>
        ) : (
          <Results
            result={result}
            state={state}
            colorOf={colorOf}
            nameOf={nameOf}
            onEdit={edit}
            onAddPerson={
              state.people.length < SOM_MAX_PEOPLE
                ? () => {
                    addPerson();
                    edit();
                  }
                : undefined
            }
          />
        )}
      </div>

      <EditSheet ref={sheet} title="Your numbers">
        <div id="spare" className={`${card} scroll-mt-20`}>
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
          <div key={p.id} id={`person-${p.id}`} className="scroll-mt-20">
            <PersonCard
              person={p}
              color={PERSON_COLORS[i]}
              onChange={(patch) => setPerson(p.id, patch)}
              onRemove={state.people.length > 1 ? () => removePerson(p.id) : undefined}
            />
          </div>
        ))}
        {state.people.length < SOM_MAX_PEOPLE && (
          <button type="button" onClick={addPerson} className={chip}>
            + Add a person
          </button>
        )}

        <div id="loan" className={`${card} scroll-mt-20`}>
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

        <div id="assumptions" className={`${card} scroll-mt-20`}>
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
      </EditSheet>
    </ToolPage>
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
          <Checkbox
            className="flex items-center gap-2"
            isSelected={p.help}
            onChange={(v) => onChange({ help: v })}
          >
            Has a HELP or other study loan
          </Checkbox>
          <Checkbox
            className="flex items-center gap-2"
            isSelected={p.privateCover}
            onChange={(v) => onChange({ privateCover: v })}
          >
            Has private hospital cover
          </Checkbox>
        </div>
      </details>
    </div>
  );
}

const short = (o: SomOption, nameOf: (id: string) => string) =>
  o.kind === "mortgage" ? "Extra repayments" : `${possessive(nameOf(o.personId), true)} super`;

/** The option the best one is measured against: the mortgage, or the best super option. */
function rival(r: SuperOrMortgageResult): SomOption {
  return r.best.kind === "super"
    ? r.mortgage
    : (r.options.find((o) => o.kind === "super") ?? r.best);
}

const dollars = (n: number) => money(Math.round(n * 100));

function Results({
  result: r,
  state,
  colorOf,
  nameOf,
  onEdit,
  onAddPerson,
}: {
  result: SuperOrMortgageResult;
  state: SomState;
  colorOf: (id: string) => string;
  nameOf: (id: string) => string;
  onEdit: (focusId?: string) => void;
  onAddPerson?: () => void;
}) {
  const [view, setView] = useState<"gain" | "reachable">("gain");
  const supers = r.options.filter((o) => o.kind === "super");
  const bestSuper = supers[0];
  const endYear = r.endDate.slice(0, 4);
  const spare = spareMonthly(state);

  if (spare <= 0) {
    return (
      <div className={`${card} text-lg`}>
        Enter how much take-home pay you can spare to compare super with the mortgage.{" "}
        <button type="button" onClick={() => onEdit("spare")} className="text-accent underline">
          Edit your numbers
        </button>
      </div>
    );
  }

  const gap = r.best.gain - rival(r).gain;
  const superWins = r.best.kind === "super";
  const sac = bestSuper?.sacrifice;
  const lineColor = (o: SomOption) =>
    o.kind === "mortgage" ? MORTGAGE_COLOR : colorOf(o.personId);
  const series: Series[] = [r.mortgage, ...supers].map((o) => ({
    name:
      o.kind === "mortgage" ? "Extra repayments" : `Into ${possessive(nameOf(o.personId))} super`,
    color: lineColor(o),
    points: o.rows.map((row) => ({ date: row.date, balance: row[view] })),
    payoffDate: r.endDate,
  }));

  // Every five years, and the end.
  const rows = r.mortgage.rows
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => i > 0 && (row.year % 5 === 0 || i === r.mortgage.rows.length - 1));

  // Extra repayments' reachable money falls once the freed repayments go into locked super.
  const reachDips = r.mortgage.rows.some(
    (row, i) => i > 0 && row.reachable < r.mortgage.rows[i - 1].reachable - 100,
  );

  // Options within a dollar of each other share a place.
  const places: number[] = [];
  r.options.forEach((o, i) => {
    places.push(i > 0 && r.options[i - 1].gain - o.gain < 100 ? places[i - 1] : i);
  });
  const tied = (i: number) => places.filter((p) => p === places[i]).length > 1;
  const placeLabel = (i: number) =>
    `${["Best", "2nd", "3rd"][places[i]] ?? `${places[i] + 1}th`}${tied(i) ? ", tied" : ""}`;

  const ppy = { weekly: 52, fortnightly: 26, monthly: 12 }[state.loan.frequency];
  const freedMonthly = (r.baseLoan.repayment * ppy) / 12 + spare;
  const optionName = (o: SomOption) =>
    o.kind === "mortgage" ? "Extra repayments" : `Into ${possessive(nameOf(o.personId))} super`;

  const loan = state.loan;
  const compareHint =
    state.compareYears !== undefined ? `${state.compareYears} years` : `until ${endYear}`;

  return (
    <>
      <AnswerRow>
        <AnswerCard label={`Best home for ${money(spare)} a month: ${short(r.best, nameOf)}`}>
          {gap <= 0 ? (
            <p className="num text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Both about even
            </p>
          ) : (
            <>
              <p className="num -mt-1 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
                {roughly(gap)} ahead
              </p>
              <p className="text-lg">
                {superWins ? (
                  <>
                    of extra repayments by {endYear}, in today&apos;s dollars. Salary sacrificing
                    into{" "}
                    <strong style={{ color: colorOf(r.best.personId) }}>
                      {possessive(nameOf(r.best.personId))} super
                    </strong>{" "}
                    wins.
                  </>
                ) : (
                  <>
                    of putting it into {possessive(nameOf(rival(r).personId))} super by {endYear},
                    in today&apos;s dollars.
                  </>
                )}
              </p>
            </>
          )}
          <ol className="space-y-2">
            {r.options.map((o, i) => (
              <li
                key={`${o.kind}${o.personId}`}
                className={`rounded-xl bg-surface p-3 text-sm ${
                  places[i] === 0 ? "border-2 border-good" : "border border-border"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    <span className="num text-muted">{i + 1}. </span>
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: lineColor(o) }}
                    />
                    {optionName(o)}
                    <span className="ml-2 text-xs font-medium text-muted">{placeLabel(i)}</span>
                  </span>
                  <span className="num text-lg font-semibold">{money(o.gain)}</span>
                </div>
                <p className="mt-1 text-muted">
                  {o.kind === "mortgage" ? (
                    <>
                      Loan gone {monthYear(o.loanPaidOff)}
                      {r.monthsSooner > 0 && <>, {duration(r.monthsSooner * 30.4375)} sooner</>}.
                      Saves {money(r.interestSaved)} interest.
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
          {r.breakEvenReturn !== null && (
            <p className="text-sm">
              {superWins
                ? "Super wins as long as it earns more than "
                : "Super would need to earn "}
              <strong className="num">{pct(r.breakEvenReturn)} a year</strong>
              {superWins ? "." : " to win."}
              {sac && sac.sacrifice > 0 && (
                <>
                  {" "}
                  Your loan costs {pct(state.loan.ratePct / 100)}, but sacrificing saves{" "}
                  {objectName(nameOf(bestSuper.personId))} about{" "}
                  {Math.round((sac.taxSaved / sac.sacrifice) * 100)}c in tax on every dollar and
                  super takes {Math.round((sac.contributionsTax / sac.sacrifice) * 100)}c.
                </>
              )}
            </p>
          )}
          {r.warnings.map((w) => (
            <p key={JSON.stringify(w)} className="text-sm text-warn">
              {warningText(w, nameOf, r)}
            </p>
          ))}
        </AnswerCard>

        <figure className={`${card} min-w-0 rounded-3xl`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <figcaption className="font-semibold">How far ahead, year by year</figcaption>
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
        </figure>
      </AnswerRow>

      <ToolSection
        id="numbers-h"
        title="Your numbers"
        action={
          onAddPerson && (
            <button
              type="button"
              onClick={onAddPerson}
              className="text-sm font-semibold text-accent hover:underline"
            >
              + Add a person
            </button>
          )
        }
      >
        <SummaryRows>
          <SummaryRow
            title="Spare cash"
            hint={`${dollars(state.spare)} ${PER_LABEL[state.sparePer]}`}
            onClick={() => onEdit("spare")}
          />
          {state.people.map((p) => (
            <SummaryRow
              key={p.id}
              title={p.name || "Someone"}
              color={colorOf(p.id)}
              hint={`${dollars(p.salary)} a year · age ${p.age} · retires at ${p.retireAge}`}
              onClick={() => onEdit(`person-${p.id}`)}
            />
          ))}
          <SummaryRow
            title="Home loan"
            hint={`${dollars(loan.balance)} · ${loan.ratePct}% · ${loan.termYears} yrs`}
            onClick={() => onEdit("loan")}
          />
          <SummaryRow
            title="Assumptions"
            hint={`super ${state.superReturnPct}% · inflation ${state.inflationPct}% · ${compareHint}`}
            onClick={() => onEdit("assumptions")}
          />
        </SummaryRows>
      </ToolSection>

      <Detail>
        {bestSuper && sac && (
          <Disclosure title={`Where ${money(spare)} a month goes`} hint="tax, super and the loan">
            <div className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-2 font-semibold" style={{ color: colorOf(bestSuper.personId) }}>
                  {nameOf(bestSuper.personId)}{" "}
                  {verb(nameOf(bestSuper.personId), "salary sacrifices", "salary sacrifice")}
                </p>
                <dl className="num grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
                  <dt className="text-muted">Sacrificed before tax</dt>
                  <dd>{money(sac.sacrifice)} a year</dd>
                  <dt className="text-muted">
                    Tax {objectName(nameOf(bestSuper.personId))} no longer{" "}
                    {verb(nameOf(bestSuper.personId), "pays", "pay")}
                  </dt>
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
          </Disclosure>
        )}
        {bestSuper && (
          <Disclosure title="In between" hint="what you could get at before 60">
            <p className="mb-3 text-sm text-muted">
              Super is locked until 65, or until you retire after 60. Money on the loan you can
              redraw or get back by selling.
            </p>
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
                    <th className="text-left">Year</th>
                    <th>Extra repayments</th>
                    <th>{possessive(nameOf(bestSuper.personId), true)} super</th>
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
                          {top.kind === "mortgage"
                            ? "Repayments"
                            : `${possessive(nameOf(top.personId), true)} super`}
                          , {money(top.rows[i].reachable)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reachDips && (
              <p className="mt-3 text-xs text-muted">
                Once the loan&apos;s gone in {monthYear(r.mortgage.loanPaidOff)}, the repayments you
                no longer make go into {nameOf(r.mortgage.personId)}&apos;s super, so they&apos;re
                locked away until {nameOf(r.mortgage.personId)} can draw it. That&apos;s why what
                you can reach from extra repayments falls in later years. Keep some in redraw or
                savings if you might need it before then.
              </p>
            )}
          </Disclosure>
        )}
        <Disclosure title="Good to know" hint="tips and things to check">
          <GoodToKnow
            tool="super-mortgage"
            bare
            extra={worthKnowing(r, r.breakEvenReturn, state.startDate)}
          />
        </Disclosure>
        <Disclosure title="How this is calculated" hint="the same take-home dollars">
          <Method />
        </Disclosure>
      </Detail>
      <NextSteps tool="super-mortgage" className="pt-2" />
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
      return `${nameOf(w.personId)} ${verb(nameOf(w.personId), "reaches", "reach")} the concessional cap, so ${money(w.afterTax)} a year goes in after tax instead, with no tax saving.`;
    case "division-293":
      return `${nameOf(w.personId)} ${verb(nameOf(w.personId), "pays", "pay")} Division 293 tax, another ${money(w.extra)} a year on the sacrifice. It's included.`;
    case "locked":
      return `${nameOf(w.personId)} can't reach ${isYou(nameOf(w.personId)) ? "your" : "their"} super until ${w.releaseAge}, after ${r.endDate.slice(0, 4)}.`;
    case "rules-carried-forward":
      return `This uses the ${w.year} super rules, the latest published.`;
    case "loan":
      return w.message;
  }
}

/** Tips that depend on this result, merged ahead of the general ones. */
function worthKnowing(
  r: SuperOrMortgageResult,
  breakEven: number | null,
  startDate: string,
): React.ReactNode[] {
  const rules = rulesFor(startDate).rules;
  return [
    <>
      Super returns go up and down; the loan rate is a sure thing.
      {breakEven !== null && ` A cautious fund may earn less than ${pct(breakEven)}.`}
    </>,
    <>
      Salary sacrifice counts toward the ${(rules.concessionalCap / 100).toLocaleString("en-AU")}{" "}
      concessional cap in {rules.year}, along with employer super. Anything over it goes in after
      tax here.
    </>,
    <>
      An offset account saves the same interest as extra repayments, and keeps the money to hand.
    </>,
    <>
      Compared over {r.years} years. Age Pension not included. Sources:{" "}
      <a className="text-accent hover:underline" href={rules.sources[1]}>
        ATO contribution caps
      </a>
      .
    </>,
  ];
}

function Method() {
  return (
    <div className="space-y-2 text-sm text-muted">
      <p>
        Each option uses the same take-home dollars every month. On the mortgage, they go on the
        loan as extra repayments, which are charged interest daily like a lender does. Once the loan
        is gone, the repayment it frees up and the spare cash go into super through whoever gets the
        most in per dollar, until the original loan would have ended. After that, just the spare
        cash does.
      </p>
      <p>
        Into super, we find the salary sacrifice that costs exactly that much take-home pay, using
        this year&apos;s tax, Medicare and HELP rates. It loses 15% contributions tax on the way in,
        more with Division 293, less with the low income super tax offset. Past the concessional
        cap, the rest goes in after tax. It grows at your super return.
      </p>
      <p>
        Each option&apos;s figure is how far ahead it puts you compared with spending the money: a
        smaller loan, plus extra super, in today&apos;s dollars. Tax is worked out on this
        year&apos;s pay for every year, which leans slightly toward the mortgage.
      </p>
      <p>
        &quot;What you can reach&quot; is the part of that figure you could get at in that year, in
        today&apos;s dollars. It counts how much lower the loan is than it would have been without
        the extra repayments, which you could get back through redraw, an offset or selling. Super
        counts as zero until its owner can get at it (65, or when they retire after 60), then it
        counts in full. It can fall once the loan is paid off. The loan you&apos;d otherwise have
        kept is itself shrinking by then, so there&apos;s less of a head start to count, and the
        repayments freed up go into super that&apos;s still locked away.
      </p>
    </div>
  );
}
