"use client";

import {
  AGE_PENSION_RULES,
  type AgePensionResult,
  agePension,
  type Cents,
  extraContributionEffect,
  type HouseholdYear,
  MAX_ACCOUNTS,
  MAX_PEOPLE,
  type PersonProjection,
  projectSuper,
  rulesFor,
  type SuperInput,
  type SuperResult,
  validateSuper,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { DateField, MoneyField, NumberField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { SavedBar } from "@/components/SavedBar";
import { money, moneyExact, monthYear } from "@/lib/format";
import { SUPER_PEOPLE } from "@/lib/household";
import {
  type AccountRow,
  decodeSuperState,
  defaultSuperState,
  encodeSuperState,
  newAccount,
  newPerson,
  nextId,
  type PensionRow,
  type PersonRow,
  type SuperState,
  toSuperInput,
} from "@/lib/superState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const COLORS = ["var(--series-a)", "var(--series-b)", "var(--series-c)", "var(--series-base)"];
const chip =
  "rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent";

const seg = (on: boolean) =>
  `min-h-11 px-4 text-sm font-medium transition ${on ? "bg-accent text-on-accent" : "bg-surface hover:text-accent"}`;
const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

const SUPER_SAVED: SavedConfig<SuperState> = {
  tool: "super",
  initial: () => defaultSuperState(),
  decode: (q) => decodeSuperState(q),
  encode: encodeSuperState,
  people: SUPER_PEOPLE,
};

export function SuperCalculator() {
  const saved = useSavedState(SUPER_SAVED);
  const { state, setState } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toSuperInput(state), [state]);
  const errors = useMemo(() => validateSuper(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return projectSuper(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const setPerson = (id: string, patch: Partial<PersonRow>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const setAccount = (pid: string, aid: string, patch: Partial<AccountRow>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id !== pid
          ? p
          : {
              ...p,
              accounts: p.accounts.map((a) =>
                a.id === aid
                  ? { ...a, ...patch }
                  : patch.employer
                    ? { ...a, employer: false } // only one account gets employer super
                    : a,
              ),
            },
      ),
    }));
  const addAccount = (pid: string) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id !== pid
          ? p
          : {
              ...p,
              accounts: [
                ...p.accounts,
                newAccount(
                  nextId(
                    `${p.id}a`,
                    p.accounts.map((a) => a.id),
                  ),
                  `Fund ${p.accounts.length + 1}`,
                ),
              ],
            },
      ),
    }));
  const removeAccount = (pid: string, aid: string) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => {
        if (p.id !== pid) return p;
        const accounts = p.accounts.filter((a) => a.id !== aid);
        if (!accounts.some((a) => a.employer)) accounts[0] = { ...accounts[0], employer: true };
        return { ...p, accounts };
      }),
    }));
  const addPerson = () =>
    setState((s) => {
      const id = nextId(
        "p",
        s.people.map((p) => p.id),
      );
      return { ...s, people: [...s.people, newPerson(id, `Person ${s.people.length + 1}`)] };
    });
  const removePerson = (id: string) =>
    setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const sg = rulesFor(state.startDate).rules.sgRate * 100;

  // The Age Pension on super at retirement, in today's dollars. Only for a
  // single person or a couple: more people aren't one pension household.
  const pension = useMemo((): AgePensionResult | null => {
    if (!result || state.people.length > 2) return null;
    const super_ = result.householdAtRetirementReal;
    const financial = (super_ + toCents(state.pension.savings)) as Cents;
    try {
      return agePension({
        couple: state.people.length === 2,
        homeowner: state.pension.homeowner,
        assets: (financial + toCents(state.pension.otherAssets)) as Cents,
        financialAssets: financial,
        otherIncomeFortnight: toCents(state.pension.otherIncome),
      });
    } catch {
      return null;
    }
  }, [result, state.people.length, state.pension]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Super at retirement</h1>
        <p className="mt-1 max-w-2xl text-muted">
          How much super will you have, and what income could it pay? Add everyone in your household
          and all their funds. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className="space-y-4" aria-label="People and super funds">
          {state.people.map((p, i) => (
            <PersonCard
              key={p.id}
              person={p}
              color={COLORS[i]}
              sg={sg}
              onChange={(patch) => setPerson(p.id, patch)}
              onAccount={(aid, patch) => setAccount(p.id, aid, patch)}
              onAddAccount={p.accounts.length < MAX_ACCOUNTS ? () => addAccount(p.id) : undefined}
              onRemoveAccount={(aid) => removeAccount(p.id, aid)}
              onRemove={state.people.length > 1 ? () => removePerson(p.id) : undefined}
            />
          ))}
          {state.people.length < MAX_PEOPLE && (
            <button type="button" onClick={addPerson} className={chip}>
              + Person
            </button>
          )}

          <PensionCard
            pension={state.pension}
            couple={state.people.length === 2}
            people={state.people.length}
            onChange={(patch) => setState((s) => ({ ...s, pension: { ...s.pension, ...patch } }))}
          />

          <div className={card}>
            <h2 className="mb-3 font-semibold">Assumptions</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Wage growth"
                suffix="%"
                min={0}
                max={20}
                step={0.1}
                value={state.wageGrowthPct}
                onChange={(v) => v !== undefined && setState((s) => ({ ...s, wageGrowthPct: v }))}
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
              <NumberField
                label="Income lasts until age"
                min={60}
                max={110}
                step={1}
                value={state.incomeUntil}
                onChange={(v) => v !== undefined && setState((s) => ({ ...s, incomeUntil: v }))}
              />
              <DateField
                label="Starting from"
                value={state.startDate}
                onChange={(startDate) => setState((s) => ({ ...s, startDate }))}
              />
            </div>
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
              input={input}
              state={state}
              onExtra={(extraPerWeek) => setState((s) => ({ ...s, extraPerWeek }))}
              onCopy={copyLink}
              copied={copied}
              pension={
                pension && (
                  <PensionResults
                    pension={pension}
                    assets={toCents(
                      result.householdAtRetirementReal / 100 +
                        state.pension.savings +
                        state.pension.otherAssets,
                    )}
                    couple={state.people.length === 2}
                    homeowner={state.pension.homeowner}
                  />
                )
              }
            />
          )}
          <GoodToKnow tool="super" />
          <Method />
        </section>
      </div>

      {result && (
        <a
          href="#results"
          className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
        >
          <span className="num min-w-0">
            About <strong>{money(result.householdIncomePerYear)}</strong> a year in retirement
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
  sg,
  onChange,
  onAccount,
  onAddAccount,
  onRemoveAccount,
  onRemove,
}: {
  person: PersonRow;
  color: string;
  sg: number;
  onChange: (patch: Partial<PersonRow>) => void;
  onAccount: (aid: string, patch: Partial<AccountRow>) => void;
  onAddAccount?: () => void;
  onRemoveAccount: (aid: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className={card} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="Name"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus:underline"
          value={p.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-muted hover:text-warn">
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Age now"
          min={15}
          max={100}
          step={1}
          value={p.age}
          onChange={(v) => v !== undefined && onChange({ age: v })}
        />
        <NumberField
          label="Retire at"
          min={15}
          max={100}
          step={1}
          value={p.retireAge}
          onChange={(v) => v !== undefined && onChange({ retireAge: v })}
        />
        <MoneyField
          label="Salary"
          hint="A year, before tax."
          value={p.salary}
          optional
          placeholder="0"
          onChange={(v) => onChange({ salary: v ?? 0 })}
        />
        <NumberField
          label="Employer pays"
          suffix="%"
          optional
          min={0}
          max={50}
          step={0.5}
          placeholder={`${sg} (SG)`}
          hint="Blank = the super guarantee."
          value={p.employerPct}
          onChange={(employerPct) => onChange({ employerPct })}
        />
      </div>

      <div className="mt-4 space-y-3">
        {p.accounts.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                aria-label="Fund name"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:underline"
                value={a.name}
                maxLength={40}
                onChange={(e) => onAccount(a.id, { name: e.target.value })}
              />
              {p.accounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveAccount(a.id)}
                  className="text-xs text-muted hover:text-warn"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                label="Balance"
                value={a.balance}
                onChange={(v) => v !== undefined && onAccount(a.id, { balance: v })}
              />
              <NumberField
                label="Return"
                suffix="%"
                min={-20}
                max={20}
                step={0.1}
                hint="After investment fees and tax."
                value={a.returnPct}
                onChange={(v) => v !== undefined && onAccount(a.id, { returnPct: v })}
              />
              <MoneyField
                label="Admin fee"
                hint="Dollars a year."
                value={a.feeFixed}
                optional
                placeholder="0"
                onChange={(v) => onAccount(a.id, { feeFixed: v ?? 0 })}
              />
              <NumberField
                label="Plus a % fee"
                suffix="%"
                min={0}
                max={5}
                step={0.01}
                hint="Of the balance a year."
                value={a.feePct}
                onChange={(v) => v !== undefined && onAccount(a.id, { feePct: v })}
              />
              <MoneyField
                label="Salary sacrifice"
                hint="A month, before tax."
                optional
                placeholder="0"
                value={a.sacrifice}
                onChange={(sacrifice) => onAccount(a.id, { sacrifice })}
              />
              <MoneyField
                label="After-tax top-up"
                hint="A month."
                optional
                placeholder="0"
                value={a.afterTax}
                onChange={(afterTax) => onAccount(a.id, { afterTax })}
              />
              {p.accounts.length > 1 && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`employer-${p.id}`}
                    checked={a.employer}
                    onChange={() => onAccount(a.id, { employer: true })}
                  />
                  Employer super goes into this fund
                </label>
              )}
            </div>
          </div>
        ))}
        {onAddAccount && (
          <button type="button" onClick={onAddAccount} className={chip}>
            + Another fund
          </button>
        )}
      </div>
    </div>
  );
}

