import { addMonths, addYears, isIsoDate, monthsBetween, toDay, toIso } from "../dates";
import type { Cents } from "../money/cents";

/**
 * Lender-style home loan simulation.
 *
 * Models a loan the way Australian lenders run it, rather than textbook PMT:
 *
 * - interest accrues daily on (balance - offset) at annualRate / 365 and is
 *   charged to the loan once a month, on the same day of the month as the start date;
 * - repayments fall on real calendar dates: every 7 days, every 14 days, or on
 *   the monthly anniversary of the start date;
 * - fortnightly repayments are either half the monthly repayment (most common;
 *   about one extra monthly repayment a year) or a true fortnightly amount;
 * - a rate change recalculates the minimum over the remaining term. A repayment
 *   above the new minimum is kept; one below it is raised to the minimum;
 * - the offset can grow by a monthly deposit; only the part up to the balance counts;
 * - lump sums (one-off or yearly) reduce the balance on their date.
 *
 * Everything is JSON in, JSON out, so the same shapes can live in a URL.
 */

export type Frequency = "weekly" | "fortnightly" | "monthly";
export type FortnightlyMethod = "half-monthly" | "true";

export interface LumpSum {
  date: string; // YYYY-MM-DD
  amount: Cents;
  repeatYearly?: boolean;
}

export interface RateChange {
  date: string; // YYYY-MM-DD, takes effect from this day
  annualRate: number; // e.g. 0.0625
}

export interface LoanInput {
  balance: Cents; // owed today
  annualRate: number; // e.g. 0.06
  termMonths: number; // remaining term
  startDate: string; // YYYY-MM-DD; first repayment is one period later
  frequency: Frequency;
  fortnightlyMethod?: FortnightlyMethod; // default "half-monthly"
  /** Pay this per period instead of the minimum (before extraPerPeriod). */
  repayment?: Cents;
  extraPerPeriod?: Cents;
  offsetBalance?: Cents;
  offsetMonthlyDeposit?: Cents;
  lumpSums?: LumpSum[];
  rateChanges?: RateChange[];
  /**
   * With no `repayment` set, reset the repayment to the new minimum at every
   * rate change, so it falls when rates fall, as many lenders do. Default
   * false: the repayment only ever rises to meet a higher minimum.
   */
  followMinimum?: boolean;
}

export type LoanEvent =
  | { date: string; type: "rate-change"; annualRate: number; minimumRepayment: Cents }
  | { date: string; type: "repayment-raised"; from: Cents; to: Cents }
  | { date: string; type: "repayment-lowered"; from: Cents; to: Cents }
  | { date: string; type: "lump-sum"; amount: Cents };

export interface YearRow {
  year: number; // 1 = the first 12 months
  endDate: string;
  interest: Cents;
  principal: Cents;
  closingBalance: Cents;
}

export interface BalancePoint {
  date: string;
  balance: Cents;
  /** Interest charged from the start up to and including this date. */
  interestToDate: Cents;
}

export interface SimulationResult {
  /** Minimum repayment per period at the start. */
  minimumRepayment: Cents;
  /** What is actually paid per period at the start, extras included. */
  repayment: Cents;
  payoffDate: string;
  repaymentCount: number;
  totalInterest: Cents;
  totalPaid: Cents;
  paidOff: boolean; // false if the loan outlives the simulation limit
  yearly: YearRow[];
  /** Balance on each monthly interest-charge date, plus the start. */
  balances: BalancePoint[];
  events: LoanEvent[];
  warnings: string[];
}

/** Hard stop so a repayment below the interest can't loop forever. */
const MAX_YEARS = 100;

const PERIODS_PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12 } as const;

/** Standard annuity repayment, rounded up to the cent. */
export function pmt(balance: number, periodRate: number, periods: number): Cents {
  if (balance <= 0) return 0 as Cents;
  if (periods <= 0) return Math.ceil(balance) as Cents;
  if (periodRate === 0) return Math.ceil(balance / periods) as Cents;
  return Math.ceil((balance * periodRate) / (1 - (1 + periodRate) ** -periods)) as Cents;
}

/**
 * The lender's minimum repayment per period for a balance, rate and months left.
 */
