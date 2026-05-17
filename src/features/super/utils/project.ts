import type { Cents } from "@/lib/money/cents";
import type { VoluntaryFrequency, VoluntaryType } from "../types";
import { CONCESSIONAL_CAP, DRAWDOWN_YEARS, NON_CONCESSIONAL_CAP } from "./au-rules";

// Days-based normalisation to monthly (consistent with budgets normalise.ts)
const FREQ_DAYS: Record<VoluntaryFrequency, number> = { monthly: 30, fortnightly: 14, yearly: 365 };

function toMonthlyCents(amount: Cents, freq: VoluntaryFrequency): number {
  return (amount * 30) / FREQ_DAYS[freq];
}

export interface ProjectionYear {
  age: number;
  nominal: Cents;
  real: Cents;
}

export interface SuperProjectionResult {
  years: ProjectionYear[]; // one per year, starting from currentAge
  retirementNominal: Cents;
  retirementReal: Cents;
  annualConcessionalContrib: Cents; // employer + concessional voluntary
  annualNonConcessionalContrib: Cents;
  monthlyDrawdown: Cents; // retirementReal / (DRAWDOWN_YEARS × 12), zero real return
  concessionalCapBreached: boolean;
  nonConcessionalCapBreached: boolean;
}

// ── Drawdown phase ────────────────────────────────────────────────────────────

export interface DrawdownYear {
  age: number;
  balance: Cents; // total portfolio balance (nominal)
  withdrawal: Cents; // annual withdrawal that year (inflation-escalated)
}

export interface DrawdownResult {
  drawdownYears: DrawdownYear[];
  depletionAge: number | null; // age when balance hits 0; null if funds last past 100
  monthlyWithdrawal: Cents; // nominal monthly withdrawal at start of retirement
}

export interface DrawdownInput {
  retirementNominal: Cents;
  expectedReturnPct: number;
  inflationPct: number;
  retirementAge: number;
  monthlyDrawdownTarget?: Cents; // today's dollars; if omitted, auto-estimate
  yearsToRetirement: number;
}

/** Compute the retirement drawdown phase on a combined portfolio balance. */
export function computeDrawdown(input: DrawdownInput): DrawdownResult {
  const {
    retirementNominal,
    expectedReturnPct,
    inflationPct,
    retirementAge,
    monthlyDrawdownTarget,
    yearsToRetirement,
  } = input;

  if (retirementNominal <= 0) {
    return { drawdownYears: [], depletionAge: retirementAge, monthlyWithdrawal: 0 as Cents };
  }

  // Inflate today's-dollar target to nominal retirement dollars
  const nominalMonthly: number =
    monthlyDrawdownTarget && monthlyDrawdownTarget > 0
      ? Math.round(monthlyDrawdownTarget * (1 + inflationPct) ** yearsToRetirement)
      : Math.round(retirementNominal / (DRAWDOWN_YEARS * 12));

  const monthlyWithdrawal = nominalMonthly as Cents;

  const drawdownYears: DrawdownYear[] = [];
  let balance: number = retirementNominal;
  let depletionAge: number | null = null;
  let currentMonthly: number = nominalMonthly;

  // First data point: balance at retirement before any withdrawal
  drawdownYears.push({
    age: retirementAge,
    balance: Math.round(balance) as Cents,
    withdrawal: 0 as Cents,
  });

  for (let year = 1; year <= 100 - retirementAge; year++) {
    const age = retirementAge + year;
    const yearlyWithdrawal = Math.round(currentMonthly * 12);

    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + expectedReturnPct / 12) - currentMonthly;
      if (balance <= 0) {
        balance = 0;
        break;
      }
    }

    drawdownYears.push({
      age,
      balance: Math.round(balance) as Cents,
      withdrawal: yearlyWithdrawal as Cents,
    });

    if (balance <= 0) {
      depletionAge = age;
      break;
    }

    // Escalate withdrawal by inflation each year to maintain real purchasing power
    currentMonthly = currentMonthly * (1 + inflationPct);
  }

  return { drawdownYears, depletionAge, monthlyWithdrawal };
}

/**
 * Maximum monthly income (today's dollars) that a portfolio can sustain to age 100.
 *
 * Uses binary search over the existing computeDrawdown simulation so the result
 * is exact for the same discrete model — no separate closed-form approximation needed.
 * Converges to within $1/month (1 cent) after 50 iterations.
 */
