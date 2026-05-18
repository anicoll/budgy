import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { Budget, BudgetPeriod, EnvelopeBundle } from "../types";

export interface BudgetWorkerInput {
  budget: Budget;
  transactions: Transaction[];
  categories: Category[];
  nowISO: string;
  viewRange: DateRange;
  viewPeriod: BudgetPeriod;
}

export interface BudgetWorkerOutput {
  bundle: EnvelopeBundle;
  // Phase 2 placeholders — populated when forecast/history modules are wired in.
  forecasts: Record<string, null>;
  balanceHistory: Record<string, null>;
}

export interface WorkerMessage {
  id: number;
  payload: BudgetWorkerInput;
}

export interface WorkerResponse {
  id: number;
  payload: BudgetWorkerOutput;
}
