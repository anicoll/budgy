"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import {
  createBudget,
  deleteBudget,
  getActiveBudget,
  listBudgets,
  removeAllocation,
  updateBudget,
  upsertAllocation,
} from "./repository";
import type { BudgetFormValues } from "./schema";

export function useBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets.list(),
    queryFn: listBudgets,
  });
}

export function useActiveBudget() {
  return useQuery({
    queryKey: [...queryKeys.budgets.list(), "active"],
    queryFn: getActiveBudget,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: BudgetFormValues) => createBudget(values),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success(`${b.name} created`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create budget"),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: BudgetFormValues }) =>
      updateBudget(id, values),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success(`${b.name} saved`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update budget"),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success("Budget deleted");
    },
  });
}

export function useUpsertAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      budgetId,
      categoryId,
      amount,
      rollover,
    }: {
      budgetId: string;
      categoryId: string;
      amount: number;
      rollover: boolean;
    }) => upsertAllocation(budgetId, categoryId, amount, rollover),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save allocation"),
  });
}

export function useRemoveAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, categoryId }: { budgetId: string; categoryId: string }) =>
      removeAllocation(budgetId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success("Allocation removed");
    },
  });
}