function Results({
  result,
  input,
  state,
  onExtra,
  onCopy,
  copied,
  pension,
}: {
  result: SuperResult;
  input: SuperInput;
  state: SuperState;
  onExtra: (v: number) => void;
  onCopy: () => void;
  copied: boolean;
  pension?: React.ReactNode;
}) {
  const { people } = result;
  const many = people.length > 1;
  const series: Series[] = people.map((p, i) => ({
    name: p.name,
    color: COLORS[i],
    points: p.years.map((y) => ({ date: y.date, balance: y.real })),
    payoffDate: p.retireDate,
  }));
  if (many) {
    const h = result.household;
    series.unshift({
      name: "Household",
      color: "var(--text)",
      points: h.map((y) => ({ date: y.date, balance: y.total })),
      payoffDate: h[h.length - 1].date,
    });
  }
  const warnings = people.flatMap((p) => p.warnings.map((w) => `${p.name}: ${w}`));
  const latest = rulesFor(state.startDate).rules;

  return (
    <>
      <div className={`${card} space-y-2 text-lg leading-relaxed`}>
        {many && (
          <p>
            Together you&apos;d retire with{" "}
            <strong className="num">{money(result.householdAtRetirementReal)}</strong> in super,
            enough for about{" "}
            <strong className="num text-good">{money(result.householdIncomePerYear)}</strong> a year
            until age {state.incomeUntil}.
          </p>
        )}
        {people.map((p, i) => (
          <p key={p.id}>
            <span className="font-semibold" style={{ color: many ? COLORS[i] : undefined }}>
              {p.name}
            </span>{" "}
            {p.yearsToRetire > 0 ? (
              <>
                retires in {monthYear(p.retireDate)} with{" "}
                <strong className="num">{money(p.atRetirementReal)}</strong>
              </>
            ) : (
              <>
                has <strong className="num">{money(p.atRetirementReal)}</strong>
              </>
            )}
            , about <strong className="num">{money(p.incomePerYear)}</strong> a year.
          </p>
        ))}
        <p className="text-sm text-muted">
          All in today&apos;s dollars, after {state.inflationPct}% inflation a year.
        </p>
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      {pension}

      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Super balance, in today&apos;s dollars</h2>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
        <BalanceChart
          series={series}
          markEnd
          label="Super balance over time for the household and each person"
        />
        {many && (
          <p className="text-xs text-muted">
            Household adds everyone&apos;s super together. Each person&apos;s line ends when they
            retire. After that, the household total counts them drawing their retirement income.
          </p>
        )}
      </div>

      <Extra input={input} people={people} perWeek={state.extraPerWeek} onChange={onExtra} />

      <div className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Where it comes from</h2>
        <table className={`num w-full text-sm ${people.length > 2 ? "min-w-[460px]" : ""}`}>
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 pr-3 font-medium" />
              {people.map((p, i) => (
                <th
                  key={p.id}
                  className="py-1.5 pr-3 text-right font-medium"
                  style={{ color: COLORS[i] }}
                >
                  {p.name}
                </th>
              ))}
              {many && <th className="py-1.5 pr-3 text-right font-semibold">Household</th>}
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
            {(
              [
                ["Balance today", (p) => p.years[0].total],
                ["Employer contributions", (p) => p.employerTotal],
                ["Your contributions", (p) => p.personalTotal],
                ["Contributions tax", (p) => -p.contributionsTax],
                ["Admin fees", (p) => -p.fees],
                ["Investment earnings", (p) => p.earnings],
                ["At retirement (future dollars)", (p) => p.atRetirement],
                ["At retirement (today's dollars)", (p) => p.atRetirementReal],
                ["Income a year (today's dollars)", (p) => p.incomePerYear],
              ] as [string, (p: PersonProjection) => number][]
            ).map(([label, value]) => {
              const show = (v: number) => (v < 0 ? `−${money(-v)}` : money(v));
              return (
                <tr key={label}>
                  <td>{label}</td>
                  {people.map((p) => (
                    <td key={p.id}>{show(value(p))}</td>
                  ))}
                  {many && (
                    <td className="font-semibold">
                      {show(people.reduce((s, p) => s + value(p), 0))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Contributions and earnings are in future dollars, as they&apos;re paid.
        </p>
      </div>

      <YearByYear people={people} household={result.household} />

      <div className={`${card} text-sm text-muted`}>
        Rules used: {result.rulesYears.join(", ")}. Super guarantee {latest.sgRate * 100}%,
        concessional cap ${(latest.concessionalCap / 100).toLocaleString("en-AU")} in {latest.year}.
        {result.rulesCarriedForward &&
          ` Later years grow the ${result.rulesYears.at(-1)} caps with wage growth, since caps are indexed to wages.`}{" "}
        Source:{" "}
        <a className="text-accent hover:underline" href={latest.sources[0]}>
          ATO super guarantee
        </a>
        ,{" "}
        <a className="text-accent hover:underline" href={latest.sources[1]}>
          ATO contribution caps
        </a>
        .
      </div>
    </>
  );
}

function Extra({
  input,
  people,
  perWeek,
  onChange,
}: {
  input: SuperInput;
  people: PersonProjection[];
  perWeek: number;
  onChange: (v: number) => void;
}) {
  const effects = useMemo(
    () =>
      people
        .filter((p) => p.yearsToRetire > 0)
        .map((p) => ({
          p,
          e: extraContributionEffect(input, p.id, Math.round(perWeek * 52 * 100) as Cents),
        })),
    [input, people, perWeek],
  );
  if (!effects.length) return null;
  return (
    <div className={card}>
      <h2 className="mb-3 font-semibold">What a little extra does</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-start">
        <MoneyField
          label="Extra a week, before tax"
          hint="As salary sacrifice."
          value={perWeek}
          onChange={(v) => v !== undefined && onChange(v)}
        />
        <ul className="space-y-1.5 text-sm sm:pt-6">
          {effects.map(({ p, e }) => (
            <li key={p.id}>
              <span className="font-medium">{p.name}</span>: about{" "}
              <strong className="num text-good">{money(e.atRetirementReal)}</strong> more at
              retirement, or <strong className="num">{money(e.incomePerYear)}</strong> a year more
              income.
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted">
        Salary sacrifice is taxed 15% going into super instead of at your marginal rate. A check of
        what it costs your take-home pay is coming next.
      </p>
    </div>
  );
}

function YearByYear({
  people,
  household,
}: {
  people: PersonProjection[];
  household: HouseholdYear[];
}) {
  const many = people.length > 1;
  // -1 = the household view, the default when there's more than one person.
  const [who, setWho] = useState(-1);
  const showHousehold = many && who < 0;
  const p = people[who] ?? people[0];
  return (
    <details className={card}>
      <summary className="cursor-pointer font-semibold">Year by year</summary>
      {many && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWho(-1)}
            className={`rounded-full border px-3 py-1 text-sm ${
              showHousehold ? "border-accent text-accent" : "border-border"
            }`}
          >
            Household
          </button>
          {people.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setWho(i)}
              className={`rounded-full border px-3 py-1 text-sm ${
                i === who ? "border-accent text-accent" : "border-border"
              }`}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}
      {showHousehold ? (
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="num w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
                <th className="text-left">Year</th>
                {people.map((x) => (
                  <th key={x.id}>{x.name}</th>
                ))}
                <th className="!font-semibold">Household</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-3 [&_td]:text-right">
              {household.map((y) => (
                <tr key={y.year}>
                  <td className="!text-left">{y.date.slice(0, 4)}</td>
                  {y.perPerson.map((v, i) => (
                    <td key={people[i].id}>{money(v)}</td>
                  ))}
                  <td className="font-semibold">{money(y.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            In today&apos;s dollars. Someone who has retired is drawing their income.
          </p>
        </div>
      ) : (
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="num w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
                <th className="text-left">Age</th>
                <th>Balance</th>
                <th>Today&apos;s dollars</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-3 [&_td]:text-right">
              {p.years.map((y) => (
                <tr key={y.year}>
                  <td className="!text-left">
                    {Math.floor(y.age)} <span className="text-muted">({y.date.slice(0, 4)})</span>
                  </td>
                  <td>{money(y.total)}</td>
                  <td>{money(y.real)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Each month until you retire, your employer pays the super guarantee on your salary (up to
          the year&apos;s maximum contribution base) into the fund you choose. Employer and salary
          sacrifice contributions lose 15% contributions tax on the way in; after-tax top-ups
          don&apos;t. Your salary grows by wage growth each year.
        </p>
        <p>
          Each fund grows at its return, entered after investment fees and tax the way funds report
          it, less its admin fees. The super guarantee rate and caps follow each financial year from
          the ATO.
        </p>
        <p>
          The income figure is the most you could draw each year, rising with inflation, so the
          money lasts until the age you choose. Earnings continue at the same return. Retirement
          income from super is tax-free from age 60.
        </p>
        <p>
          The Age Pension estimate uses Services Australia&apos;s rates from{" "}
          {monthYear(AGE_PENSION_RULES.from)}. It tests your super at retirement, plus your other
          assets, against the assets test, and deems your super and savings to earn income for the
          income test. The lower of the two is what you&apos;d get. It assumes you&apos;re both{" "}
          {AGE_PENSION_RULES.age} or older, and leaves out the Work Bonus, Rent Assistance and
          special cases.
        </p>
        <p>
          Returns aren&apos;t guaranteed and will go up and down. This is general information, not
          financial advice.
        </p>
      </div>
    </details>
  );
}

function PensionCard({
  pension: v,
  couple,
  people,
  onChange,
}: {
  pension: PensionRow;
  couple: boolean;
  people: number;
  onChange: (patch: Partial<PensionRow>) => void;
}) {
  return (
    <div className={card}>
      <h2 className="font-semibold">For the Age Pension</h2>
      {people > 2 ? (
        <p className="mt-1 text-sm text-muted">
          The Age Pension is worked out for a single person or a couple. Remove people to see an
          estimate.
        </p>
      ) : (
        <>
          <p className="mt-1 mb-3 text-sm text-muted">
            Centrelink tests your assets and income. Your home doesn&apos;t count.
          </p>
          <div className="space-y-3">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Do you own your home?</legend>
              <div className="flex w-fit overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  className={seg(v.homeowner)}
                  aria-pressed={v.homeowner}
                  onClick={() => onChange({ homeowner: true })}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={seg(!v.homeowner)}
                  aria-pressed={!v.homeowner}
                  onClick={() => onChange({ homeowner: false })}
                >
                  {couple ? "No, we rent" : "No, I rent"}
                </button>
              </div>
            </fieldset>
            <MoneyField
              label="Savings and shares outside super"
              hint="Centrelink counts these as earning income, like your super."
              value={v.savings}
              onChange={(n) => n !== undefined && onChange({ savings: n })}
            />
            <MoneyField
              label="Other assets"
              hint="Cars, contents, an investment property, a caravan. What they'd sell for."
              value={v.otherAssets}
              onChange={(n) => n !== undefined && onChange({ otherAssets: n })}
            />
            <MoneyField
              label="Other income a fortnight"
              hint="Rent, part-time work. Super is counted for you."
              value={v.otherIncome}
              onChange={(n) => n !== undefined && onChange({ otherIncome: n })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function PensionResults({
  pension: r,
  assets,
  couple,
  homeowner,
}: {
  pension: AgePensionResult;
  assets: Cents;
  couple: boolean;
  homeowner: boolean;
}) {
  const rules = r.rules;
  const max = couple ? rules.maxRate.coupleEach * 2 : rules.maxRate.single;
  const limits = couple ? rules.assetsLimit.couple : rules.assetsLimit.single;
  const limit = homeowner ? limits.homeowner : limits.nonHomeowner;
  // Assets where the pension reaches nil, to the nearest $1,000.
  const cutoff = limit + Math.ceil(max / rules.assetsTaperPer1000) * 100_000;
  const scale = cutoff / 0.8;
  const at = (c: number) => `${Math.min(100, (c / scale) * 100).toFixed(1)}%`;
  const youPos = Math.min(98, (assets / scale) * 100);
  const together = couple ? " together" : "";
  const sets =
    r.limitedBy === "full"
      ? "That's the full rate."
      : r.limitedBy === "assets"
        ? "Your assets set the rate, not your income."
        : "Your income sets the rate, not your assets.";

  return (
    <>
      <div className="space-y-2 rounded-2xl bg-primary-container p-5 text-on-primary-container sm:p-6">
        {r.fortnight > 0 ? (
          <>
            <p className="text-lg leading-relaxed sm:text-xl">
              From {rules.age} you could also get about{" "}
              <strong className="num">{money(r.fortnight)} a fortnight</strong>
              {together} from the Age Pension. That&apos;s{" "}
              <strong className="num">{money(r.year)} a year</strong> on top of your super income.
            </p>
            <p className="text-sm">
              {couple && <span className="num">{moneyExact(r.each)} each. </span>}
              {sets}
            </p>
          </>
        ) : (
          <p className="text-lg leading-relaxed sm:text-xl">
            With this much put away you likely wouldn&apos;t get the Age Pension at {rules.age}.{" "}
            {r.byAssetsTest === 0
              ? `Your assets are over the ${money(cutoff)} cut-off.`
              : "Your income is over the cut-off."}{" "}
            As you draw down your super, you may qualify later.
          </p>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Where your assets sit</h2>
        <div className="relative h-16" aria-hidden="true">
          <div
            className="absolute top-7 left-0 h-3 rounded-l-full bg-good"
            style={{ width: at(limit) }}
          />
          <div
            className="absolute top-7 h-3 bg-primary-container"
            style={{ left: at(limit), width: `calc(${at(cutoff)} - ${at(limit)})` }}
          />
          <div
            className="absolute top-7 right-0 h-3 rounded-r-full bg-border"
            style={{ left: at(cutoff) }}
          />
          <div
            className="absolute top-5 h-6 w-[3px] bg-text"
            style={{ left: `${youPos.toFixed(1)}%` }}
          />
          <span
            className="num absolute top-0 text-xs font-semibold whitespace-nowrap sm:text-sm"
            style={
              youPos > 60
                ? { right: `${(100 - youPos + 1).toFixed(1)}%` }
                : { left: `${(youPos + 1).toFixed(1)}%` }
            }
          >
            {couple ? "You both" : "You"}: {money(assets)}
          </span>
        </div>
        <div className="num -mt-5 flex justify-between gap-2 text-xs text-muted">
          <span>Full pension to {money(limit)}</span>
          <span className="text-right">None over {money(cutoff)}</span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Each $1,000 over {money(limit)} takes {moneyExact(rules.assetsTaperPer1000)} a fortnight
          off {couple ? "your combined" : "your"} pension. As you draw down your super, your pension
          usually goes up.
        </p>
        <p className="sr-only">
          Your assessable assets are {money(assets)}. The full pension limit is {money(limit)} and
          it stops at {money(cutoff)}.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold">How Centrelink tests it</h2>
        <table className="num w-full text-sm">
          <tbody>
            <tr className="border-t border-border">
              <td className="py-2.5 pr-3">Most you could get{couple ? " (couple)" : ""}</td>
              <td className="py-2.5 text-right">{moneyExact(max)}</td>
            </tr>
            <tr
              className={`border-t border-border ${r.limitedBy === "income" ? "font-semibold" : ""}`}
            >
              <td className="py-2.5 pr-3">
                Under the income test (super and savings deemed to earn{" "}
                {money(r.deemedIncomeFortnight)} a fortnight)
              </td>
              <td className="py-2.5 text-right">{moneyExact(r.byIncomeTest)}</td>
            </tr>
            <tr
              className={`border-t border-border ${r.limitedBy === "assets" ? "font-semibold" : ""}`}
            >
              <td className="py-2.5 pr-3">Under the assets test</td>
              <td className="py-2.5 text-right">{moneyExact(r.byAssetsTest)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          A fortnight, in today&apos;s dollars. The lower test applies. Rates from{" "}
          <a className="underline" href={rules.sources[0]} target="_blank" rel="noreferrer">
            Services Australia
          </a>{" "}
          from {monthYear(rules.from)}. An estimate on your super at retirement only: it leaves out
          the Work Bonus, Rent Assistance and special cases.
        </p>
      </div>
    </>
  );
}
