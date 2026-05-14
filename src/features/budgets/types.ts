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

export interface CategoryTarget {
  categoryId: string;
  amount: Cents;
  frequency: BudgetFrequency;
  rollover: boolean;
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

// ── Planner view model ─────────────────────────────────────────────────────

export interface PlannerItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: "income" | "expense";
  nativeAmount: Cents;
  nativeFrequency: BudgetFrequency;
  normalisedAmount: Cents;
}

// ── Legacy actuals view model (kept for actuals.ts) ───────────────────────

export interface FluidActual {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryType: "income" | "expense";
  actual: Cents;
  projectedTarget?: Cents;
  rolloverAmount: Cents;
  effectiveProjected?: Cents;
  variance?: Cents;
  rollover: boolean;
  hasTarget: boolean;
  targetFrequency?: BudgetFrequency;
}

export interface FluidBudgetActuals {
  income: FluidActual[];
  expense: FluidActual[];
  totalActualIncome: Cents;
  totalActualExpense: Cents;
  totalProjectedIncome: Cents;
  totalProjectedExpense: Cents;
  net: Cents;
  projectedNet: Cents;
}
