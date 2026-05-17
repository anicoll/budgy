import type { Cents } from "@/lib/money/cents";

export type VoluntaryFrequency = "monthly" | "fortnightly" | "yearly";
export type VoluntaryType = "concessional" | "non-concessional";

// Shared across all super funds — person-level settings
export interface SuperSettings {
  id: string; // singleton: "primary"
  inflationPct: number; // e.g. 0.025
  currentAge: number;
  retirementAge: number;
  employerContributionPct: number; // e.g. 0.12
  activePlanId: string | null; // which fund receives employer SG
  monthlyDrawdownTarget?: Cents; // desired monthly income in retirement (today's dollars)
  updatedAt: string;
}

// Per-fund record — each fund has its own balance, return rate, fees, voluntary
export interface SuperPlan {
  id: string;
  name: string;
  currentBalance: Cents;
  voluntaryContribution: Cents;
  voluntaryFrequency: VoluntaryFrequency;
  voluntaryType: VoluntaryType;
  expectedReturnPct: number; // 0.07 = 7% p.a.
  feesPct: number; // 0.005 = 0.5% p.a.
  updatedAt: string;
  // Per-fund owner overrides. When ownerSalary is defined this fund is
  // "independently active" and receives its own employer SG contributions
  // using these values instead of the global SuperSettings.
  ownerLabel?: string; // e.g. "Spouse"
  ownerSalary?: Cents; // gross annual salary (presence makes fund independently active)
  ownerCurrentAge?: number; // overrides SuperSettings.currentAge for this fund
  ownerRetirementAge?: number; // overrides SuperSettings.retirementAge for this fund
  ownerEmployerPct?: number; // overrides SuperSettings.employerContributionPct for this fund
}

export const DEFAULT_SUPER_SETTINGS: Omit<SuperSettings, "id" | "updatedAt"> = {
  inflationPct: 0.025,
  currentAge: 35,
  retirementAge: 67,
  employerContributionPct: 0.12,
  activePlanId: null,
};

export const DEFAULT_SUPER_PLAN: Omit<SuperPlan, "id" | "updatedAt"> = {
  name: "My Super",
  currentBalance: 8_500_000 as Cents, // $85,000
  voluntaryContribution: 0 as Cents,
  voluntaryFrequency: "monthly",
  voluntaryType: "concessional",
  expectedReturnPct: 0.07,
  feesPct: 0.005,
};
