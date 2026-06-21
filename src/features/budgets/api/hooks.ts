"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchUserAccounts } from "@/features/accounts/api/client";
import {
  clearSelectedBudgetId,
  readSelectedBudgetId,
  writeSelectedBudgetId,
} from "@/lib/api/active-budget";
import { useOnlineQueryEnabled } from "@/lib/query/use-online-query-enabled";
import { fetchBudgetAccountIds, syncBudgetAccountLinks } from "./budget-links";
import {
  addCategoryToBudget,
  assignCategoryFunds,
  createBudget,
  deleteBudget,
  fetchAccounts,
  fetchAvailableCategories,
  fetchBudgets,
  fetchCategories,
  updateBudget,
} from "./client";
import { backendBudgetKeys } from "./keys";
import { computeBudgetSummary } from "./summary";
import type { BackendBudget, BackendBudgetFrequency, ViewCadence } from "./types";

export function useBackendBudgets() {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: backendBudgetKeys.list(),
    queryFn: fetchBudgets,
    enabled,
  });
}

export function useSelectedBudgetId(budgets: BackendBudget[] | undefined) {
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedBudgetId());

  useEffect(() => {
    if (!budgets?.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && budgets.some((b) => b.id === selectedId)) return;
    const next = budgets[0].id;
    setSelectedId(next);
    writeSelectedBudgetId(next);
  }, [budgets, selectedId]);

  const selectBudget = useCallback((id: string) => {
    setSelectedId(id);
    writeSelectedBudgetId(id);
  }, []);

  return { selectedId, selectBudget };
}

export function useBackendCategories(budgetId: string | null) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: backendBudgetKeys.categories(budgetId ?? ""),
    queryFn: () => {
      if (!budgetId) throw new Error("budgetId is required");
      return fetchCategories(budgetId);
    },
    enabled: enabled && !!budgetId,
  });
}

export function useBackendAvailableCategories(budgetId: string | null) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: backendBudgetKeys.availableCategories(budgetId ?? ""),
    queryFn: () => {
      if (!budgetId) throw new Error("budgetId is required");
      return fetchAvailableCategories(budgetId);
    },
    enabled: enabled && !!budgetId,
  });
}

export function useBackendAccounts(budgetId: string | null) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: backendBudgetKeys.accounts(budgetId ?? ""),
    queryFn: () => {
      if (!budgetId) throw new Error("budgetId is required");
      return fetchAccounts(budgetId);
    },
    enabled: enabled && !!budgetId,
  });
}

export function useAllUserAccounts() {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: backendBudgetKeys.allUserAccounts(),
    queryFn: fetchUserAccounts,
    enabled,
  });
}

export function useBudgetViewCadence(defaultCadence: ViewCadence) {
  const [viewCadence, setViewCadence] = useState<ViewCadence>(defaultCadence);
  const [periodOffset, setPeriodOffset] = useState(0);

  useEffect(() => {
    setViewCadence(defaultCadence);
    setPeriodOffset(0);
  }, [defaultCadence]);

  return { viewCadence, setViewCadence, periodOffset, setPeriodOffset };
}

export function useBackendBudgetSummary(
  budget: BackendBudget | null | undefined,
  categories: ReturnType<typeof useBackendCategories>["data"],
  viewCadence: ViewCadence,
  transactions?: import("@/features/transactions/types").Transaction[],
  accountIds?: string[],
  range?: import("@/lib/date/periods").DateRange,
) {
  return useMemo(() => {
    if (!budget || !categories) return null;
    return computeBudgetSummary(categories, viewCadence, transactions, accountIds, range);
  }, [budget, categories, viewCadence, transactions, accountIds, range]);
}

function invalidateBudgetQueries(qc: ReturnType<typeof useQueryClient>, budgetId?: string) {
  qc.invalidateQueries({ queryKey: backendBudgetKeys.all });
  if (budgetId) {
    qc.invalidateQueries({ queryKey: backendBudgetKeys.categories(budgetId) });
    qc.invalidateQueries({ queryKey: backendBudgetKeys.availableCategories(budgetId) });
    qc.invalidateQueries({ queryKey: backendBudgetKeys.accounts(budgetId) });
  }
}

export function useCreateBackendBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      currency: string;
      period: BackendBudget["period"];
      startDate: string;
      accountIds?: string[];
    }) => {
      const budget = await createBudget(input);
      if (input.accountIds?.length) {
        await syncBudgetAccountLinks(budget.id, input.accountIds, []);
      }
      return budget;
    },
    onSuccess: (b) => {
      invalidateBudgetQueries(qc);
      writeSelectedBudgetId(b.id);
      toast.success(`${b.name} created`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create budget"),
  });
}

export function useUpdateBackendBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      budgetId,
      ...input
    }: {
      budgetId: string;
      name: string;
      currency: string;
      period: BackendBudget["period"];
      startDate: string;
    }) => updateBudget(budgetId, input),
    onSuccess: (b) => {
      invalidateBudgetQueries(qc, b.id);
      toast.success(`${b.name} saved`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update budget"),
  });
}

export function useDeleteBackendBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      clearSelectedBudgetId();
      invalidateBudgetQueries(qc);
      toast.success("Budget deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete budget"),
  });
}

export function useAssignCategoryFunds(budgetId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      amountCents,
      frequency,
      replaceTarget = false,
    }: {
      categoryId: string;
      amountCents: number;
      frequency: BackendBudgetFrequency;
      replaceTarget?: boolean;
    }) => {
      if (!budgetId) throw new Error("budgetId is required");
      return assignCategoryFunds(budgetId, categoryId, amountCents, frequency, replaceTarget);
    },
    onSuccess: () => {
      if (budgetId) invalidateBudgetQueries(qc, budgetId);
      toast.success("Target saved");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save target"),
  });
}

export function useAddCategoryToBudget(budgetId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => {
      if (!budgetId) throw new Error("budgetId is required");
      return addCategoryToBudget(budgetId, categoryId);
    },
    onSuccess: () => {
      if (budgetId) invalidateBudgetQueries(qc, budgetId);
      toast.success("Category added to budget");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to add category to budget"),
  });
}

export function useSyncBudgetAccountLinks(budgetId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (selectedAccountIds: string[]) => {
      if (!budgetId) throw new Error("budgetId is required");
      const current = await fetchBudgetAccountIds(budgetId);
      await syncBudgetAccountLinks(budgetId, selectedAccountIds, current);
    },
    onSuccess: () => {
      if (budgetId) invalidateBudgetQueries(qc, budgetId);
      toast.success("Linked accounts updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update linked accounts"),
  });
}
