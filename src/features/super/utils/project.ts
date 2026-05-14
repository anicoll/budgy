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
