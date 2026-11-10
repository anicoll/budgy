import type { Cents } from "../money/cents";
import { type Debt, type PayoffInput, type PayoffResult, simulatePayoff } from "./payoff";

/**
 * Rolling some debts into one personal loan, compared with the current plan.
 *
 * The chosen debts are replaced by a single fixed-repayment loan holding their
 * balances plus the upfront fee (fees are added to the loan, as many lenders
 * do). The repayment is the level monthly amount that clears the loan over its
 * term, rounded up to the next cent. The rest of the plan is unchanged: the
 * same extra each month and strategy, so any extra can also go to the loan if
 * the strategy ranks it first. Buy now pay later instalments can't be rolled in.
 *
 * "Cost" is interest plus the fee, so the two plans compare like for like.
 */

export interface ConsolidationLoan {
  /** Ids of the debts rolled into the loan. */
  from: string[];
  name: string;
  annualRate: number; // e.g. 0.099
  termMonths: number;
  /** One-off fee in cents, added to the loan. */
  upfrontFee: Cents;
}

export interface ConsolidationResult {
  now: PayoffResult;
  withLoan: PayoffResult;
  /** What's rolled in, before the fee. */
  rolledBalance: Cents;
  fee: Cents;
  /** The loan's fixed repayment each month. */
  loanRepayment: Cents;
  /** Interest plus the fee on each path. */
  costNow: Cents;
  costWithLoan: Cents;
  /** costNow - costWithLoan: positive means the loan costs less. */
  saving: Cents;
  /** Months sooner (positive) or later (negative) than the current plan. */
  monthsSooner: number;
  /** The rolled-in debts' minimums today, to compare with the loan repayment. */
  currentMinimums: Cents;
}

export function validateConsolidation(input: PayoffInput, loan: ConsolidationLoan): string[] {
  const errors: string[] = [];
  const moved = input.debts.filter((d) => loan.from.includes(d.id));
  if (!moved.length) errors.push("choose at least one debt to roll in");
  if (moved.some((d) => d.schedule)) errors.push("buy now pay later can't be rolled into a loan");
  if (!Number.isFinite(loan.annualRate) || loan.annualRate < 0 || loan.annualRate > 1)
    errors.push("loan rate must be between 0% and 100%");
  if (!Number.isInteger(loan.termMonths) || loan.termMonths < 1 || loan.termMonths > 120)
    errors.push("loan term must be 1 to 120 months");
  if (!Number.isInteger(loan.upfrontFee) || loan.upfrontFee < 0)
    errors.push("fee can't be negative");
  return errors;
}

/** Level monthly repayment for a loan, rounded up to the cent. */
export function loanRepayment(balance: Cents, annualRate: number, termMonths: number): Cents {
  const r = annualRate / 12;
  if (balance <= 0) return 0 as Cents;
  if (r === 0) return Math.ceil(balance / termMonths) as Cents;
  const pmt = (balance * r) / (1 - (1 + r) ** -termMonths);
  // The tiny nudge keeps float noise from adding a cent when it divides evenly.
  return Math.ceil(pmt - 1e-6) as Cents;
}

/** The plan with the chosen debts replaced by the loan, placed where the first one was. */
export function withConsolidationLoan(input: PayoffInput, loan: ConsolidationLoan): PayoffInput {
  const moved = input.debts.filter((d) => loan.from.includes(d.id) && !d.schedule);
  if (!moved.length) return input;
  const rolled = moved.reduce((s, d) => s + d.balance, 0);
  const balance = (rolled + loan.upfrontFee) as Cents;
  const id = `cl-${moved[0].id}`;
  const rolledLoan: Debt = {
    id,
    name: loan.name,
    balance,
    annualRate: loan.annualRate,
    minimum: { type: "fixed", amount: loanRepayment(balance, loan.annualRate, loan.termMonths) },
  };
  const ids = moved.map((d) => d.id);
  const debts: Debt[] = [];
  for (const d of input.debts) {
    if (d.id === moved[0].id) debts.push(rolledLoan);
    else if (!ids.includes(d.id)) debts.push(d);
  }
  const order = input.order
    ?.map((o) => (o === moved[0].id ? id : o))
    .filter((o) => !ids.includes(o));
  return { ...input, debts, ...(order ? { order } : {}) };
}

export function compareConsolidation(
  input: PayoffInput,
  loan: ConsolidationLoan,
): ConsolidationResult {
  const errors = validateConsolidation(input, loan);
  if (errors.length) throw new RangeError(errors.join("; "));
  const moved = input.debts.filter((d) => loan.from.includes(d.id));
  const next = withConsolidationLoan(input, loan);
  const now = simulatePayoff(input);
  const withLoan = simulatePayoff(next);
  const fee = loan.upfrontFee;
  const costNow = now.totalInterest;
  const costWithLoan = (withLoan.totalInterest + fee) as Cents;
  const minimumNow = (d: Debt) =>
    d.minimum.type === "fixed"
      ? d.minimum.amount
      : Math.max(d.minimum.floor, Math.round(d.balance * d.minimum.percent));
  const made = next.debts.find((d) => d.id.startsWith("cl-"));
  return {
    now,
    withLoan,
    rolledBalance: moved.reduce((s, d) => s + d.balance, 0) as Cents,
    fee,
    loanRepayment: (made?.minimum.type === "fixed" ? made.minimum.amount : 0) as Cents,
    costNow,
    costWithLoan,
    saving: (costNow - costWithLoan) as Cents,
    monthsSooner: now.months - withLoan.months,
    currentMinimums: moved.reduce((s, d) => s + Math.min(d.balance, minimumNow(d)), 0) as Cents,
  };
}
