import { addMonths, isIsoDate } from "../dates";
import type { Cents } from "../money/cents";

/**
 * Debt payoff planner: pay several debts from one monthly budget.
 *
 * Each month, for every debt still owing:
 *
 * 1. interest is charged at annualRate / 12 on the balance, rounded to the cent;
 * 2. the minimum is paid. It's either a fixed amount (a personal or car loan) or
 *    a percentage of the balance with a dollar floor (a credit card's "2% or
 *    $25, whichever is more"), never more than what's owed;
 * 3. whatever is left of the monthly budget goes to the debts in priority
 *    order, one at a time, spilling over to the next once one is cleared.
 *
 * The monthly budget is fixed at the start: the starting minimums plus any
 * extra. When a debt is cleared its minimum keeps being paid, just to the next
 * debt (the "rollover" or "snowball" effect). If a percentage minimum ever needs
 * more than the budget, the minimums are still paid in full.
 *
 * Strategies:
 * - avalanche: highest interest rate first (the least interest);
 * - snowball: smallest balance first (the quickest wins);
 * - custom: the order given;
 * - minimums: pay only each debt's minimum, with no extra and no rollover.
 *   This is the "what if I change nothing" baseline.
 *
 * Promo rates: a debt can have an intro rate (a 0% balance transfer, say) for
 * its first few months, then its ongoing rate. While any promo runs, avalanche
 * re-ranks each month by the rate being charged now, so a 0% card waits until
 * it reverts. Each debt reports what's still owing the month its promo ends.
 *
 * Buy now pay later: a debt with a `schedule` is paid in fixed instalments
 * (say every 14 days) at 0% interest. Instalment k falls in month
 * ceil(k * everyDays / 30.4375), so four fortnightly instalments land in
 * months 1, 1, 2 and 2. Instalments are paid on schedule whatever the strategy:
 * they are never a target for the extra, they aren't part of the monthly
 * budget (which is the other debts' minimums plus the extra), and when one
 * finishes nothing rolls over to the other debts. Late fees aren't modelled.
 */

export type DebtStrategy = "avalanche" | "snowball" | "custom" | "minimums";

export type MinimumRule =
  | { type: "fixed"; amount: Cents }
  | { type: "percent"; percent: number; floor: Cents }; // percent: 0.02 = 2%

export interface Debt {
  id: string;
  name: string;
  balance: Cents;
  annualRate: number; // e.g. 0.2099; the ongoing rate, after any promo
  minimum: MinimumRule;
  /** An intro rate for the first `months` payments, then `annualRate`. */
  promo?: { annualRate: number; months: number };
  /** Buy now pay later: fixed instalments every `everyDays` days at 0% interest. */
  schedule?: { instalment: Cents; everyDays: number };
}

const AVG_MONTH_DAYS = 30.4375;

/** Instalments falling due in each month (index 1 = first month) for a scheduled debt. */
export function scheduledDues(d: Debt): Cents[] {
  const dues: number[] = [0];
  if (!d.schedule) return dues as Cents[];
  const { instalment, everyDays } = d.schedule;
  if (!(instalment > 0) || !(everyDays > 0)) return dues as Cents[];
  const count = Math.ceil(d.balance / instalment);
  for (let k = 1; k <= count; k++) {
    const m = Math.ceil((k * everyDays) / AVG_MONTH_DAYS - 1e-9);
    while (dues.length <= m) dues.push(0);
    dues[m] += instalment;
  }
  return dues as Cents[];
}

/** The rate charged in a given month (1 = the first payment). */
export function rateInMonth(d: Debt, month: number): number {
  return d.promo && month <= d.promo.months ? d.promo.annualRate : d.annualRate;
}

export interface PayoffInput {
  debts: Debt[];
  extraPerMonth: Cents;
  strategy: DebtStrategy;
  /** Debt ids, highest priority first. Only used by "custom"; missing ids go last. */
  order?: string[];
  startDate: string; // YYYY-MM-DD; first payment is one month later
}

export interface DebtOutcome {
  id: string;
  name: string;
  paidOff: boolean;
  payoffDate: string | null;
  months: number | null; // months until cleared
  interest: Cents;
  paid: Cents;
  /** With a promo: what's still owing after its last promo month (0 = cleared in time). */
  owingWhenPromoEnds?: Cents;
  /** With a promo: the date its last promo payment falls on. */
  promoEndDate?: string;
}