export function minimumRepayment(
  balance: number,
  annualRate: number,
  monthsLeft: number,
  frequency: Frequency,
  fortnightlyMethod: FortnightlyMethod = "half-monthly",
): Cents {
  const monthly = pmt(balance, annualRate / 12, monthsLeft);
  if (frequency === "monthly") return monthly;
  if (frequency === "fortnightly" && fortnightlyMethod === "half-monthly") {
    return Math.ceil(monthly / 2) as Cents;
  }
  const ppy = PERIODS_PER_YEAR[frequency];
  return pmt(balance, annualRate / ppy, Math.round((monthsLeft * ppy) / 12));
}

export function validateLoan(input: LoanInput): string[] {
  const errors: string[] = [];
  const isCents = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
  if (!isCents(input.balance) || input.balance <= 0) errors.push("balance must be above zero");
  if (!(input.annualRate >= 0 && input.annualRate <= 0.2))
    errors.push("rate must be between 0 and 20%");
  if (!(Number.isInteger(input.termMonths) && input.termMonths >= 1 && input.termMonths <= 480))
    errors.push("term must be between 1 month and 40 years");
  if (!isIsoDate(input.startDate)) errors.push("start date must be YYYY-MM-DD");
  if (!["weekly", "fortnightly", "monthly"].includes(input.frequency))
    errors.push("frequency must be weekly, fortnightly or monthly");
  for (const k of [
    "repayment",
    "extraPerPeriod",
    "offsetBalance",
    "offsetMonthlyDeposit",
  ] as const) {
    if (input[k] !== undefined && !isCents(input[k]))
      errors.push(`${k} must be whole cents, zero or more`);
  }
  for (const l of input.lumpSums ?? []) {
    if (!isIsoDate(l.date) || !isCents(l.amount))
      errors.push("each lump sum needs a date and amount");
  }
  for (const r of input.rateChanges ?? []) {
    if (!isIsoDate(r.date) || !(r.annualRate >= 0 && r.annualRate <= 0.2))
      errors.push("each rate change needs a date and a rate between 0 and 20%");
  }
  return errors;
}

