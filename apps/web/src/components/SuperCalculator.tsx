"use client";

import {
  AGE_PENSION_AGE,
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
import { SavedBar } from "@/components/SavedBar";
import { money, monthYear } from "@/lib/format";
import { SUPER_PEOPLE } from "@/lib/household";
import {
  type AccountRow,
  decodeSuperState,
  defaultSuperState,
  encodeSuperState,
  newAccount,
  newPerson,
  nextId,
  type PersonRow,
  type SuperState,
  toSuperInput,
} from "@/lib/superState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const COLORS = ["var(--series-a)", "var(--series-b)", "var(--series-c)", "var(--series-base)"];
const chip =
  "rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent";

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

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <a href=".." className="text-sm text-muted hover:text-text">
          ← All tools
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Super at retirement
        </h1>
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
            />
          )}
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
}: {
  result: SuperResult;
  input: SuperInput;
  state: SuperState;
  onExtra: (v: number) => void;
  onCopy: () => void;
  copied: boolean;
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
          All in today&apos;s dollars, after {state.inflationPct}% inflation a year. Age Pension not
          included.
        </p>
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

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
          income from super is tax-free from age 60. It doesn&apos;t include the Age Pension, which
          most people can claim from {AGE_PENSION_AGE} and which may add to it.
        </p>
        <p>
          Returns aren&apos;t guaranteed and will go up and down. This is general information, not
          financial advice.
        </p>
      </div>
    </details>
  );
}
