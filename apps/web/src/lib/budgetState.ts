import type {
  BudgetBucket,
  BudgetFrequency,
  BudgetInput,
  BudgetView,
  Cents,
  IncomeSource,
} from "@budgy/engine";
import {
  decodePayState,
  defaultPayState,
  encodePayState,
  type PayState,
  toPayInput,
} from "./payState";
import { b64urlDecode, b64urlEncode, today } from "./state";

/** One line of a budget, as typed, in dollars. */
export interface LineState {
  id: string;
  label: string;
  amount: number;
  per: BudgetFrequency;
}

export interface CategoryState {
  id: string;
  name: string;
  bucket: BudgetBucket;
  lines: LineState[];
}

/** A person's pay: a salary through the pay calculator, or take-home as they know it. */
export interface PersonState {
  id: string;
  name: string;
  mode: "salary" | "takehome";
  pay: PayState;
  takeHome: number;
  takeHomePer: BudgetFrequency;
}

export interface BudgetState {
  people: PersonState[];
  other: LineState[]; // other income, already after tax
  categories: CategoryState[];
  view: BudgetView;
}

export const FREQUENCIES: BudgetFrequency[] = ["week", "fortnight", "month", "quarter", "year"];
export const VIEWS: BudgetView[] = ["week", "fortnight", "month", "year"];
export const BUCKETS: BudgetBucket[] = ["need", "want", "save"];
export const MAX_PEOPLE = 4;
export const MAX_OTHER = 6;
export const MAX_CATEGORIES = 20;
export const MAX_LINES = 30;

