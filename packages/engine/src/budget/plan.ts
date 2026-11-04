import type { Cents } from "../money/cents";
import {
  calculatePay,
  type PayInput,
  type PayPeriod,
  type PayResult,
  validatePay,
} from "../tax/pay";

/**
 * A household budget that starts from take-home pay. Every amount is entered
 * the way it's paid or billed, turned into a year (exactly, in cents), and
 * only divided back down when it's shown for a week, fortnight or month.
 */

export type BudgetFrequency = "week" | "fortnight" | "month" | "quarter" | "year";
export const BUDGET_PERIODS_PER_YEAR: Record<BudgetFrequency, number> = {
  week: 52,
  fortnight: 26,
  month: 12,
  quarter: 4,
  year: 1,
};

/** The periods a budget can be shown in. */
export type BudgetView = "week" | "fortnight" | "month" | "year";

/** Needs, wants and saving, as in the 50/30/20 guide. */
export type BudgetBucket = "need" | "want" | "save";
export const BUCKET_GUIDE: Record<BudgetBucket, number> = { need: 0.5, want: 0.3, save: 0.2 };

export type IncomeSource =
  | {
      id: string;
      label: string;
      /** A salary before tax, turned into take-home pay by the pay calculator. */
      kind: "salary";
      pay: PayInput;
    }
  | {
      id: string;
      label: string;
      /** Money that arrives already after tax: take-home pay, a pension, rent. */
      kind: "amount";
      amount: Cents;
      frequency: BudgetFrequency;
    };

export interface BudgetLine {
  id: string;
  label: string;
  amount: Cents;
  frequency: BudgetFrequency;
}

export interface BudgetCategory {
  id: string;
  name: string;
  bucket: BudgetBucket;
  lines: BudgetLine[];
}

export interface BudgetInput {
  income: IncomeSource[];
  categories: BudgetCategory[];
}

export interface IncomeResult {
  id: string;
  label: string;
  year: Cents;
  /** The pay calculator's working, for a salary. */
  pay: PayResult | null;
}

export interface LineResult extends BudgetLine {
  year: Cents;
}

export interface CategoryResult {
  id: string;
  name: string;
  bucket: BudgetBucket;
  year: Cents;
  /** Of take-home income. 0 when there's no income. */
  share: number;
  lines: LineResult[];
}

export interface BudgetResult {
  income: IncomeResult[];
  incomeYear: Cents;
  categories: CategoryResult[];
  /** Everything going out, savings categories included. */
  spendYear: Cents;
  /** Income less spending. Negative is a shortfall. */
  leftYear: Cents;
  /** Category totals by bucket. Left over isn't in here. */
  buckets: Record<BudgetBucket, Cents>;
  /** Quarterly and yearly bills, biggest first. */
  lumpyBills: LineResult[];
  /** Put this aside each month and the lumpy bills are covered when they land. */
  lumpyPerMonth: Cents;
  /**
   * Out of every $100 of income, whole dollars to each category (by id) and
   * to `"left"`, adding to exactly 100. Null with no income or a shortfall.
   */
  perHundred: { id: string; dollars: number }[] | null;
}

export const MAX_BUDGET_AMOUNT = 10_000_000_00 as Cents; // $10m
export const MAX_INCOME_SOURCES = 8;
export const MAX_CATEGORIES = 30;
export const MAX_LINES = 60;

/** A year's worth of an amount paid at `frequency`. Exact. */
export function annualise(amount: Cents, frequency: BudgetFrequency): Cents {
  return (amount * BUDGET_PERIODS_PER_YEAR[frequency]) as Cents;
}

/** A year's amount spread over one `view` period, to the nearest cent. */
export function perView(year: Cents, view: BudgetView): Cents {
  return Math.round(year / BUDGET_PERIODS_PER_YEAR[view]) as Cents;
}

