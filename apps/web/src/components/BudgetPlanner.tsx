"use client";

import {
  annualise,
  BUCKET_GUIDE,
  type BudgetBucket,
  type BudgetFrequency,
  type BudgetResult,
  type BudgetView,
  budgetForView,
  type Cents,
  incomeForView,
  perView,
  planBudget,
  validateBudget,
} from "@budgy/engine";
import { useEffect, useMemo, useState } from "react";
import { SavedBar } from "@/components/SavedBar";
import {
  adoptPay,
  type BudgetState,
  type CategoryState,
  decodeBudgetState,
  defaultBudgetState,
  encodeBudgetState,
  FREQUENCIES,
  type LineState,
  MAX_CATEGORIES,
  MAX_LINES,
  MAX_OTHER,
  MAX_PEOPLE,
  newId,
  newPerson,
  type PersonState,
  toBudgetInput,
} from "@/lib/budgetState";
import { moneyExact } from "@/lib/format";
import { encodePayState, hasAdvanced } from "@/lib/payState";
import { parseMoney } from "@/lib/state";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const input =
  "w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";
const linkBtn = "py-1.5 text-sm font-medium text-accent hover:underline";

const BUDGET_SAVED: SavedConfig<BudgetState> = {
  tool: "budget",
  initial: () => defaultBudgetState(),
  decode: (q) => decodeBudgetState(q),
  encode: encodeBudgetState,
  adopt: (s, { search, data, fresh }) => adoptPay(s, search, data.tools.pay, fresh),
};

const VIEW_TABS: { value: BudgetView; label: string; per: string }[] = [
  { value: "week", label: "Week", per: "a week" },
  { value: "fortnight", label: "Fortnight", per: "a fortnight" },
  { value: "month", label: "Month", per: "a month" },
  { value: "year", label: "Year", per: "a year" },
];
const perLabel = (v: BudgetView) => VIEW_TABS.find((t) => t.value === v)?.per ?? "";
const FREQ_LABEL: Record<BudgetFrequency, string> = {
  week: "a week",
  fortnight: "a fortnight",
  month: "a month",
  quarter: "a quarter",
  year: "a year",
};
const ENTRY_PER: Record<string, string> = {
  year: "a year",
  month: "a month",
  fortnight: "a fortnight",
  week: "a week",
  hour: "an hour",
};
const BUCKET_LABEL: Record<BudgetBucket, string> = {
  need: "Needs",
  want: "Wants",
  save: "Saving",
};

// Category colours, in order. Mid-tones that read on light and dark.
const PALETTE = [
  "#1f6feb",
  "#0b7285",
  "#d9480f",
  "#7048e8",
  "#2b8a3e",
  "#c2255c",
  "#9a6200",
  "#5c7cfa",
  "#0f7b4a",
  "#e67700",
  "#1098ad",
  "#862e9c",
];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];
const LEFT_COLOR = "var(--series-base)";

