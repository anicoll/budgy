import { linkAccountToBudget, unlinkAccountFromBudget } from "@/features/accounts/api/client";
import { fetchAccounts } from "./client";

export async function fetchBudgetAccountIds(budgetId: string): Promise<string[]> {
  const accounts = await fetchAccounts(budgetId);
  return accounts.map((a) => a.id);
}

export async function syncBudgetAccountLinks(
  budgetId: string,
  selectedAccountIds: string[],
  currentLinked: string[],
): Promise<void> {
  const selected = new Set(selectedAccountIds);
  const current = new Set(currentLinked);
  const toAdd = selectedAccountIds.filter((id) => !current.has(id));
  const toRemove = currentLinked.filter((id) => !selected.has(id));
  await Promise.all([
    ...toAdd.map((accountId) => linkAccountToBudget(budgetId, accountId)),
    ...toRemove.map((accountId) => unlinkAccountFromBudget(budgetId, accountId)),
  ]);
}