export function computeMaxSustainableWithdrawal(params: {
  retirementNominal: Cents;
  expectedReturnPct: number;
  inflationPct: number;
  retirementAge: number;
  yearsToRetirement: number;
}): Cents {
  const { retirementNominal, expectedReturnPct, inflationPct, retirementAge, yearsToRetirement } =
    params;
  if (retirementNominal <= 0 || retirementAge >= 100) return 0 as Cents;

  let lo = 0;
  let hi = retirementNominal; // upper bound: one-month everything (unreachably high)

  for (let i = 0; i < 50; i++) {
    const mid = Math.round((lo + hi) / 2) as Cents;
    const { depletionAge } = computeDrawdown({
      retirementNominal,
      expectedReturnPct,
      inflationPct,
      retirementAge,
      monthlyDrawdownTarget: mid,
      yearsToRetirement,
    });
    if (depletionAge === null) {
      lo = mid; // sustainable — try higher
    } else {
      hi = mid; // depletes — try lower
    }
  }

  return Math.round(lo) as Cents;
}

/**
 * Fortnightly contribution (PMT) needed to accumulate a target lump sum.
 * Uses the future-value annuity formula: PMT = FV × r / ((1+r)^n − 1)
 */
export function computeRequiredContribution(
  targetGap: Cents,
  annualRate: number,
  yearsToRetirement: number,
): Cents {
  if (targetGap <= 0 || yearsToRetirement <= 0) return 0 as Cents;
  const n = yearsToRetirement * 26; // fortnightly periods
  const r = annualRate / 26;
  if (r <= 0) return Math.round(targetGap / Math.max(1, n)) as Cents;
  const pmt = (targetGap * r) / ((1 + r) ** n - 1);
  return Math.round(pmt) as Cents;
}

export interface SuperProjectionInput {
  currentBalance: Cents;
  annualSalary: Cents;
  employerContributionPct: number;
  voluntaryContribution: Cents;
  voluntaryFrequency: VoluntaryFrequency;
  voluntaryType: VoluntaryType;
  expectedReturnPct: number;
  inflationPct: number;
  feesPct: number;
  currentAge: number;
  retirementAge: number;
}

export function projectSuper(input: SuperProjectionInput): SuperProjectionResult {
  const {
    currentBalance,
    annualSalary,
    employerContributionPct,
    voluntaryContribution,
    voluntaryFrequency,
    voluntaryType,
    expectedReturnPct,
    inflationPct,
    feesPct,
    currentAge,
    retirementAge,
  } = input;

  const totalMonths = Math.max(0, Math.round((retirementAge - currentAge) * 12));

  const monthlyEmployer = (annualSalary * employerContributionPct) / 12;
  const monthlyVoluntary = toMonthlyCents(voluntaryContribution, voluntaryFrequency);
  const monthlyConcessional =
    monthlyEmployer + (voluntaryType === "concessional" ? monthlyVoluntary : 0);
  const monthlyNonConcessional = voluntaryType === "non-concessional" ? monthlyVoluntary : 0;

  const annualConcessional = Math.round(monthlyConcessional * 12) as Cents;
  const annualNonConcessional = Math.round(monthlyNonConcessional * 12) as Cents;

  const netMonthlyRate = (expectedReturnPct - feesPct) / 12;
  const monthlyInflationRate = inflationPct / 12;

  const years: ProjectionYear[] = [
    { age: currentAge, nominal: currentBalance, real: currentBalance },
  ];

  if (totalMonths === 0) {
    return {
      years,
      retirementNominal: currentBalance,
      retirementReal: currentBalance,
      annualConcessionalContrib: annualConcessional,
      annualNonConcessionalContrib: annualNonConcessional,
      monthlyDrawdown: Math.round(currentBalance / (DRAWDOWN_YEARS * 12)) as Cents,
      concessionalCapBreached: annualConcessional > CONCESSIONAL_CAP,
      nonConcessionalCapBreached: annualNonConcessional > NON_CONCESSIONAL_CAP,
    };
  }

  let balance = currentBalance as number;

  for (let m = 0; m < totalMonths; m++) {
    balance = balance * (1 + netMonthlyRate) + monthlyConcessional + monthlyNonConcessional;

    const monthsElapsed = m + 1;
    if (monthsElapsed % 12 === 0) {
      const inflationFactor = (1 + monthlyInflationRate) ** monthsElapsed;
      years.push({
        age: currentAge + monthsElapsed / 12,
        nominal: Math.round(balance) as Cents,
        real: Math.round(balance / inflationFactor) as Cents,
      });
    }
  }

  const finalInflationFactor = (1 + monthlyInflationRate) ** totalMonths;
  const retirementNominal = Math.round(balance) as Cents;
  const retirementReal = Math.round(balance / finalInflationFactor) as Cents;

  return {
    years,
    retirementNominal,
    retirementReal,
    annualConcessionalContrib: annualConcessional,
    annualNonConcessionalContrib: annualNonConcessional,
    monthlyDrawdown: Math.round(retirementReal / (DRAWDOWN_YEARS * 12)) as Cents,
    concessionalCapBreached: annualConcessional > CONCESSIONAL_CAP,
    nonConcessionalCapBreached: annualNonConcessional > NON_CONCESSIONAL_CAP,
  };
}
