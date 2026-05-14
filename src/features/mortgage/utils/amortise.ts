import type { Cents } from "@/lib/money/cents";
import type { MortgagePlan, RepaymentFrequency } from "../types";

export const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

/** PMT: minimum periodic repayment for a loan. */
export function calcMinRepayment(
  balance: Cents,
  annualRate: number,
  termYears: number,
  freq: RepaymentFrequency,
): Cents {
  const n = termYears * PERIODS_PER_YEAR[freq];
  const r = annualRate / PERIODS_PER_YEAR[freq];
  if (r === 0 || n === 0) return Math.ceil(balance / Math.max(1, n)) as Cents;
  return Math.round((balance * r) / (1 - (1 + r) ** -n)) as Cents;
}

export interface AmortisationRow {
  period: number;
  date: string; // YYYY-MM
  opening: Cents;
  interest: Cents; // charged on (opening - offset)
  principal: Cents; // paid down from balance
  extra: Cents; // extra repayment component
  offset: Cents; // offset balance this period
  closing: Cents;
  cumulativeInterest: Cents;
}

export interface AmortisationResult {
  rows: AmortisationRow[];
  minimumRepayment: Cents; // per period (without extra)
  totalInterest: Cents;
  totalRepayments: Cents;
  payoffPeriods: number;
  payoffDate: string; // YYYY-MM
  interestSaved: Cents; // vs baseline (no offset, no extra, no redraw effect)
  periodsSaved: number; // vs baseline
  redrawBalance: Cents; // available to redraw (shown informationally)
}

function addMonths(yyyyMM: string, months: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const total = y * 12 + m - 1 + months;
  const yr = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${yr}-${String(mo).padStart(2, "0")}`;
}

function periodToDate(startDate: string, period: number, freq: RepaymentFrequency): string {
  if (freq === "monthly") return addMonths(startDate, period);
  // For weekly/fortnightly, approximate as months (close enough for display)
  const daysPerPeriod = freq === "weekly" ? 7 : 14;
  const daysElapsed = period * daysPerPeriod;
  return addMonths(startDate, Math.round(daysElapsed / 30.44));
}

function runAmortisation(
  currentBalance: Cents,
  annualRate: number,
  termYears: number,
  freq: RepaymentFrequency,
  offset: Cents,
  extra: Cents,
  startDate: string,
): Pick<
  AmortisationResult,
  "rows" | "totalInterest" | "totalRepayments" | "payoffPeriods" | "payoffDate"
> {
  const maxPeriods = termYears * PERIODS_PER_YEAR[freq];
  const periodRate = annualRate / PERIODS_PER_YEAR[freq];
  const minRepayment = calcMinRepayment(currentBalance, annualRate, termYears, freq);
  const repayment = minRepayment + extra;

  let balance = currentBalance as number;
  let totalInterest = 0;
  let totalRepayments = 0;
  let cumulativeInterest = 0;
  const rows: AmortisationRow[] = [];

  for (let p = 0; p < maxPeriods && balance > 0; p++) {
    const opening = balance;
    const interestBearing = Math.max(0, opening - offset);
    const interest = Math.round(interestBearing * periodRate);

    // Repayment this period — cap at remaining balance + interest
    const maxPrincipal = opening;
    const principalAndExtra = Math.min(maxPrincipal, Math.max(0, repayment - interest));
    const closing = Math.max(0, opening - principalAndExtra);
    const principalPaid = opening - closing;
    const extraComponent = Math.max(0, principalPaid - (minRepayment - interest));

    cumulativeInterest += interest;

    rows.push({
      period: p + 1,
      date: periodToDate(startDate, p + 1, freq),
      opening: Math.round(opening) as Cents,
      interest: interest as Cents,
      principal: Math.round(principalPaid) as Cents,
      extra: Math.round(extraComponent) as Cents,
      offset,
      closing: Math.round(closing) as Cents,
      cumulativeInterest: Math.round(cumulativeInterest) as Cents,
    });

    totalInterest += interest;
    totalRepayments += interest + principalPaid;
    balance = closing;
  }

  const lastRow = rows[rows.length - 1];
  return {
    rows,
    totalInterest: Math.round(totalInterest) as Cents,
    totalRepayments: Math.round(totalRepayments) as Cents,
    payoffPeriods: rows.length,
    payoffDate: lastRow?.date ?? startDate,
  };
}

export type AmortiseInput = Omit<MortgagePlan, "id" | "updatedAt">;

export function amortise(plan: AmortiseInput): AmortisationResult {
  const {
    currentBalance,
    interestRate,
    termYears,
    repaymentFrequency,
    offsetBalance,
    redrawBalance,
    extraRepayment,
    startDate,
  } = plan;

  const current = runAmortisation(
    currentBalance,
    interestRate,
    termYears,
    repaymentFrequency,
    offsetBalance,
    extraRepayment,
    startDate,
  );

  // Baseline: original loan amount (before any extra repayments were paid into redraw),
  // with no offset and no extra going forward — shows total savings from all optimisations.
  const originalBalance = (currentBalance + redrawBalance) as Cents;
  const baseline = runAmortisation(
    originalBalance,
    interestRate,
    termYears,
    repaymentFrequency,
    0 as Cents,
    0 as Cents,
    startDate,
  );

  return {
    ...current,
    minimumRepayment: calcMinRepayment(currentBalance, interestRate, termYears, repaymentFrequency),
    interestSaved: Math.max(0, baseline.totalInterest - current.totalInterest) as Cents,
    periodsSaved: Math.max(0, baseline.payoffPeriods - current.payoffPeriods),
    redrawBalance,
  };
}

/** Yearly snapshots for the balance chart (one data point per year). */
export function yearlyBalanceSnapshot(
  rows: AmortisationRow[],
  freq: RepaymentFrequency,
  currentBalance: Cents,
  startDate: string,
): { date: string; balance: Cents }[] {
  const ppy = PERIODS_PER_YEAR[freq];
  const snapshots: { date: string; balance: Cents }[] = [
    { date: startDate, balance: currentBalance },
  ];

  for (let i = ppy - 1; i < rows.length; i += ppy) {
    const row = rows[i];
    snapshots.push({ date: row.date, balance: row.closing });
    if (row.closing === 0) break;
  }

  return snapshots;
}