const pct = (v: number) => `${(v * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`;
const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function BudgetPlanner() {
  const saved = useSavedState(BUDGET_SAVED);
  const { state, setState } = saved;
  const view = state.view;
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  const { result, errors } = useMemo(() => {
    const input = toBudgetInput(state);
    const errors = validateBudget(input);
    if (errors.length) return { result: null, errors };
    try {
      return { result: planBudget(input), errors };
    } catch (e) {
      return { result: null, errors: [String((e as Error).message)] };
    }
  }, [state]);

  const set = (patch: Partial<BudgetState>) => setState((s) => ({ ...s, ...patch }));
  const setPerson = (i: number, patch: Partial<PersonState>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const setCategory = (i: number, patch: Partial<CategoryState>) =>
    setState((s) => ({
      ...s,
      categories: s.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));
  const setLines = (i: number, f: (lines: LineState[]) => LineState[]) =>
    setState((s) => ({
      ...s,
      categories: s.categories.map((c, j) => (j === i ? { ...c, lines: f(c.lines) } : c)),
    }));

  const totals = result ? budgetForView(result, view) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <a href=".." className="text-sm text-muted hover:text-text">
          ← All tools
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Budget planner</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Start from what you actually take home, add what you spend the way you&apos;re billed, and
          see where every dollar goes. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      {totals && (
        <div
          className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-primary-container px-4 py-3 text-on-primary-container lg:hidden"
          aria-live="polite"
        >
          <div>
            <p className="text-xs opacity-75">{totals.left < 0 ? "Short by" : "Left over"}</p>
            <p className="num text-2xl font-semibold">{moneyExact(Math.abs(totals.left))}</p>
            <p className="text-xs opacity-75">
              {perLabel(view)}: {moneyExact(totals.income)} in, {moneyExact(totals.spend)} out
            </p>
          </div>
          <label className="flex flex-col gap-1 text-xs opacity-90">
            Show per
            <select
              className="rounded-lg border border-on-primary-container/20 bg-surface/60 px-2 py-2 text-base text-on-primary-container"
              value={view}
              onChange={(e) => set({ view: e.target.value as BudgetView })}
            >
              {VIEW_TABS.map((o) => (
                <option key={o.value} value={o.value} className="text-black">
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {/* ── Money in ─────────────────────────────────────────── */}
          <section className={card} aria-labelledby="money-in">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="money-in" className="font-semibold">
                Money in
              </h2>
              {totals && (
                <p className="num font-semibold">
                  {moneyExact(totals.income)}{" "}
                  <span className="font-normal text-muted">{perLabel(view)}</span>
                </p>
              )}
            </div>

            <ul className="mt-2">
              {state.people.map((p, i) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  net={result ? incomeForView(result.income[i], view) : null}
                  view={view}
                  canRemove={state.people.length > 1}
                  onChange={(patch) => setPerson(i, patch)}
                  onRemove={() => set({ people: state.people.filter((_, j) => j !== i) })}
                />
              ))}
              {state.other.map((o, i) => (
                <li key={o.id} className="border-t border-border py-3">
                  <LineRow
                    line={o}
                    view={view}
                    nameLabel="Other income, after tax"
                    onChange={(patch) =>
                      set({
                        other: state.other.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                      })
                    }
                    onRemove={() => set({ other: state.other.filter((_, j) => j !== i) })}
                  />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
              {state.people.length < MAX_PEOPLE && (
                <button
                  type="button"
                  className={linkBtn}
                  onClick={() =>
                    set({
                      people: [...state.people, newPerson(`Person ${state.people.length + 1}`)],
                    })
                  }
                >
                  + Add a person
                </button>
              )}
              {state.other.length < MAX_OTHER && (
                <button
                  type="button"
                  className={linkBtn}
                  onClick={() =>
                    set({
                      other: [
                        ...state.other,
                        { id: newId("o"), label: "", amount: 0, per: "month" },
                      ],
                    })
                  }
                >
                  + Add other income
                </button>
              )}
            </div>
          </section>

          {/* ── Money out ────────────────────────────────────────── */}
          <section className={card} aria-labelledby="money-out">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="money-out" className="font-semibold">
                Money out
              </h2>
              {totals && (
                <p className="num font-semibold">
                  {moneyExact(totals.spend)}{" "}
                  <span className="font-normal text-muted">{perLabel(view)}</span>
                </p>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              Enter each amount the way you pay it: weekly, monthly, quarterly or yearly. It&apos;s
              converted for you.
            </p>

            <div className="mt-3">
              {state.categories.map((c, i) => {
                const isOpen = Boolean(open[i]);
                const total = result ? perView(result.categories[i].year, view) : 0;
                return (
                  <div key={c.id} className="border-t border-border">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))}
                      className="flex min-h-12 w-full items-center gap-2.5 py-3 text-left"
                    >
                      <span
                        className="size-3 shrink-0 rounded-[3px]"
                        style={{ background: colorFor(i) }}
                        aria-hidden="true"
                      />
                      <span className="font-semibold">{c.name || "Untitled"}</span>
                      <span className="text-sm text-muted">
                        {c.lines.length} {c.lines.length === 1 ? "item" : "items"}
                      </span>
                      <span className="num ml-auto font-medium">{moneyExact(total)}</span>
                      <span aria-hidden="true" className="w-4 text-center text-muted">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 pb-4 sm:pl-5">
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="min-w-40 flex-1 text-sm">
                            <span className="mb-1 block font-medium">Category name</span>
                            <input
                              className={input}
                              value={c.name}
                              maxLength={60}
                              onChange={(e) => setCategory(i, { name: e.target.value })}
                            />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Counts as</span>
                            <select
                              className={input}
                              value={c.bucket}
                              onChange={(e) =>
                                setCategory(i, { bucket: e.target.value as BudgetBucket })
                              }
                            >
                              <option value="need">A need</option>
                              <option value="want">A want</option>
                              <option value="save">Saving</option>
                            </select>
                          </label>
                        </div>
                        <ul className="space-y-3">
                          {c.lines.map((l, j) => (
                            <li key={l.id}>
                              <LineRow
                                line={l}
                                view={view}
                                nameLabel="What it is"
                                onChange={(patch) =>
                                  setLines(i, (ls) =>
                                    ls.map((x, k) => (k === j ? { ...x, ...patch } : x)),
                                  )
                                }
                                onRemove={() => setLines(i, (ls) => ls.filter((_, k) => k !== j))}
                              />
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-x-5">
                          {c.lines.length < MAX_LINES && (
                            <button
                              type="button"
                              className={linkBtn}
                              onClick={() =>
                                setLines(i, (ls) => [
                                  ...ls,
                                  { id: newId("l"), label: "", amount: 0, per: "month" },
                                ])
                              }
                            >
                              + Add to {c.name || "this category"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="py-1.5 text-sm text-muted hover:text-text hover:underline"
                            onClick={() => {
                              set({ categories: state.categories.filter((_, k) => k !== i) });
                              setOpen({});
                            }}
                          >
                            Remove category
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {state.categories.length < MAX_CATEGORIES && (
              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  className={linkBtn}
                  onClick={() => {
                    const n = state.categories.length;
                    set({
                      categories: [
                        ...state.categories,
                        {
                          id: newId("c"),
                          name: "New category",
                          bucket: "want",
                          lines: [{ id: newId("l"), label: "", amount: 0, per: "month" }],
                        },
                      ],
                    });
                    setOpen((o) => ({ ...o, [n]: true }));
                  }}
                >
                  + Add a category
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── Results ──────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          {errors.length > 0 && (
            <div className={`${card} text-sm text-warn`} role="alert">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          {result && totals && (
            <Results
              result={result}
              state={state}
              view={view}
              totals={totals}
              onView={(v) => set({ view: v })}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function PersonRow({
  person: p,
  net,
  view,
  canRemove,
  onChange,
  onRemove,
}: {
  person: PersonState;
  net: Cents | null;
  view: BudgetView;
  canRemove: boolean;
  onChange: (patch: Partial<PersonState>) => void;
  onRemove: () => void;
}) {
  const salary = p.mode === "salary";
  return (
    <li className="border-t border-border py-3 first:border-t-0">
      <div className="grid gap-3 sm:grid-cols-[150px_200px_minmax(0,1fr)] sm:items-start">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input
            className={input}
            value={p.name}
            maxLength={60}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        {salary ? (
          <AmountField
            label={`Salary ${ENTRY_PER[p.pay.per]}, before tax`}
            value={p.pay.amount}
            onChange={(v) => onChange({ pay: { ...p.pay, amount: v } })}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <AmountField
              label="Take-home pay"
              value={p.takeHome}
              onChange={(v) => onChange({ takeHome: v })}
            />
            <div className="text-sm">
              <span className="mb-1 block font-medium" aria-hidden="true">
                Paid
              </span>
              <FrequencySelect
                label="Paid"
                value={p.takeHomePer}
                onChange={(v) => onChange({ takeHomePer: v })}
                only={["week", "fortnight", "month"]}
              />
            </div>
          </div>
        )}
        <div className="text-sm text-muted sm:pt-6">
          {salary && net !== null && (
            <p>
              Takes home <strong className="num text-text">{moneyExact(net)}</strong>{" "}
              {perLabel(view)}
              {hasAdvanced(p.pay) && ", with the extra options set in the pay calculator"}.
            </p>
          )}
          {salary && (
            <label className="mt-1 flex min-h-7 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-[18px] accent-[var(--accent)]"
                checked={p.pay.studyLoan}
                onChange={(e) => onChange({ pay: { ...p.pay, studyLoan: e.target.checked } })}
              />
              <span className="text-text">Has a HELP or other study loan</span>
            </label>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4">
            {salary && (
              <a className={linkBtn} href={`../pay?${encodePayState(p.pay)}`}>
                Super, salary sacrifice and more in the pay calculator
              </a>
            )}
            <button
              type="button"
              className={linkBtn}
              onClick={() => onChange({ mode: salary ? "takehome" : "salary" })}
            >
              {salary ? "I know my take-home pay instead" : "Work it out from salary"}
            </button>
            {canRemove && (
              <button
                type="button"
                className="py-1.5 text-sm text-muted hover:text-text hover:underline"
                onClick={onRemove}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function LineRow({
  line,
  view,
  nameLabel,
  onChange,
  onRemove,
}: {
  line: LineState;
  view: BudgetView;
  nameLabel: string;
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}) {
  const converted = perView(annualise(toCents(line.amount), line.per), view);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_120px_130px_110px_auto]">
      <input
        aria-label={nameLabel}
        placeholder={nameLabel}
        className={`${input} col-span-3 sm:col-span-1`}
        value={line.label}
        maxLength={60}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      <AmountInput
        label={`${line.label || "Amount"}, amount`}
        value={line.amount}
        onChange={(v) => onChange({ amount: v })}
      />
      <FrequencySelect
        label={`${line.label || "Amount"}, how often`}
        value={line.per}
        onChange={(v) => onChange({ per: v })}
      />
      <span className="num hidden text-right text-sm text-muted sm:block">
        {moneyExact(converted)}
      </span>
      <button
        type="button"
        aria-label={`Remove ${line.label || "this line"}`}
        className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-text"
        onClick={onRemove}
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
    </div>
  );
}

function FrequencySelect({
  value,
  onChange,
  label,
  only = FREQUENCIES,
}: {
  value: BudgetFrequency;
  onChange: (v: BudgetFrequency) => void;
  label?: string;
  only?: BudgetFrequency[];
}) {
  return (
    <select
      aria-label={label}
      className={input}
      value={value}
      onChange={(e) => onChange(e.target.value as BudgetFrequency)}
    >
      {only.map((f) => (
        <option key={f} value={f}>
          {FREQ_LABEL[f]}
        </option>
      ))}
    </select>
  );
}

const fmtAmount = (n: number) => (n ? n.toLocaleString("en-AU", { maximumFractionDigits: 2 }) : "");

/** A compact dollar box: accepts "1.2k" or "$1,200", commits on blur or Enter. */
function AmountInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [text, setText] = useState(fmtAmount(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(fmtAmount(value)), [value]);
  const commit = () => {
    if (text.trim() === "") {
      setBad(false);
      onChange(0);
      return;
    }
    const n = parseMoney(text);
    if (n === null || n > 10_000_000) return setBad(true);
    setBad(false);
    onChange(n);
    setText(fmtAmount(n));
  };
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
        $
      </span>
      <input
        aria-label={label}
        aria-invalid={bad}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className={`${input} num pl-7 ${bad ? "border-warn" : ""}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium" aria-hidden="true">
        {label}
      </span>
      <AmountInput label={label} value={value} onChange={onChange} />
    </div>
  );
}

function Results({
  result,
  state,
  view,
  totals,
  onView,
}: {
  result: BudgetResult;
  state: BudgetState;
  view: BudgetView;
  totals: { income: Cents; spend: Cents; left: Cents };
  onView: (v: BudgetView) => void;
}) {
  const income = result.incomeYear;
  const short = result.leftYear < 0;
  // Share of income, or of spending when it's more than income.
  const base = Math.max(income, result.spendYear) || 1;
  const rows = result.categories
    .map((c, i) => ({ id: c.id, name: c.name || "Untitled", year: c.year, color: colorFor(i) }))
    .filter((r) => r.year > 0)
    .sort((a, b) => b.year - a.year);
  if (result.leftYear > 0)
    rows.push({ id: "left", name: "Left over", year: result.leftYear, color: LEFT_COLOR });

  const savingYear = result.buckets.save + Math.max(0, result.leftYear);
  const buckets: { key: BudgetBucket; label: string; year: number }[] = [
    { key: "need", label: "Needs", year: result.buckets.need },
    { key: "want", label: "Wants", year: result.buckets.want },
    { key: "save", label: "Saving and spare", year: savingYear },
  ];
  const nameOf = (b: BudgetBucket) =>
    state.categories
      .filter((c) => c.bucket === b)
      .map((c) => c.name)
      .join(", ");

  const home = result.categories.find((c) => /home|housing|mortgage|rent/i.test(c.name));
  const debts = result.categories.find((c) => /debt|loan|credit/i.test(c.name));

  return (
    <>
      <section className={card} aria-label="Summary">
        <fieldset
          aria-label="Show amounts per"
          className="m-0 hidden min-w-0 rounded-full border border-border bg-bg p-0.5 text-sm lg:inline-flex"
        >
          {VIEW_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={t.value === view}
              onClick={() => onView(t.value)}
              className={`rounded-full px-3.5 py-1.5 ${
                t.value === view
                  ? "bg-surface font-semibold shadow-sm"
                  : "text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </fieldset>
        <p className="mt-4 text-muted">{short ? "Short by" : "Left over"}</p>
        <p
          className={`num mt-1 text-4xl font-semibold tracking-tight ${short ? "text-warn" : "text-good"}`}
          aria-live="polite"
        >
          {moneyExact(Math.abs(totals.left))}{" "}
          <span className="text-lg font-medium text-muted">{perLabel(view)}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {moneyExact(totals.income)} in, {moneyExact(totals.spend)} out.{" "}
          {income > 0 &&
            (short
              ? "You're spending more than you take home."
              : `You keep ${pct(result.leftYear / income)} of what you take home.`)}
        </p>

        <h3 className="mt-6 text-sm font-semibold">Where it goes</h3>
        {rows.length > 0 ? (
          <>
            <div className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {rows.map((r) => (
                <div
                  key={r.id}
                  style={{ width: `${(r.year / base) * 100}%`, background: r.color }}
                />
              ))}
            </div>
            <ul className="num mt-3 text-sm">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[12px_minmax(0,1fr)_56px_110px] items-center gap-2.5 border-b border-border py-2"
                >
                  <span className="size-2.5 rounded-[3px]" style={{ background: r.color }} />
                  <span className="truncate">{r.name}</span>
                  <span className="text-right text-muted">
                    {income > 0 ? pct(r.year / income) : ""}
                  </span>
                  <span className="text-right">
                    {moneyExact(r.id === "left" ? totals.left : perView(r.year as Cents, view))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Add your spending to see where it goes.</p>
        )}
      </section>

      {income > 0 && (
        <section className={card} aria-labelledby="buckets">
          <h3 id="buckets" className="text-sm font-semibold">
            Needs, wants and saving
          </h3>
          <div className="mt-4 space-y-5">
            {buckets.map((b) => {
              const share = b.year / income;
              const guide = BUCKET_GUIDE[b.key];
              return (
                <div key={b.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-medium">{b.label}</span>
                    <span className="num">
                      <strong>{pct(share)}</strong>{" "}
                      <span className="text-muted">vs {pct(guide)} guide</span>
                    </span>
                  </div>
                  <div className="relative mt-2 h-3 rounded-full bg-border">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        width: `${Math.min(100, share * 100)}%`,
                        background: b.key === "save" ? "var(--good)" : "var(--accent)",
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute -top-1 h-5 w-0.5 bg-text"
                      style={{ left: `${guide * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {b.key === "save"
                      ? [nameOf("save"), result.leftYear > 0 ? "left over" : ""]
                          .filter(Boolean)
                          .join(", ")
                      : nameOf(b.key) || `No ${BUCKET_LABEL[b.key].toLowerCase()} yet`}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            The black mark is the common 50/30/20 guide. Housing makes 50% hard in most Australian
            cities, so treat it as a guide, not a grade. Change what a category counts as by opening
            it.
          </p>
        </section>
      )}

      {result.lumpyBills.length > 0 && result.lumpyPerMonth > 0 && (
        <section className={card} aria-labelledby="lumpy">
          <h3 id="lumpy" className="text-sm font-semibold">
            Bills that land in lumps
          </h3>
          <p className="mt-2 text-sm">
            Put aside <strong className="num">{moneyExact(result.lumpyPerMonth)} a month</strong>{" "}
            and your quarterly and yearly bills are covered when they arrive.
          </p>
          <ul className="num mt-2 text-sm text-muted">
            {result.lumpyBills
              .filter((l) => l.year > 0)
              .slice(0, 5)
              .map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-1">
                  <span className="truncate">{l.label || "Untitled"}</span>
                  <span>
                    {moneyExact(l.amount)} {FREQ_LABEL[l.frequency]}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {((home && home.year > 0) || (debts && debts.year > 0)) && (
        <section className={`${card} space-y-3 text-sm`} aria-labelledby="next">
          <h3 id="next" className="font-semibold">
            Make the left over work
          </h3>
          {home && home.year > 0 && income > 0 && (
            <p>
              {home.name} takes {pct(home.year / income)} of your take-home.{" "}
              <a href="../mortgage" className="font-medium text-accent hover:underline">
                See what extra mortgage repayments do
              </a>
            </p>
          )}
          {debts && debts.year > 0 && (
            <p>
              You pay {moneyExact(perView(debts.year, "month"))} a month on debts.{" "}
              <a href="../debt" className="font-medium text-accent hover:underline">
                Plan which to clear first
              </a>
            </p>
          )}
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Take-home pay is worked out as the ATO assesses it, the same as the pay calculator. Weekly
        amounts are 52 a year and fortnightly 26, so a month is a twelfth of a year.
      </p>
    </>
  );
}