export interface PayoffMonth {
  month: number; // 0 = today
  date: string;
  balances: Cents[]; // same order as input.debts
  total: Cents;
  interest: Cents; // charged this month
  paid: Cents; // paid this month
}

export interface PayoffResult {
  strategy: DebtStrategy;
  /** What's paid each month: starting minimums plus extra (or just minimums). */
  monthlyBudget: Cents;
  paidOff: boolean; // false if something is still owing after MAX_YEARS
  months: number;
  debtFreeDate: string;
  totalInterest: Cents;
  totalPaid: Cents;
  /** Debt ids in the order the plan targets them. */
  priority: string[];
  debts: DebtOutcome[]; // same order as input.debts
  timeline: PayoffMonth[];
  warnings: string[];
}

export const MAX_DEBTS = 20;
const MAX_YEARS = 100;

const round = (n: number) => Math.round(n);

/** The minimum due on a balance (after this month's interest). */
export function minimumDue(rule: MinimumRule, balance: number): Cents {
  if (balance <= 0) return 0 as Cents;
  const due =
    rule.type === "fixed" ? rule.amount : Math.max(rule.floor, round(balance * rule.percent));
  return Math.min(balance, due) as Cents;
}

export function validateDebts(debts: Debt[], extraPerMonth: Cents = 0 as Cents): string[] {
  const errors: string[] = [];
  if (debts.length === 0) errors.push("add at least one debt");
  if (debts.length > MAX_DEBTS) errors.push(`at most ${MAX_DEBTS} debts`);
  if (new Set(debts.map((d) => d.id)).size !== debts.length) errors.push("debt ids must be unique");
  for (const d of debts) {
    const label = d.name || "a debt";
    if (!Number.isInteger(d.balance) || d.balance < 0)
      errors.push(`${label}: balance can't be negative`);
    if (!Number.isFinite(d.annualRate) || d.annualRate < 0 || d.annualRate > 1)
      errors.push(`${label}: interest rate must be between 0% and 100%`);
    if (d.schedule) {
      const { instalment, everyDays } = d.schedule;
      if (!Number.isInteger(instalment) || instalment <= 0)
        errors.push(`${label}: instalment must be more than $0`);
      if (!Number.isFinite(everyDays) || everyDays < 1 || everyDays > 31)
        errors.push(`${label}: instalments must be 1 to 31 days apart`);
      if (d.annualRate !== 0) errors.push(`${label}: buy now pay later has no interest`);
      if (d.promo) errors.push(`${label}: buy now pay later can't have a promo rate`);
      continue;
    }
    const m = d.minimum;
    if (m.type === "fixed" && !(m.amount > 0))
      errors.push(`${label}: minimum repayment must be more than $0`);
    if (m.type === "percent" && (!(m.percent > 0) || m.percent > 1 || m.floor < 0))
      errors.push(`${label}: minimum percentage must be between 0% and 100%`);
    if (d.promo) {
      const { annualRate, months } = d.promo;
      if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1)
        errors.push(`${label}: promo rate must be between 0% and 100%`);
      if (!Number.isInteger(months) || months < 1 || months > 120)
        errors.push(`${label}: promo must last 1 to 120 months`);
    }
  }
  if (!Number.isInteger(extraPerMonth) || extraPerMonth < 0)
    errors.push("extra each month can't be negative");
  return errors;
}

/**
 * Indexes into `debts`, highest priority first. Ties keep the input order.
 * `month` picks which rate avalanche ranks by when a debt has a promo; by
 * default it's the first month's.
 */
export function priorityOrder(
  debts: Debt[],
  strategy: DebtStrategy,
  order: string[] = [],
  month = 1,
) {
  const idx = debts.map((_, i) => i).filter((i) => !debts[i].schedule);
  if (strategy === "avalanche") {
    const rate = (i: number) => rateInMonth(debts[i], month);
    return idx.sort((a, b) => rate(b) - rate(a) || debts[a].balance - debts[b].balance);
  }
  if (strategy === "snowball") {
    return idx.sort(
      (a, b) => debts[a].balance - debts[b].balance || debts[b].annualRate - debts[a].annualRate,
    );
  }
  if (strategy === "custom") {
    const rank = (i: number) => {
      const r = order.indexOf(debts[i].id);
      return r < 0 ? order.length + i : r;
    };
    return idx.sort((a, b) => rank(a) - rank(b));
  }
  return idx; // minimums: order doesn't matter
}

