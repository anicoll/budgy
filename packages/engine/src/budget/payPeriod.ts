import { addMonths, isIsoDate, toDay, toIso } from "../dates";
import type { Cents } from "../money/cents";
import { annualise, type BudgetFrequency, MAX_BUDGET_AMOUNT } from "./plan";

/**
 * One pay at a time. Given how often you're paid and your last pay date, this
 * finds the pay you're in today and shares the budget's planned amounts across
 * it. There are no real transactions here, so every figure is a plan.
 */

export type PayEvery = "week" | "fortnight" | "month";
export const PAYS_PER_YEAR: Record<PayEvery, number> = { week: 52, fortnight: 26, month: 12 };

export interface PayPeriodBill {
  id: string;
  label: string;
  amount: Cents;
  frequency: BudgetFrequency;
  /** An ISO date this bill is next due. Later and earlier dates follow its frequency. */
  nextDue?: string;
}

export interface PayPeriodInput {
  payEvery: PayEvery;
  /** The most recent pay date, ISO. Any past pay date will do. */
  lastPay: string;
  /** ISO. */
  today: string;
  /** Take-home pay for one pay. */
  income: Cents;
  bills: PayPeriodBill[];
}

/**
 * dated:    a weekly, fortnightly or monthly bill with a due date, on that date.
 * spread:   the same without a date, a share of its year in every pay.
 * setAside: a quarterly or yearly bill, a share of its year in every pay.
 */
export type PayItemKind = "dated" | "spread" | "setAside";

export interface PayItem {
  id: string;
  label: string;
  kind: PayItemKind;
  amount: Cents;
  /** ISO. Only for "dated". */
  date?: string;
  /** ISO. When a "setAside" bill is next due, if it has a date. */
  nextDue?: string;
}

export interface PayPeriodResult {
  /** The pay date this pay started on. */
  start: string;
  /** The next pay date. */
  next: string;
  days: number;
  /** Which day of the pay today is, from 1. */
  dayOf: number;
  /** Days from today up to the next pay, counting today. */
  daysLeft: number;
  income: Cents;
  items: PayItem[];
  datedTotal: Cents;
  spreadTotal: Cents;
  setAsideTotal: Cents;
  planned: Cents;
  /** Income less everything planned. Negative is a shortfall. */
  left: Cents;
  /** What's left over each remaining day. 0 when short. */
  perDay: Cents;
}

export function validatePayPeriod(i: PayPeriodInput): string[] {
  const errors: string[] = [];
  if (!Object.hasOwn(PAYS_PER_YEAR, i.payEvery)) errors.push("Choose how often you're paid.");
  if (!isIsoDate(i.lastPay) || i.lastPay < "2000-01-01" || i.lastPay > "2100-01-01")
    errors.push("Enter your last pay date.");
  if (!isIsoDate(i.today)) errors.push("Today's date isn't valid.");
  if (!Number.isInteger(i.income) || i.income < 0 || i.income > MAX_BUDGET_AMOUNT)
    errors.push("Pay should be between $0 and $10 million.");
  for (const b of i.bills) {
    if (b.nextDue !== undefined && !isIsoDate(b.nextDue))
      errors.push(`${b.label || "A bill"} has a due date that isn't valid.`);
  }
  return errors;
}

const daysBetween = (a: string, b: string) => toDay(b) - toDay(a);
const monthEstimate = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
  Number(b.slice(5, 7)) -
  Number(a.slice(5, 7));
const stepDays = (every: "week" | "fortnight") => (every === "week" ? 7 : 14);

/** The pay date `n` pays after `last`. Months keep the day of month, clamped to the month's length. */
export function payDate(last: string, every: PayEvery, n: number): string {
  if (every === "month") return addMonths(last, n);
  return toIso(toDay(last) + n * stepDays(every));
}

/** The start of the pay that `on` falls in, and the next pay date. */
export function payPeriodAround(
  last: string,
  every: PayEvery,
  on: string,
): { start: string; next: string } {
  let n =
    every === "month"
      ? monthEstimate(last, on)
      : Math.floor(daysBetween(last, on) / stepDays(every));
  while (payDate(last, every, n) > on) n--;
  while (payDate(last, every, n + 1) <= on) n++;
  return { start: payDate(last, every, n), next: payDate(last, every, n + 1) };
}

/** Dates a repeating bill falls on within [start, end). `anchor` is any one of its due dates. */
export function dueDatesIn(
  anchor: string,
  frequency: "week" | "fortnight" | "month",
  start: string,
  end: string,
): string[] {
  const out: string[] = [];
  if (frequency === "month") {
    let k = monthEstimate(anchor, start) - 1;
    while (addMonths(anchor, k) < start) k++;
    for (; addMonths(anchor, k) < end; k++) out.push(addMonths(anchor, k));
    return out;
  }
  const days = stepDays(frequency);
  let d = toDay(anchor) + Math.ceil((toDay(start) - toDay(anchor)) / days) * days;
  for (; d < toDay(end); d += days) out.push(toIso(d));
  return out;
}

export function planPayPeriod(input: PayPeriodInput): PayPeriodResult {
  const errors = validatePayPeriod(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const { start, next } = payPeriodAround(input.lastPay, input.payEvery, input.today);
  const perPay = PAYS_PER_YEAR[input.payEvery];
  const share = (b: PayPeriodBill) =>
    Math.round(annualise(b.amount, b.frequency) / perPay) as Cents;

  const items: PayItem[] = [];
  for (const b of input.bills) {
    if (b.amount <= 0) continue;
    if (b.frequency === "quarter" || b.frequency === "year") {
      items.push({
        id: b.id,
        label: b.label,
        kind: "setAside",
        amount: share(b),
        nextDue: b.nextDue,
      });
    } else if (b.nextDue) {
      for (const date of dueDatesIn(b.nextDue, b.frequency, start, next))
        items.push({ id: b.id, label: b.label, kind: "dated", amount: b.amount, date });
    } else {
      items.push({ id: b.id, label: b.label, kind: "spread", amount: share(b) });
    }
  }
  const order: Record<PayItemKind, number> = { dated: 0, spread: 1, setAside: 2 };
  items.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      (a.date ?? "").localeCompare(b.date ?? "") ||
      b.amount - a.amount,
  );

  const total = (k: PayItemKind) =>
    items.filter((x) => x.kind === k).reduce((t, x) => t + x.amount, 0) as Cents;
  const datedTotal = total("dated");
  const spreadTotal = total("spread");
  const setAsideTotal = total("setAside");
  const planned = (datedTotal + spreadTotal + setAsideTotal) as Cents;
  const left = (input.income - planned) as Cents;
  const daysLeft = Math.max(1, daysBetween(input.today, next));
  return {
    start,
    next,
    days: daysBetween(start, next),
    dayOf: daysBetween(start, input.today) + 1,
    daysLeft,
    income: input.income,
    items,
    datedTotal,
    spreadTotal,
    setAsideTotal,
    planned,
    left,
    perDay: left > 0 ? (Math.floor(left / daysLeft) as Cents) : (0 as Cents),
  };
}
