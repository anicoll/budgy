import type { Cents } from "@/lib/money/cents";
import type { BudgetFrequency } from "./utils/normalise";

export type { BudgetFrequency };

export type BudgetPeriod = "weekly" | "fortnightly" | "monthly" | "yearly";

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Envelope = balance accumulates across periods (sinking fund). Period = resets each period. */
export type BudgetMode = "envelope" | "period";

export const BUDGET_MODE_LABEL: Record<BudgetMode, string> = {
  envelope: "Envelope",
  period: "Period",
};

export interface CategoryTarget {
  categoryId: string;
  amount: Cents;
  frequency: BudgetFrequency;
  mode: BudgetMode;
  /** ISO date — when this envelope started funding. Defaults to budget startDate at creation. */
  openedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  startDate: string;
  targets: CategoryTarget[];
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Envelope view model ──────────────────────────────────────────────────────

export type EnvelopeStatus = "healthy" | "watch" | "overspent";

export interface EnvelopeState {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: "income" | "expense";
  categorySystem?: boolean;
  parentCategoryId?: string;
  parentCategoryName?: string;

  mode: BudgetMode;
  target: CategoryTarget;

  // Envelope figures — populated for envelope mode (mode === "envelope"):
  funded: Cents; // cumulative target funding since openedAt
  spent: Cents; // cumulative spend since openedAt
  balance: Cents; // funded - spent (can be negative)
  expectedBalance: Cents; // what balance "should" be at this moment given the funding cadence

  // Period figures — populated for both modes (used by Period view):
  periodTarget: Cents; // target normalised to current view period
  periodActual: Cents; // actual spend (or receipt) in current view period
  periodVariance: Cents; // periodTarget - periodActual

  status: EnvelopeStatus;

  // Phase 2 — populated by forecast.ts (envelope mode only):
  nextDueOn?: string;
  fundedByNextDue?: Cents;
  forecastConfidence?: "high" | "low";

  // Phase 2 — populated by history.ts (envelope mode only):
  balanceHistory?: { periodStart: string; periodEnd: string; balance: Cents }[];
}

export interface EnvelopeBundle {
  income: EnvelopeState[];
  expense: EnvelopeState[];
  uncategorisedIncome: Cents;
  uncategorisedExpense: Cents;
  totals: {
    funded: Cents;
    spent: Cents;
    balance: Cents;
    periodTargetIncome: Cents;
    periodActualIncome: Cents;
    periodTargetExpense: Cents;
    periodActualExpense: Cents;
  };
}
