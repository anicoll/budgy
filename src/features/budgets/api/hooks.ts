"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  assignCategoryFunds,
  createBudget,
  deleteBudget,
  fetchAccounts,
  fetchBudgets,
  fetchCategories,
  fundEnvelope,
  updateBudget,
} from "./client";
import { backendBudgetKeys } from "./keys";
import { computeBudgetSummary } from "./summary";
import type { BackendBudget, BackendBudgetMethod } from "./types";

const SELECTED_BUDGET_KEY = "budgy.selectedBudgetId";

export function useBackendBudgets() {
  return useQuery({
    queryKey: backendBudgetKeys.list(),
    queryFn: fetchBudgets,
  });
}

export function useSelectedBudgetId(budgets: BackendBudget[] | undefined) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SELECTED_BUDGET_KEY);
  });

  useEffect(() => {
    if (!budgets?.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && budgets.some((b) => b.id === selectedId)) return;
    const next = budgets[0].id;
    setSelectedId(next);
    sessionStorage.setItem(SELECTED_BUDGET_KEY, next);
  }, [budgets, selectedId]);

  const selectBudget = useCallback((id: string) => {
    setSelectedId(id);
    sessionStorage.setItem(SELECTED_BUDGET_KEY, id);
  }, []);

  return { selectedId, selectBudget };
}

export function useBackendCategories(budgetId: string | null) {
  return useQuery({
    queryKey: backendBudgetKeys.categories(budgetId ?? ""),
    queryFn: () => {
      if (!budgetId) throw new Error("budgetId is required");
      return fetchCategories(budgetId);
    },
    enabled: !!budgetId,
  });
}

export function useBackendAccounts(budgetId: string | null) {
  return useQuery({
    queryKey: backendBudgetKeys.accounts(budgetId ?? ""),
    queryFn: () => {
      if (!budgetId) throw new Error("budgetId is required");
      return fetchAccounts(budgetId);
    },
    enabled: !!budgetId,
  });
}

export function useBackendBudgetSummary(
  budget: BackendBudget | null | undefined,
  categories: ReturnType<typeof useBackendCategories>["data"],
  accounts: ReturnType<typeof useBackendAccounts>["data"],
) {
  return useMemo(() => {
    if (!budget || !categories) return null;
    return computeBudgetSummary(budget.method, accounts ?? [], categories);
  }, [budget, categories, accounts]);
}

function invalidateBudgetQueries(qc: ReturnType<typeof useQueryClient>, budgetId?: string) {
  qc.invalidateQueries({ queryKey: backendBudgetKeys.all });
  if (budgetId) {
    qc.invalidateQueries({ queryKey: backendBudgetKeys.categories(budgetId) });
    qc.invalidateQueries({ queryKey: backendBudgetKeys.accounts(budgetId) });
  }
}

export function useCreateBackendBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBudget,
    onSuccess: (b) => {
      invalidateBudgetQueries(qc);
      sessionStorage.setItem(SELECTED_BUDGET_KEY, b.id);
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
      method: BackendBudgetMethod;
      currency: string;
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
      sessionStorage.removeItem(SELECTED_BUDGET_KEY);
      invalidateBudgetQueries(qc);
      toast.success("Budget deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete budget"),
  });
}

export function useAssignCategoryFunds(budgetId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, amountCents }: { categoryId: string; amountCents: number }) => {
      if (!budgetId) throw new Error("budgetId is required");
      return assignCategoryFunds(budgetId, categoryId, amountCents);
    },
    onSuccess: () => {
      if (budgetId) invalidateBudgetQueries(qc, budgetId);
      toast.success("Funds assigned");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to assign funds"),
  });
}

export function useFundEnvelope(budgetId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      accountId,
      amountCents,
    }: {
      categoryId: string;
      accountId: string;
      amountCents: number;
    }) => {
      if (!budgetId) throw new Error("budgetId is required");
      return fundEnvelope(budgetId, categoryId, accountId, amountCents);
    },
    onSuccess: () => {
      if (budgetId) invalidateBudgetQueries(qc, budgetId);
      toast.success("Envelope funded");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to fund envelope"),
  });
}
