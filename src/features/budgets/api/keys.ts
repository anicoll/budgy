export const backendBudgetKeys = {
  all: ["backend-budgets"] as const,
  list: () => [...backendBudgetKeys.all, "list"] as const,
  categories: (budgetId: string) => [...backendBudgetKeys.all, "categories", budgetId] as const,
  availableCategories: (budgetId: string) =>
    [...backendBudgetKeys.all, "available-categories", budgetId] as const,
  accounts: (budgetId: string) => [...backendBudgetKeys.all, "accounts", budgetId] as const,
  allUserAccounts: () => [...backendBudgetKeys.all, "all-user-accounts"] as const,
};