export function simulateLoan(input: LoanInput): SimulationResult {
  const errors = validateLoan(input);
  if (errors.length) throw new RangeError(errors.join("; "));

  const {
    startDate,
    frequency,
    fortnightlyMethod = "half-monthly",
    extraPerPeriod = 0,
    offsetMonthlyDeposit = 0,
  } = input;
  const endDate = addMonths(startDate, input.termMonths);
  const startDay = toDay(startDate);
  const lastDay = toDay(addYears(startDate, MAX_YEARS));
  const endDay = toDay(endDate);

  // Calendar of things that happen on a given day.
  const rateByDay = new Map<number, number>();
  for (const r of input.rateChanges ?? []) {
    const d = toDay(r.date);
    if (d > startDay) rateByDay.set(d, r.annualRate);
  }
  const lumpByDay = new Map<number, number>();
  for (const l of input.lumpSums ?? []) {
    for (let y = 0; y < MAX_YEARS; y++) {
      const d = toDay(addYears(l.date, y));
      if (d > lastDay) break;
      if (d > startDay) lumpByDay.set(d, (lumpByDay.get(d) ?? 0) + l.amount);
      if (!l.repeatYearly) break;
    }
  }

  let monthIndex = 1;
  let nextChargeDay = toDay(addMonths(startDate, 1));
  let repaymentIndex = 1;
  const repaymentDay = (k: number) =>
    frequency === "monthly"
      ? toDay(addMonths(startDate, k))
      : startDay + k * (frequency === "weekly" ? 7 : 14);
  let nextRepaymentDay = repaymentDay(1);

  let rate = input.annualRate;
  let balance = input.balance as number;
  let offset = input.offsetBalance ?? 0;
  let accrued = 0; // interest accrued since last charge, fractional cents

  const minimum0 = minimumRepayment(balance, rate, input.termMonths, frequency, fortnightlyMethod);
  let base = input.repayment ?? minimum0;
  const warnings: string[] = [];
  if (input.repayment !== undefined && input.repayment < minimum0) {
    warnings.push("The repayment entered is below the lender's minimum.");
  }

  const events: LoanEvent[] = [];
  const balances: BalancePoint[] = [
    { date: startDate, balance: balance as Cents, interestToDate: 0 as Cents },
  ];
  const yearly: YearRow[] = [];
  let yearInterest = 0;
  let yearPrincipal = 0;
  let yearEnd = toDay(addYears(startDate, 1));

  let totalInterest = 0;
  let totalPaid = 0;
  let repaymentCount = 0;
  let payoffDay = startDay;
  let paidOff = false;

  const closeYear = (day: number) => {
    yearly.push({
      year: yearly.length + 1,
      endDate: toIso(day),
      interest: Math.round(yearInterest) as Cents,
      principal: Math.round(yearPrincipal) as Cents,
      closingBalance: balance as Cents,
    });
    yearInterest = 0;
    yearPrincipal = 0;
  };

  const pay = (amount: number) => {
    const p = Math.min(amount, balance);
    balance -= p;
    yearPrincipal += p;
    totalPaid += p;
    return p;
  };

  for (let day = startDay + 1; day <= lastDay; day++) {
    // 1. Rate change from today.
    const newRate = rateByDay.get(day);
    if (newRate !== undefined) {
      rate = newRate;
      // Months left in the term, counting a part month as a whole one.
      const whole = monthsBetween(toIso(day), endDate);
      const monthsLeft = Math.max(1, addMonths(toIso(day), whole) < endDate ? whole + 1 : whole);
      const min = minimumRepayment(balance, rate, monthsLeft, frequency, fortnightlyMethod);
      events.push({
        date: toIso(day),
        type: "rate-change",
        annualRate: rate,
        minimumRepayment: min,
      });
      if (base < min) {
        events.push({ date: toIso(day), type: "repayment-raised", from: base as Cents, to: min });
        base = min;
      } else if (input.followMinimum && input.repayment === undefined && base > min) {
        events.push({ date: toIso(day), type: "repayment-lowered", from: base as Cents, to: min });
        base = min;
      }
    }

    // 2. Charge the month's interest.
    const chargeDay = day === nextChargeDay;
    if (chargeDay) {
      const charged = Math.round(accrued);
      balance += charged;
      totalInterest += charged;
      yearInterest += charged;
      yearPrincipal -= charged; // repayments clear charged interest before principal
      accrued = 0;
      monthIndex++;
      nextChargeDay = toDay(addMonths(startDate, monthIndex));
      offset += offsetMonthlyDeposit;
    }

    // 3. Repayment due today.
    if (day === nextRepaymentDay) {
      const due = base + extraPerPeriod;
      const owing = balance + Math.round(accrued);
      if (due >= owing) {
        // Final repayment: settle accrued interest and the balance.
        const interest = Math.round(accrued);
        totalInterest += interest;
        yearInterest += interest;
        totalPaid += interest;
        accrued = 0;
        pay(balance);
      } else {
        pay(due);
      }
      repaymentCount++;
      repaymentIndex++;
      nextRepaymentDay = repaymentDay(repaymentIndex);
    }

    // 4. Lump sum today.
    const lump = lumpByDay.get(day);
    if (lump && balance > 0) {
      const paid = pay(lump);
      events.push({ date: toIso(day), type: "lump-sum", amount: paid as Cents });
    }

    if (chargeDay) {
      balances.push({
        date: toIso(day),
        balance: balance as Cents,
        interestToDate: totalInterest as Cents,
      });
    }

    if (balance <= 0 && accrued < 0.5) {
      payoffDay = day;
      paidOff = true;
      break;
    }

    // 5. Accrue today's interest on the closing balance less offset.
    const interestBearing = Math.max(0, balance - Math.min(offset, balance));
    accrued += (interestBearing * rate) / 365;

    if (day === yearEnd) {
      closeYear(day);
      yearEnd = toDay(addYears(startDate, yearly.length + 1));
    }
  }

  if (paidOff) {
    if (yearInterest !== 0 || yearPrincipal !== 0) closeYear(payoffDay);
    if (balances.at(-1)?.date !== toIso(payoffDay)) {
      balances.push({
        date: toIso(payoffDay),
        balance: 0 as Cents,
        interestToDate: totalInterest as Cents,
      });
    }
  } else {
    payoffDay = lastDay;
    warnings.push(`The loan is not repaid within ${MAX_YEARS} years at this repayment.`);
  }
  if (paidOff && payoffDay > endDay + 31) {
    warnings.push("The loan runs past its term at this repayment.");
  }

  return {
    minimumRepayment: minimum0,
    repayment: ((input.repayment ?? minimum0) + extraPerPeriod) as Cents,
    payoffDate: toIso(payoffDay),
    repaymentCount,
    totalInterest: totalInterest as Cents,
    totalPaid: Math.round(totalPaid) as Cents,
    paidOff,
    yearly,
    balances,
    events,
    warnings,
  };
}