export function validateBudget(input: BudgetInput): string[] {
  const errors: string[] = [];
  const okAmount = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX_BUDGET_AMOUNT;
  const okFreq = (f: string) => Object.hasOwn(BUDGET_PERIODS_PER_YEAR, f);
  if (input.income.length > MAX_INCOME_SOURCES)
    errors.push(`Add up to ${MAX_INCOME_SOURCES} sources of income.`);
  for (const s of input.income) {
    if (s.kind === "salary") {
      for (const e of validatePay(s.pay)) errors.push(`${s.label || "Salary"}: ${e}`);
    } else {
      if (!okAmount(s.amount))
        errors.push(`${s.label || "Income"} should be between $0 and $10 million.`);
      if (!okFreq(s.frequency)) errors.push(`${s.label || "Income"} needs a valid frequency.`);
    }
  }
  if (input.categories.length > MAX_CATEGORIES)
    errors.push(`Use up to ${MAX_CATEGORIES} categories.`);
  for (const c of input.categories) {
    if (c.lines.length > MAX_LINES) errors.push(`${c.name}: use up to ${MAX_LINES} lines.`);
    for (const l of c.lines) {
      if (!okAmount(l.amount))
        errors.push(`${l.label || c.name} should be between $0 and $10 million.`);
      if (!okFreq(l.frequency)) errors.push(`${l.label || c.name} needs a valid frequency.`);
    }
  }
  return errors;
}

/** Whole numbers in proportion to `values`, adding to `total` (largest remainder). */
export function apportion(values: number[], total: number): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / sum) * total);
  const out = raw.map(Math.floor);
  let spare = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (spare <= 0) break;
    out[i]++;
    spare--;
  }
  return out;
}

export function planBudget(input: BudgetInput): BudgetResult {
  const errors = validateBudget(input);
  if (errors.length) throw new RangeError(errors.join(" "));

  const income: IncomeResult[] = input.income.map((s) => {
    if (s.kind === "salary") {
      const pay = calculatePay(s.pay);
      return { id: s.id, label: s.label, year: pay.net, pay };
    }
    return { id: s.id, label: s.label, year: annualise(s.amount, s.frequency), pay: null };
  });
  const incomeYear = income.reduce((t, s) => t + s.year, 0) as Cents;

  const buckets: Record<BudgetBucket, Cents> = { need: 0, want: 0, save: 0 } as Record<
    BudgetBucket,
    Cents
  >;
  const lumpy: LineResult[] = [];
  const categories: CategoryResult[] = input.categories.map((c) => {
    const lines = c.lines.map((l) => ({ ...l, year: annualise(l.amount, l.frequency) }));
    for (const l of lines) if (l.frequency === "quarter" || l.frequency === "year") lumpy.push(l);
    const year = lines.reduce((t, l) => t + l.year, 0) as Cents;
    buckets[c.bucket] = (buckets[c.bucket] + year) as Cents;
    return {
      id: c.id,
      name: c.name,
      bucket: c.bucket,
      year,
      share: incomeYear > 0 ? year / incomeYear : 0,
      lines,
    };
  });
  const spendYear = categories.reduce((t, c) => t + c.year, 0) as Cents;
  const leftYear = (incomeYear - spendYear) as Cents;

  lumpy.sort((a, b) => b.year - a.year);
  const lumpyPerMonth = Math.round(lumpy.reduce((t, l) => t + l.year, 0) / 12) as Cents;

  let perHundred: BudgetResult["perHundred"] = null;
  if (incomeYear > 0 && leftYear >= 0) {
    const parts = [
      ...categories.map((c) => ({ id: c.id, v: c.year })),
      { id: "left", v: leftYear },
    ];
    const dollars = apportion(
      parts.map((p) => p.v),
      100,
    );
    perHundred = parts.map((p, i) => ({ id: p.id, dollars: dollars[i] }));
  }

  return {
    income,
    incomeYear,
    categories,
    spendYear,
    leftYear,
    buckets,
    lumpyBills: lumpy,
    lumpyPerMonth,
    perHundred,
  };
}

const PAY_PERIOD_FOR: Record<BudgetView, PayPeriod> = {
  week: "weekly",
  fortnight: "fortnightly",
  month: "monthly",
  year: "annual",
};

/** One income source for one period. A salary matches the pay calculator's figure. */
export function incomeForView(s: IncomeResult, view: BudgetView): Cents {
  return s.pay ? s.pay.periods[PAY_PERIOD_FOR[view]].net : perView(s.year, view);
}

/** Income, spending and left over for one period, rounded so they add up. */
export function budgetForView(
  r: BudgetResult,
  view: BudgetView,
): { income: Cents; spend: Cents; left: Cents } {
  const income = r.income.reduce((t, s) => t + incomeForView(s, view), 0) as Cents;
  const spend = perView(r.spendYear, view);
  return { income, spend, left: (income - spend) as Cents };
}
