import { cents } from "@/lib/money/cents";
import type { DateRange } from "@/lib/date/periods";
import type { Transaction } from "@/features/transactions/types";
import {
  computeBudgetedTotalsForPeriod,
  computePeriodReceived,
  computePeriodSpent,
} from "./period-summary";
import type { BackendBudgetSummary, BackendCategory, ViewCadence } from "./types";

export function computePeriodBudgetSummary(
  categories: BackendCategory[],
  viewCadence: ViewCadence,
  transactions: Transaction[],
  accountIds: string[],
  range: DateRange,
): BackendBudgetSummary {
  const periodReceived = computePeriodReceived(transactions, accountIds, range);
  const periodSpent = computePeriodSpent(transactions, accountIds, range);
  const { income: budgetedIncome, expenses: budgetedExpenses } = computeBudgetedTotalsForPeriod(
    categories,
    viewCadence,
  );

  return {
    kind: "period",
    periodReceived,
    periodSpent,
    periodNet: cents(periodReceived - periodSpent),
    budgetedIncome,
    budgetedExpenses,
    budgetedNet: cents(budgetedIncome - budgetedExpenses),
  };
}

export function computeBudgetSummary(
  categories: BackendCategory[],
  viewCadence: ViewCadence,
  transactions?: Transaction[],
  accountIds?: string[],
  range?: DateRange,
): BackendBudgetSummary | null {
  if (!transactions || !accountIds || !range?.from) {
    return null;
  }
  return computePeriodBudgetSummary(categories, viewCadence, transactions, accountIds, range);
}
