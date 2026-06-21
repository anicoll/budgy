import type { Transaction } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import { cents } from "@/lib/money/cents";
import {
  buildCategoryTypeLookup,
  computeBudgetedTotalsForPeriod,
  computePeriodReceived,
  computePeriodSpent,
} from "./period-summary";
import type {
  BackendAccount,
  BackendBudgetSummary,
  BackendCategory,
  ViewCadence,
  ZeroSumPoolSummary,
} from "./types";

export function computeZeroSumPool(
  accounts: BackendAccount[],
  categories: BackendCategory[],
): ZeroSumPoolSummary {
  let totalAvailable = 0;
  for (const acc of accounts) {
    totalAvailable += acc.balance;
  }

  let totalAssigned = 0;
  for (const cat of categories) {
    if (cat.type === "transfer") continue;
    totalAssigned += cat.budgeted;
  }

  return {
    totalAvailableFunds: cents(totalAvailable),
    totalAssignedFunds: cents(totalAssigned),
    readyToAssign: cents(totalAvailable - totalAssigned),
  };
}

export function computePeriodBudgetSummary(
  accounts: BackendAccount[],
  categories: BackendCategory[],
  viewCadence: ViewCadence,
  transactions: Transaction[],
  accountIds: string[],
  range: DateRange,
  taxonomyCategories?: ReadonlyArray<{ id: string; type: BackendCategory["type"] }>,
): BackendBudgetSummary {
  const pool = computeZeroSumPool(accounts, categories);
  const categoryTypes = buildCategoryTypeLookup(taxonomyCategories ?? categories);
  const periodReceived = computePeriodReceived(transactions, accountIds, range, categoryTypes);
  const periodSpent = computePeriodSpent(transactions, accountIds, range, categoryTypes);
  const { income: budgetedIncome, expenses: budgetedExpenses } = computeBudgetedTotalsForPeriod(
    categories,
    viewCadence,
  );

  return {
    kind: "period",
    pool,
    periodReceived,
    periodSpent,
    periodNet: cents(periodReceived - periodSpent),
    budgetedIncome,
    budgetedExpenses,
    budgetedNet: cents(budgetedIncome - budgetedExpenses),
  };
}

export function computeBudgetSummary(
  accounts: BackendAccount[],
  categories: BackendCategory[],
  viewCadence: ViewCadence,
  transactions?: Transaction[],
  accountIds?: string[],
  range?: DateRange,
  taxonomyCategories?: ReadonlyArray<{ id: string; type: BackendCategory["type"] }>,
): BackendBudgetSummary | null {
  if (!transactions || !accountIds || !range?.from) {
    return null;
  }
  return computePeriodBudgetSummary(
    accounts,
    categories,
    viewCadence,
    transactions,
    accountIds,
    range,
    taxonomyCategories,
  );
}
