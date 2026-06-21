import type { Cents } from "@/lib/money/cents";
import type { BudgetFrequency } from "../utils/normalise";

export type BackendBudgetPeriod = "weekly" | "fortnightly" | "monthly";

export type BackendBudgetFrequency = BudgetFrequency;

export interface BackendBudget {
  id: string;
  name: string;
  currency: string;
  period: BackendBudgetPeriod;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendCategory {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parentId: string | null;
  system: boolean;
  budgeted: Cents;
  balance: Cents;
  targetLimit: Cents;
  budgetedFrequency: BackendBudgetFrequency;
}

export interface AvailableCategory {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
}

export interface BackendAccount {
  id: string;
  name: string;
  balance: Cents;
}

export interface PeriodBudgetSummary {
  kind: "period";
  periodReceived: Cents;
  periodSpent: Cents;
  periodNet: Cents;
  budgetedIncome: Cents;
  budgetedExpenses: Cents;
  budgetedNet: Cents;
}

export type BackendBudgetSummary = PeriodBudgetSummary;

export type ViewCadence = BackendBudgetPeriod;

export interface CategoryPeriodView {
  periodTarget: Cents;
  periodActual: Cents;
  /** Positive magnitude for display (received or spent). */
  periodActualDisplay: Cents;
  periodRemaining: Cents;
  overTarget: boolean;
  actualLabel: "Received" | "Spent";
}
