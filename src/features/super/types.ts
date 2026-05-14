import type { Cents } from "@/lib/money/cents";

export type VoluntaryFrequency = "monthly" | "fortnightly" | "yearly";
export type VoluntaryType = "concessional" | "non-concessional";

export interface SuperPlan {
  id: string;
  currentBalance: Cents;
  annualSalary: Cents;
  employerContributionPct: number; // 0.12 = 12%
  voluntaryContribution: Cents; // amount per voluntaryFrequency
  voluntaryFrequency: VoluntaryFrequency;
  voluntaryType: VoluntaryType;
  expectedReturnPct: number; // 0.07 = 7% p.a.
  inflationPct: number; // 0.025 = 2.5% p.a.
  feesPct: number; // 0.005 = 0.5% p.a.
  currentAge: number;
  retirementAge: number;
  updatedAt: string;
}

export const DEFAULT_SUPER_PLAN: Omit<SuperPlan, "id" | "updatedAt"> = {
  currentBalance: 8_500_000 as Cents, // $85,000
  annualSalary: 10_000_000 as Cents, // $100,000
  employerContributionPct: 0.12,
  voluntaryContribution: 0 as Cents,
  voluntaryFrequency: "monthly",
  voluntaryType: "concessional",
  expectedReturnPct: 0.07,
  inflationPct: 0.025,
  feesPct: 0.005,
  currentAge: 35,
  retirementAge: 67,
};
