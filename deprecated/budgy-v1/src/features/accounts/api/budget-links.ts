import { fetchBudgets } from "@/features/budgets/api/client";
import { fetchBudgetAccounts, linkAccountToBudget, unlinkAccountFromBudget } from "./client";

export async function fetchAccountBudgetIds(accountId: string): Promise<string[]> {
  const budgets = await fetchBudgets();
  const linked: string[] = [];
  await Promise.all(
    budgets.map(async (budget) => {
      const accounts = await fetchBudgetAccounts(budget.id);
      if (accounts.some((a) => a.id === accountId)) {
        linked.push(budget.id);
      }
    }),
  );
  return linked;
}

export async function syncAccountBudgetLinks(
  accountId: string,
  selectedBudgetIds: string[],
  currentLinked: string[],
): Promise<void> {
  const selected = new Set(selectedBudgetIds);
  const current = new Set(currentLinked);
  const toAdd = selectedBudgetIds.filter((id) => !current.has(id));
  const toRemove = currentLinked.filter((id) => !selected.has(id));
  await Promise.all([
    ...toAdd.map((budgetId) => linkAccountToBudget(budgetId, accountId)),
    ...toRemove.map((budgetId) => unlinkAccountFromBudget(budgetId, accountId)),
  ]);
}
