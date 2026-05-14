import type { Cents } from "@/lib/money/cents";

export type RepaymentFrequency = "weekly" | "fortnightly" | "monthly";

export interface MortgagePlan {
  id: string;
  loanAmount: Cents; // original loan (display reference only)
  currentBalance: Cents; // current outstanding balance
  interestRate: number; // annual rate, e.g. 0.065 = 6.5%
  termYears: number; // remaining term years
  startDate: string; // YYYY-MM (loan start or today's month)
  repaymentFrequency: RepaymentFrequency;
  offsetBalance: Cents; // offset account balance (reduces interest-bearing balance)
  redrawBalance: Cents; // funds previously prepaid and available to redraw
  extraRepayment: Cents; // extra per period on top of minimum
  updatedAt: string;
}

export const DEFAULT_MORTGAGE_PLAN: Omit<MortgagePlan, "id" | "updatedAt"> = {
  loanAmount: 65_000_000 as Cents, // $650,000
  currentBalance: 65_000_000 as Cents, // $650,000
  interestRate: 0.06,
  termYears: 30,
  startDate: new Date().toISOString().slice(0, 7), // YYYY-MM
  repaymentFrequency: "monthly",
  offsetBalance: 0 as Cents,
  redrawBalance: 0 as Cents,
  extraRepayment: 0 as Cents,
};
