/** Session key for the budget selected on the /budgets page. */
export const SELECTED_BUDGET_KEY = "budgy.selectedBudgetId";

export function readSelectedBudgetId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SELECTED_BUDGET_KEY);
}

export function writeSelectedBudgetId(id: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SELECTED_BUDGET_KEY, id);
}

export function clearSelectedBudgetId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SELECTED_BUDGET_KEY);
}