let seq = 0;
/** A short id for React keys. Not saved: decoding makes fresh ones. */
export const newId = (prefix: string) =>
  `${prefix}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const line = (label: string, per: BudgetFrequency, amount = 0): LineState => ({
  id: newId("l"),
  label,
  amount,
  per,
});

/** A starting list of the usual categories, all at $0, for the person to fill in. */
export function starterCategories(): CategoryState[] {
  const cat = (name: string, bucket: BudgetBucket, lines: LineState[]): CategoryState => ({
    id: newId("c"),
    name,
    bucket,
    lines,
  });
  return [
    cat("Home", "need", [
      line("Rent or mortgage", "month"),
      line("Council rates", "year"),
      line("Home and contents insurance", "year"),
    ]),
    cat("Bills", "need", [
      line("Electricity and gas", "quarter"),
      line("Water", "quarter"),
      line("Internet", "month"),
      line("Phones", "month"),
    ]),
    cat("Groceries", "need", [line("Supermarket", "week")]),
    cat("Transport", "need", [
      line("Fuel or public transport", "week"),
      line("Rego and car insurance", "year"),
    ]),
    cat("Kids", "need", [line("Childcare", "month"), line("School and activities", "year")]),
    cat("Health", "need", [
      line("Private health insurance", "month"),
      line("Doctor, dentist and medicines", "year"),
    ]),
    cat("Debts", "need", [line("Credit card", "month"), line("Car or personal loan", "month")]),
    cat("Lifestyle", "want", [
      line("Eating out and takeaway", "month"),
      line("Streaming and subscriptions", "month"),
      line("Holidays", "year"),
      line("Gifts", "year"),
    ]),
    cat("Savings", "save", [line("Emergency fund", "month")]),
  ];
}

export function newPerson(name: string, on = today()): PersonState {
  return {
    id: newId("p"),
    name,
    mode: "salary",
    pay: { ...defaultPayState(on), amount: 0 },
    takeHome: 0,
    takeHomePer: "fortnight",
  };
}

export function defaultBudgetState(on = today()): BudgetState {
  const me = newPerson("You", on);
  me.pay = { ...me.pay, amount: 80_000 };
  return { people: [me], other: [], categories: starterCategories(), view: "month" };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toBudgetInput(s: BudgetState): BudgetInput {
  const income: IncomeSource[] = s.people.map((p) =>
    p.mode === "salary"
      ? { id: p.id, label: p.name, kind: "salary", pay: toPayInput(p.pay) }
      : {
          id: p.id,
          label: p.name,
          kind: "amount",
          amount: toCents(p.takeHome),
          frequency: p.takeHomePer,
        },
  );
  for (const o of s.other)
    income.push({
      id: o.id,
      label: o.label,
      kind: "amount",
      amount: toCents(o.amount),
      frequency: o.per,
    });
  return {
    income,
    categories: s.categories.map((c) => ({
      id: c.id,
      name: c.name,
      bucket: c.bucket,
      lines: c.lines.map((l) => ({
        id: l.id,
        label: l.label,
        amount: toCents(l.amount),
        frequency: l.per,
      })),
    })),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const BUDGET_URL_VERSION = 1;

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const money = (v: unknown) => Math.min(10_000_000, Math.max(0, num(v, 0)));
const text = (v: unknown, fallback: string) => (typeof v === "string" ? v.slice(0, 60) : fallback);
const freq = (v: unknown, fallback: BudgetFrequency) => FREQUENCIES[num(v, -1)] ?? fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const packLine = (l: LineState) => [l.label, l.amount, FREQUENCIES.indexOf(l.per)];
const unpackLine = (v: unknown): LineState => {
  const a = arr(v);
  return { id: newId("l"), label: text(a[0], ""), amount: money(a[1]), per: freq(a[2], "month") };
};

export function encodeBudgetState(s: BudgetState): string {
  const compact = {
    p: s.people.map((p) => [
      p.name,
      p.mode === "salary" ? 0 : 1,
      encodePayState(p.pay),
      p.takeHome,
      FREQUENCIES.indexOf(p.takeHomePer),
    ]),
    o: s.other.map(packLine),
    c: s.categories.map((c) => [c.name, BUCKETS.indexOf(c.bucket), c.lines.map(packLine)]),
    w: VIEWS.indexOf(s.view),
  };
  return new URLSearchParams({
    v: String(BUDGET_URL_VERSION),
    b: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeBudgetState(query: string, fallback = defaultBudgetState()): BudgetState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("b");
    if (!raw || params.get("v") !== String(BUDGET_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const people = arr(c.p)
      .slice(0, MAX_PEOPLE)
      .map((v, i): PersonState => {
        const a = arr(v);
        const blank = newPerson(`Person ${i + 1}`);
        return {
          ...blank,
          name: text(a[0], blank.name),
          mode: a[1] === 1 ? "takehome" : "salary",
          pay: typeof a[2] === "string" ? decodePayState(a[2], blank.pay) : blank.pay,
          takeHome: money(a[3]),
          takeHomePer: freq(a[4], "fortnight"),
        };
      });
    const categories = arr(c.c)
      .slice(0, MAX_CATEGORIES)
      .map((v): CategoryState => {
        const a = arr(v);
        return {
          id: newId("c"),
          name: text(a[0], "Category"),
          bucket: BUCKETS[num(a[1], -1)] ?? "want",
          lines: arr(a[2]).slice(0, MAX_LINES).map(unpackLine),
        };
      });
    return {
      people,
      other: arr(c.o).slice(0, MAX_OTHER).map(unpackLine),
      categories,
      view: VIEWS[num(c.w, -1)] ?? fallback.view,
    };
  } catch {
    return fallback;
  }
}

// ── Carrying pay over from the pay calculator ───────────────────────────────

/** Query param on a link from the pay calculator, holding its encoded inputs. */
export const FROM_PAY_PARAM = "pay";

/** The budget planner's address from another tool's page, carrying the pay calculator's inputs. */
export function budgetLinkFromPay(pay: PayState): string {
  return `../budget?${new URLSearchParams({ [FROM_PAY_PARAM]: encodePayState(pay) })}`;
}

/** Put a pay calculator's inputs on the first person, as a salary. */
export function withPay(s: BudgetState, pay: PayState): BudgetState {
  const [first, ...rest] = s.people.length ? s.people : [newPerson("You")];
  return { ...s, people: [{ ...first, mode: "salary", pay }, ...rest] };
}

/**
 * On opening: a link from the pay calculator brings its pay in; otherwise a
 * first visit starts from whatever the pay calculator has saved.
 */
export function adoptPay(
  s: BudgetState,
  search: string,
  savedPay: string | undefined,
  fresh: boolean,
): BudgetState {
  const carried = new URLSearchParams(search).get(FROM_PAY_PARAM);
  const query = carried ?? (fresh ? savedPay : undefined);
  if (!query) return s;
  const bad = {} as PayState;
  const pay = decodePayState(query, bad);
  return pay === bad ? s : withPay(s, pay);
}