export function simulatePayoff(input: PayoffInput): PayoffResult {
  const { debts, strategy, startDate } = input;
  const errors = validateDebts(debts, input.extraPerMonth);
  if (!isIsoDate(startDate)) errors.push("start date must be YYYY-MM-DD");
  if (errors.length) throw new RangeError(errors.join("; "));

  const n = debts.length;
  const extra = strategy === "minimums" ? 0 : input.extraPerMonth;
  const priority = priorityOrder(debts, strategy, input.order);
  const hasPromo = debts.some((d) => d.promo);
  const owingAtPromoEnd = new Array<number | undefined>(n).fill(undefined);
  const startingMinimums = debts.reduce(
    (s, d) => s + (d.schedule ? 0 : minimumDue(d.minimum, d.balance)),
    0,
  );
  const dues = debts.map(scheduledDues);
  const monthlyBudget = (startingMinimums + extra) as Cents;

  const bal = debts.map((d) => d.balance as number);
  const interest = new Array<number>(n).fill(0);
  const paid = new Array<number>(n).fill(0);
  const clearedAt = new Array<number | null>(n).fill(null);
  bal.forEach((b, i) => {
    if (b === 0) clearedAt[i] = 0;
  });

  const total = () => bal.reduce((s, b) => s + b, 0) as Cents;
  const timeline: PayoffMonth[] = [
    {
      month: 0,
      date: startDate,
      balances: bal.slice() as Cents[],
      total: total(),
      interest: 0 as Cents,
      paid: 0 as Cents,
    },
  ];

  const maxMonths = MAX_YEARS * 12;
  let month = 0;
  while (total() > 0 && month < maxMonths) {
    month++;
    let monthInterest = 0;
    let monthPaid = 0;
    let scheduledPaid = 0; // instalments sit outside the monthly budget

    // 1. Interest.
    for (let i = 0; i < n; i++) {
      if (bal[i] <= 0) continue;
      const charge = round((bal[i] * rateInMonth(debts[i], month)) / 12);
      bal[i] += charge;
      interest[i] += charge;
      monthInterest += charge;
    }

    // 2. Minimums.
    for (let i = 0; i < n; i++) {
      const due = debts[i].schedule
        ? Math.min(bal[i], dues[i][month] ?? 0)
        : minimumDue(debts[i].minimum, bal[i]);
      bal[i] -= due;
      paid[i] += due;
      monthPaid += due;
      if (debts[i].schedule) scheduledPaid += due;
    }

    // 3. The rest of the budget, in priority order.
    if (strategy !== "minimums") {
      let left = monthlyBudget - (monthPaid - scheduledPaid);
      const ranked =
        hasPromo && strategy === "avalanche"
          ? priorityOrder(debts, strategy, input.order, month)
          : priority;
      for (const i of ranked) {
        if (left <= 0) break;
        const pay = Math.min(left, bal[i]);
        bal[i] -= pay;
        paid[i] += pay;
        monthPaid += pay;
        left -= pay;
      }
    }

    for (let i = 0; i < n; i++) {
      if (bal[i] === 0 && clearedAt[i] === null) clearedAt[i] = month;
      if (debts[i].promo?.months === month) owingAtPromoEnd[i] = bal[i];
    }
    timeline.push({
      month,
      date: addMonths(startDate, month),
      balances: bal.slice() as Cents[],
      total: total(),
      interest: monthInterest as Cents,
      paid: monthPaid as Cents,
    });
  }

  const paidOff = total() === 0;
  const warnings: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = debts[i];
    const firstInterest = round((d.balance * d.annualRate) / 12);
    if (
      strategy === "minimums" &&
      !d.schedule &&
      d.balance > 0 &&
      minimumDue(d.minimum, d.balance + firstInterest) <= firstInterest
    ) {
      warnings.push(`${d.name}: the minimum doesn't cover the interest, so it never shrinks.`);
    }
  }
  for (let i = 0; i < n; i++) {
    const d = debts[i];
    if (!d.promo) continue;
    // Cleared before the promo ended: nothing owing then.
    if (owingAtPromoEnd[i] === undefined) owingAtPromoEnd[i] = 0;
    const left = owingAtPromoEnd[i] as number;
    if (left > 0) {
      warnings.push(
        `${d.name}: $${Math.round(left / 100).toLocaleString("en-AU")} is still owing when the promo rate ends, then it's charged ${(d.annualRate * 100).toFixed(2)}%.`,
      );
    }
  }
  if (!paidOff) warnings.push(`Not all debts are repaid within ${MAX_YEARS} years.`);

  const totalInterest = interest.reduce((s, x) => s + x, 0) as Cents;
  const totalPaid = paid.reduce((s, x) => s + x, 0) as Cents;

  return {
    strategy,
    monthlyBudget,
    paidOff,
    months: month,
    debtFreeDate: addMonths(startDate, month),
    totalInterest,
    totalPaid,
    priority: priority.map((i) => debts[i].id),
    debts: debts.map((d, i) => ({
      id: d.id,
      name: d.name,
      paidOff: clearedAt[i] !== null,
      payoffDate: clearedAt[i] === null ? null : addMonths(startDate, clearedAt[i] as number),
      months: clearedAt[i],
      interest: interest[i] as Cents,
      paid: paid[i] as Cents,
      ...(d.promo
        ? {
            owingWhenPromoEnds: owingAtPromoEnd[i] as Cents,
            promoEndDate: addMonths(startDate, d.promo.months),
          }
        : {}),
    })),
    timeline,
    warnings,
  };
}

