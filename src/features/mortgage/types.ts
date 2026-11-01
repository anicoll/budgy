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
  split?: LoanSplit; // optional: divide the loan between two or more parties
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

// ─── Split loans ──────────────────────────────────────────────────────────────

/** A one-off extra repayment made by a single party. */
export interface SplitLumpSum {
  id: string;
  date: string; // YYYY-MM — applied in the first repayment period on or after this month
  amount: Cents;
}

/**
 * One party's portion of a jointly held loan.
 *
 * Each party owns a share of the opening balance and is charged interest only
 * on their own outstanding portion, so a party who repays faster stops paying
 * interest on the amount they have cleared.
 */
export interface SplitParty {
  id: string;
  name: string;
  sharePct: number; // 0–100, share of the current loan balance
  extraRepayment: Cents; // extra per period on top of this party's minimum
  offsetBalance: Cents; // this party's own offset funds (only reduce their portion)
  interestRate: number | null; // annual rate override, null = use the loan rate
  lumpSums: SplitLumpSum[];
}

export interface LoanSplit {
  enabled: boolean;
  parties: SplitParty[];
}
