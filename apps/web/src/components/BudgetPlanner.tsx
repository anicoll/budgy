"use client";

import {
  annualise,
  BUCKET_GUIDE,
  BUDGET_PERIODS_PER_YEAR,
  type BudgetBucket,
  type BudgetFrequency,
  type BudgetResult,
  type BudgetView,
  budgetForView,
  type Cents,
  incomeForView,
  type PayEvery,
  type PayItem,
  type PayPeriodResult,
  perView,
  planBudget,
  planPayPeriod,
  validateBudget,
  validatePayPeriod,
} from "@budgy/engine";
import { useEffect, useMemo, useState } from "react";
import { GoodToKnow } from "@/components/GoodToKnow";
import { NextSteps } from "@/components/NextSteps";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  ToolHeader,
  ToolPage,
  ToolSection,
} from "@/components/tool";
import {
  adoptPay,
  type BudgetMode,
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
  PAY_EVERY,
  type PersonState,
  payEveryFor,
  toBudgetInput,
  toPayPeriodBills,
} from "@/lib/budgetState";
import {
  BUDGET_TEMPLATES,
  type BudgetTemplate,
  budgetIsEmpty,
  templateCategories,
  templateLineCount,
} from "@/lib/budgetTemplates";
import { moneyExact } from "@/lib/format";
import { BUDGET_PEOPLE } from "@/lib/household";
import { leaseInPay, toggleLease, withBudgetLease } from "@/lib/novatedPay";
import { encodePayState, hasAdvanced, type LeaseInPay } from "@/lib/payState";
import { readSaved } from "@/lib/saved";
import { parseMoney, today } from "@/lib/state";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox, DatePicker, filledField, Select } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const input = `${filledField} min-w-0`;
const linkBtn = "py-1.5 text-sm font-medium text-accent hover:underline";