export interface StrategyComparison {
  avalanche: PayoffResult;
  snowball: PayoffResult;
  minimums: PayoffResult;
  custom?: PayoffResult;
}

/** Run every strategy on the same debts. `custom` is included when an order is given. */
export function compareStrategies(input: Omit<PayoffInput, "strategy">): StrategyComparison {
  const run = (strategy: DebtStrategy) => simulatePayoff({ ...input, strategy });
  return {
    avalanche: run("avalanche"),
    snowball: run("snowball"),
    minimums: run("minimums"),
    ...(input.order?.length ? { custom: run("custom") } : {}),
  };
}

/**
 * The smallest extra per month (whole dollars) that clears every debt by
 * `targetDate` with this strategy. Returns 0 if the plan already finishes in
 * time, and null if even paying everything off in the first month can't.
 */
export function solveExtraPerMonth(input: PayoffInput, targetDate: string): Cents | null {
  if (input.strategy === "minimums") return null;
  const finishesBy = (dollars: number) => {
    const r = simulatePayoff({ ...input, extraPerMonth: (dollars * 100) as Cents });
    return r.paidOff && r.debtFreeDate <= targetDate;
  };
  if (finishesBy(0)) return 0 as Cents;
  const owed = input.debts.reduce((s, d) => s + d.balance, 0);
  // A month's interest on top of the balance covers clearing it all at once.
  let hi = Math.ceil((owed * 1.1) / 100) + 1;
  if (!finishesBy(hi)) return null;
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (finishesBy(mid)) hi = mid;
    else lo = mid;
  }
  return (hi * 100) as Cents;
}

export interface BalanceTransfer {
  /** Ids of the debts moved onto the new card. */
  from: string[];
  name: string;
  promoRate: number; // e.g. 0 for 0%
  promoMonths: number;
  /** The rate once the promo ends: the card's purchase or cash rate. */
  revertRate: number;
  /** One-off fee as a share of the amount moved, e.g. 0.02 = 2%. Added to the balance. */
  feePercent: number;
  minimum: MinimumRule;
}

/**
 * The same plan with some debts moved onto a balance transfer card: those
 * debts are replaced by one new debt holding their balances plus the fee.
 * The new card goes where the first moved debt was.
 */
export function withBalanceTransfer(input: PayoffInput, t: BalanceTransfer): PayoffInput {
  const moved = input.debts.filter((d) => t.from.includes(d.id));
  if (!moved.length) return input;
  const amount = moved.reduce((s, d) => s + d.balance, 0);
  const id = `bt-${moved[0].id}`;
  const card: Debt = {
    id,
    name: t.name,
    balance: (amount + round(amount * t.feePercent)) as Cents,
    annualRate: t.revertRate,
    minimum: t.minimum,
    promo: { annualRate: t.promoRate, months: t.promoMonths },
  };
  const debts: Debt[] = [];
  for (const d of input.debts) {
    if (d.id === moved[0].id) debts.push(card);
    else if (!t.from.includes(d.id)) debts.push(d);
  }
  const order = input.order
    ?.map((o) => (o === moved[0].id ? id : o))
    .filter((o) => !t.from.includes(o));
  return { ...input, debts, ...(order ? { order } : {}) };
}
