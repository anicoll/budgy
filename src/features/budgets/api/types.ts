import type { Cents } from "@/lib/money/cents";

export type BackendBudgetMethod = "zero_sum" | "envelope";

export interface BackendBudget {
  id: string;
  name: string;
  method: BackendBudgetMethod;
  currency: string;
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
}

export interface BackendAccount {
  id: string;
  name: string;
  balance: Cents;
}

export interface ZeroSumBudgetSummary {
  kind: "zero_sum";
  totalAvailableFunds: Cents;
  totalAssignedFunds: Cents;
  readyToAssign: Cents;
}

export interface EnvelopeBudgetSummary {
  kind: "envelope";
  totalBalance: Cents;
  onTrack: number;
  watch: number;
  overspent: number;
}

export type BackendBudgetSummary = ZeroSumBudgetSummary | EnvelopeBudgetSummary;

export type EnvelopeCategoryStatus = "on_track" | "watch" | "overspent";