const BUDGET_SAVED: SavedConfig<BudgetState> = {
  tool: "budget",
  initial: () => defaultBudgetState(),
  decode: (q) => decodeBudgetState(q),
  encode: encodeBudgetState,
  people: BUDGET_PEOPLE,
  adopt: (s, { search, data, fresh, mode }) => {
    const adopted = adoptPay(s, search, data.tools.pay, fresh);
    return mode === "saved" ? withBudgetLease(adopted, data) : adopted;
  },
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

const PAY_EVERY_LABEL: Record<PayEvery, string> = {
  week: "Every week",
  fortnight: "Every fortnight",
  month: "Every month",
};
const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const pct = (v: number) => `${(v * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`;
const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function BudgetPlanner() {
  const saved = useSavedState(BUDGET_SAVED);
  const { state, setState } = saved;
  const view = state.view;
  const [open, setOpen] = useState<Record<number, boolean>>({});
  // The novated lease saved on this device, which is yours (the first person's).
  const [savedLease, setSavedLease] = useState<LeaseInPay | null>(null);
  useEffect(() => setSavedLease(leaseInPay(readSaved().tools.lease)), []);

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
  const payMode = state.mode === "pay";
  // Templates show by themselves while nothing's been entered, or on request.
  const [templatesOpen, setTemplatesOpen] = useState<boolean | null>(null);
  const showTemplates = templatesOpen ?? budgetIsEmpty(state.categories);
  const setMode = (mode: BudgetMode) =>
    set({
      mode,
      payDay:
        mode === "pay" && !state.payDay.last
          ? { ...state.payDay, every: payEveryFor(state) }
          : state.payDay,
    });
  const applyTemplate = (t: BudgetTemplate) => {
    set({ categories: templateCategories(t) });
    setOpen({ 0: true });
    setTemplatesOpen(false);
  };

  return (
    <ToolPage>
      <ToolHeader
        title="Budget planner"
        intro="Where your take-home pay goes, and what is left over."
        saved={saved}
      />
      <fieldset
        aria-label="Show the budget by"
        className="m-0 mb-6 inline-flex min-w-0 rounded-full border border-border bg-bg p-0.5 text-sm"
      >
        {(
          [
            ["month", "Month"],
            ["pay", "This pay"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={state.mode === value}
            onClick={() => setMode(value)}
            className={`min-h-10 rounded-full px-4 py-1.5 ${
              state.mode === value
                ? "bg-surface font-semibold shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </fieldset>

      {totals && !payMode && (
        <div
          className="sticky top-[var(--header-h)] z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-primary-container px-4 py-3 text-on-primary-container lg:hidden"
          aria-live="polite"
        >
          <div>
            <p className="text-xs opacity-75">{totals.left < 0 ? "Short by" : "Left over"}</p>
            <p className="num text-2xl font-semibold">{moneyExact(Math.abs(totals.left))}</p>
            <p className="text-xs opacity-75">
              {perLabel(view)}: {moneyExact(totals.income)} in, {moneyExact(totals.spend)} out
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs opacity-90">
            <span aria-hidden>Show per</span>
            <Select<BudgetView>
              ariaLabel="Show per"
              triggerClassName="rounded-lg border border-on-primary-container/20 bg-surface/60 px-2 py-2 text-base text-on-primary-container"
              value={view}
              onChange={(view) => set({ view })}
              options={VIEW_TABS}
            />
          </div>
        </div>
      )}

      <div className="space-y-8">
        {errors.length > 0 && (
          <div className={`${card} text-sm text-warn`} role="alert">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        {payMode && (
          <PaySetup state={state} onChange={(payDay) => set({ payDay })} result={result} />
        )}
        {result && totals && !payMode && (
          <div className="space-y-4">
            <BudgetAnswer
              result={result}
              state={state}
              view={view}
              totals={totals}
              onView={(v) => set({ view: v })}
            />
          </div>
        )}

        <ToolSection id="budget-h" title="Your budget">
          <div className="space-y-4">
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
                    lease={i === 0 ? (p.pay.lease ?? savedLease) : p.pay.lease}
                    onLease={(on) => setPerson(i, { pay: toggleLease(p.pay, on, readSaved()) })}
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
                Enter each amount the way you pay it: weekly, monthly, quarterly or yearly.
                It&apos;s converted for you.
                {payMode && " Add a next due date to a bill to see which pay it lands in."}
              </p>

              {showTemplates ? (
                <TemplatePicker
                  hasAmounts={!budgetIsEmpty(state.categories)}
                  lineCount={state.categories.reduce((n, c) => n + c.lines.length, 0)}
                  onUse={applyTemplate}
                  onClose={budgetIsEmpty(state.categories) ? null : () => setTemplatesOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  className={`${linkBtn} mt-2`}
                  onClick={() => setTemplatesOpen(true)}
                >
                  Start from a template
                </button>
              )}

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
                            <div className="text-sm">
                              <span className="mb-1 block font-medium">Counts as</span>
                              <Select<BudgetBucket>
                                ariaLabel="Counts as"
                                value={c.bucket}
                                onChange={(bucket) => setCategory(i, { bucket })}
                                options={[
                                  { value: "need", label: "A need" },
                                  { value: "want", label: "A want" },
                                  { value: "save", label: "Saving" },
                                ]}
                              />
                            </div>
                          </div>
                          <ul className="space-y-3">
                            {c.lines.map((l, j) => (
                              <li key={l.id}>
                                <LineRow
                                  line={l}
                                  view={view}
                                  showDue={payMode}
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
        </ToolSection>

        <BudgetDetail result={result} />
      </div>
    </ToolPage>
  );
}

function PersonRow({
  person: p,
  net,
  view,
  canRemove,
  lease,
  onLease,
  onChange,
  onRemove,
}: {
  person: PersonState;
  net: Cents | null;
  view: BudgetView;
  canRemove: boolean;
  /** The novated lease this person could take out of their pay. */
  lease: LeaseInPay | null;
  onLease: (on: boolean) => void;
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
            <Checkbox
              className="mt-1 flex min-h-7 cursor-pointer items-center gap-2"
              isSelected={p.pay.studyLoan}
              onChange={(v) => onChange({ pay: { ...p.pay, studyLoan: v } })}
            >
              <span className="text-text">Has a HELP or other study loan</span>
            </Checkbox>
          )}
          {salary && lease && (
            <Checkbox
              className="mt-1 flex min-h-7 cursor-pointer items-center gap-2"
              isSelected={Boolean(p.pay.lease)}
              onChange={onLease}
            >
              <span className="text-text">
                Take out my novated lease
                <span className="block text-xs text-muted">
                  {moneyExact(
                    Math.round(
                      ((lease.preTax + lease.postTax) * 100) / BUDGET_PERIODS_PER_YEAR[view],
                    ),
                  )}{" "}
                  {perLabel(view)}, before and after tax
                </span>
              </span>
            </Checkbox>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4">
            {salary && (
              <a className={linkBtn} href={`../pay/?${encodePayState(p.pay)}`}>
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
  showDue = false,
  onChange,
  onRemove,
}: {
  line: LineState;
  view: BudgetView;
  showDue?: boolean;
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
      {showDue && (
        <div className="col-span-3 flex items-end gap-2 sm:col-span-5">
          <div className="w-52 max-w-full">
            <DatePicker
              label={`${line.label || "This bill"}: next due (optional)`}
              value={line.due ?? ""}
              onChange={(due) => onChange({ due })}
            />
          </div>
          {line.due && (
            <button
              type="button"
              className="min-h-10 px-2 text-sm text-muted hover:text-text hover:underline"
              onClick={() => onChange({ due: undefined })}
            >
              Clear date
            </button>
          )}
        </div>
      )}
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
    <Select<BudgetFrequency>
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={only.map((f) => ({ value: f, label: FREQ_LABEL[f] }))}
    />
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

function BudgetAnswer({
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

  return (
    <>
      <AnswerRow>
        <AnswerCard label={short ? "Short by" : "Left over"}>
          <fieldset
            aria-label="Show amounts per"
            className="m-0 hidden min-w-0 self-start rounded-full border border-on-primary-container/20 bg-bg/40 p-0.5 text-sm lg:inline-flex"
          >
            {VIEW_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={t.value === view}
                onClick={() => onView(t.value)}
                className={`rounded-full px-3.5 py-1.5 ${
                  t.value === view ? "bg-surface font-semibold shadow-sm" : "hover:opacity-80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </fieldset>
          <p className="num -mt-1 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
            {moneyExact(Math.abs(totals.left))}{" "}
            <span className="text-lg font-medium sm:text-xl">{perLabel(view)}</span>
          </p>
          <p className="text-lg">
            {moneyExact(totals.income)} in, {moneyExact(totals.spend)} out.{" "}
            {income > 0 &&
              (short
                ? "You're spending more than you take home."
                : `You keep ${pct(result.leftYear / income)} of what you take home.`)}
          </p>
        </AnswerCard>

        <section className={`${card} min-w-0 rounded-3xl`} aria-label="Where it goes">
          <h2 className="font-semibold">Where it goes</h2>
          {rows.length > 0 ? (
            <>
              <div
                className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded-full"
                aria-hidden="true"
              >
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
      </AnswerRow>

      {income > 0 && (
        <section className={card} aria-labelledby="buckets">
          <h2 id="buckets" className="font-semibold">
            Needs, wants and saving
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
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
    </>
  );
}

function BudgetDetail({ result }: { result: BudgetResult | null }) {
  const income = result?.incomeYear ?? 0;
  const home = result?.categories.find((c) => /home|housing|mortgage|rent/i.test(c.name));
  const debts = result?.categories.find((c) => /debt|loan|credit/i.test(c.name));
  const lumpy = result && result.lumpyBills.length > 0 && result.lumpyPerMonth > 0 ? result : null;
  const showNext = Boolean((home && home.year > 0) || (debts && debts.year > 0));

  return (
    <>
      <Detail>
        {lumpy && (
          <Disclosure
            title="Bills that land in lumps"
            hint={`put aside ${moneyExact(lumpy.lumpyPerMonth)} a month`}
          >
            <p className="text-sm">
              Put aside <strong className="num">{moneyExact(lumpy.lumpyPerMonth)} a month</strong>{" "}
              and your quarterly and yearly bills are covered when they arrive.
            </p>
            <ul className="num mt-2 text-sm text-muted">
              {lumpy.lumpyBills
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
          </Disclosure>
        )}
        {showNext && result && (
          <Disclosure title="Make the left over work" hint="mortgage and debts">
            <div className="space-y-3 text-sm">
              {home && home.year > 0 && income > 0 && (
                <p>
                  {home.name} takes {pct(home.year / income)} of your take-home.{" "}
                  <a href="../mortgage/" className="font-medium text-accent hover:underline">
                    See what extra mortgage repayments do
                  </a>
                </p>
              )}
              {debts && debts.year > 0 && (
                <p>
                  You pay {moneyExact(perView(debts.year, "month"))} a month on debts.{" "}
                  <a href="../debt/" className="font-medium text-accent hover:underline">
                    Plan which to clear first
                  </a>
                </p>
              )}
            </div>
          </Disclosure>
        )}
        <Disclosure title="Good to know" hint="tips and things to check">
          <GoodToKnow tool="budget" bare />
        </Disclosure>
        <Disclosure title="How this is calculated" hint="take-home pay and periods">
          <p className="text-sm text-muted">
            Take-home pay is worked out as the ATO assesses it, the same as the pay calculator.
            Weekly amounts are 52 a year and fortnightly 26, so a month is a twelfth of a year.
          </p>
        </Disclosure>
      </Detail>
      <NextSteps tool="budget" className="pt-2" />
    </>
  );
}

function TemplatePicker({
  hasAmounts,
  lineCount,
  onUse,
  onClose,
}: {
  hasAmounts: boolean;
  lineCount: number;
  onUse: (t: BudgetTemplate) => void;
  onClose: (() => void) | null;
}) {
  const [pending, setPending] = useState<BudgetTemplate | null>(null);
  const pick = (t: BudgetTemplate) => (hasAmounts ? setPending(t) : onUse(t));
  return (
    <div className="mt-3 rounded-xl border border-border bg-bg p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Start from a template</h3>
        {onClose && (
          <button type="button" className="text-sm text-muted hover:underline" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        It adds the usual bills for that kind of household, with every amount at $0 so you can add
        your own. You can remove any of them.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {BUDGET_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={pending?.id === t.id}
            onClick={() => pick(t)}
            className={`flex min-h-12 flex-col gap-1 rounded-xl border bg-surface p-3 text-left hover:border-accent ${
              pending?.id === t.id ? "border-2 border-accent" : "border-border"
            }`}
          >
            <span className="font-semibold">{t.title}</span>
            <span className="text-sm text-muted">{t.blurb}</span>
            <span className="text-sm text-accent">{templateLineCount(t)} bills to fill in</span>
          </button>
        ))}
      </div>
      {pending && (
        <div
          className="mt-3 rounded-lg bg-primary-container p-3 text-sm text-on-primary-container"
          role="alert"
        >
          <p>
            This replaces the {lineCount} {lineCount === 1 ? "line" : "lines"} in Money out with the{" "}
            {pending.title.toLowerCase()} list, all at $0. Your income stays as it is.
          </p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              className="min-h-10 font-semibold underline"
              onClick={() => {
                onUse(pending);
                setPending(null);
              }}
            >
              Replace my lines
            </button>
            <button type="button" className="min-h-10" onClick={() => setPending(null)}>
              Keep what I have
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaySetup({
  state,
  onChange,
  result,
}: {
  state: BudgetState;
  onChange: (p: BudgetState["payDay"]) => void;
  result: BudgetResult | null;
}) {
  const { every, last } = state.payDay;
  const now = today();
  const plan = useMemo(() => {
    if (!result || !last) return { error: null, plan: null as PayPeriodResult | null };
    const input = {
      payEvery: every,
      lastPay: last,
      today: now,
      income: budgetForView(result, every).income,
      bills: toPayPeriodBills(state),
    };
    const errors = validatePayPeriod(input);
    if (errors.length) return { error: errors.join(" "), plan: null };
    return { error: null, plan: planPayPeriod(input) };
  }, [result, every, last, now, state]);

  const setup = (
    <>
      <section className={card} aria-labelledby="pay-setup">
        <h2 id="pay-setup" className="font-semibold">
          Your pay day
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="text-sm">
            <span className="mb-1 block font-medium" aria-hidden="true">
              How often you&apos;re paid
            </span>
            <Select<PayEvery>
              ariaLabel="How often you're paid"
              value={every}
              onChange={(v) => onChange({ every: v, last })}
              options={PAY_EVERY.map((f) => ({ value: f, label: PAY_EVERY_LABEL[f] }))}
            />
          </div>
          <DatePicker
            label="Last pay date"
            value={last}
            onChange={(v) => onChange({ every, last: v })}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Any recent pay date will do. Pay is your take-home pay from Money in.
        </p>
      </section>
      {!last && (
        <section className={card}>
          <p className="text-sm text-muted">
            Enter your last pay date to see what&apos;s planned until your next pay.
          </p>
        </section>
      )}
      {plan.error && (
        <div className={`${card} text-sm text-warn`} role="alert">
          {plan.error}
        </div>
      )}
    </>
  );
  if (!plan.plan) return setup;
  return <PayResults plan={plan.plan} now={now} setup={setup} />;
}

function PayResults({
  plan,
  now,
  setup,
}: {
  plan: PayPeriodResult;
  now: string;
  setup: React.ReactNode;
}) {
  const short = plan.left < 0;
  const base = Math.max(plan.income, plan.planned) || 1;
  const w = (v: number) => `${(v / base) * 100}%`;
  const tagFor = (i: PayItem) =>
    i.kind === "setAside"
      ? { text: "Set aside", cls: "bg-primary-container text-on-primary-container" }
      : i.kind === "spread"
        ? { text: "Spread", cls: "bg-border text-text" }
        : i.date && i.date < now
          ? { text: "Earlier", cls: "bg-border text-text" }
          : { text: "Due", cls: "bg-warn/15 text-warn" };
  const when = (i: PayItem) =>
    i.date ? shortDay(i.date) : i.nextDue ? `Next due ${shortDay(i.nextDue)}` : "Every pay";
  return (
    <div className="space-y-4">
      <AnswerRow>
        <AnswerCard label="This pay">
          <p className="text-sm">
            Pay started {longDay(plan.start)}. Next pay {longDay(plan.next)}. Day {plan.dayOf} of{" "}
            {plan.days}.
          </p>
          <p className="num -mt-1 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
            {moneyExact(Math.abs(plan.left))}
          </p>
          <p className="text-lg" aria-live="polite">
            {short ? "Planned to run short by this much." : "Planned left until payday."}
            {!short && plan.left > 0 && (
              <>
                {" "}
                About <strong className="num">{moneyExact(plan.perDay)} a day</strong> for the{" "}
                {plan.daysLeft} {plan.daysLeft === 1 ? "day" : "days"} until payday.
              </>
            )}
          </p>
          <div
            className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-border"
            aria-hidden="true"
          >
            <div style={{ width: w(plan.datedTotal), background: "var(--accent)" }} />
            <div
              style={{ width: w(plan.spreadTotal + plan.setAsideTotal), background: "#d9480f" }}
            />
          </div>
          <ul className="num space-y-1 text-sm">
            <LegendRow color="var(--accent)" label="Bills due this pay" cents={plan.datedTotal} />
            <LegendRow
              color="#d9480f"
              label="Spread and set aside"
              cents={(plan.spreadTotal + plan.setAsideTotal) as Cents}
            />
            <LegendRow
              color="var(--series-base)"
              label={short ? "Short by" : "Left"}
              cents={Math.abs(plan.left) as Cents}
              outline
            />
          </ul>
          <p className="text-xs leading-relaxed">
            Out of {moneyExact(plan.income)} take-home pay. These are planned amounts from your
            budget. This planner doesn&apos;t see your bank account, so it can&apos;t show what
            you&apos;ve spent so far.
          </p>
        </AnswerCard>
        <div className="min-w-0 space-y-4">{setup}</div>
      </AnswerRow>

      <section className={card} aria-labelledby="pay-bills">
        <h3 id="pay-bills" className="text-sm font-semibold">
          Planned in this pay
        </h3>
        {plan.items.length > 0 ? (
          <ul className="num mt-2 text-sm">
            {plan.items.map((i, k) => {
              const tag = tagFor(i);
              return (
                <li
                  key={`${i.id}-${i.date ?? k}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border py-2 sm:grid-cols-[110px_minmax(0,1fr)_auto_90px]"
                >
                  <span className="col-span-2 text-xs text-muted sm:col-span-1 sm:text-sm">
                    {when(i)}
                  </span>
                  <span className="truncate">{i.label || "Untitled"}</span>
                  <span className="flex items-center justify-end gap-2 sm:contents">
                    <span className={`w-fit rounded-lg px-2.5 py-1 text-xs ${tag.cls}`}>
                      {tag.text}
                    </span>
                    <span className="text-right">{moneyExact(i.amount)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Add amounts to your bills to see them here.</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Bills with a due date show on the day. Weekly, fortnightly and monthly bills without one
          are spread evenly across your pays. Quarterly and yearly bills are set aside a little each
          pay, so a big bill doesn&apos;t land on one pay.
        </p>
      </section>
    </div>
  );
}

function LegendRow({
  color,
  label,
  cents,
  outline,
}: {
  color: string;
  label: string;
  cents: Cents;
  outline?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`size-2.5 rounded-full ${outline ? "border border-muted" : ""}`}
        style={{ background: color }}
      />
      <span className="flex-1">{label}</span>
      <span>{moneyExact(cents)}</span>
    </li>
  );
}
