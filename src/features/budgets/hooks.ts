"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import {
  createBudget,
  deleteBudget,
  ensureMissingTargets,
  getActiveBudgetNormalised,
  listBudgets,
  normaliseLegacyBudget,
  removeTarget,
  setBudgetViewPeriod,
  setTarget,
  updateBudget,
} from "./repository";
import type { BudgetFormValues } from "./schema";
import type { BudgetFrequency, BudgetPeriod } from "./types";

export function useBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets.list(),
    queryFn: async () => {
      const all = await listBudgets();
      return all.map(normaliseLegacyBudget);
    },
  });
}

export function useActiveBudget() {
  return useQuery({
    queryKey: [...queryKeys.budgets.list(), "active"],
    queryFn: getActiveBudgetNormalised,
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

export function useSetTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      budgetId,
      categoryId,
      amount,
      frequency,
      rollover,
    }: {
      budgetId: string;
      categoryId: string;
      amount: number;
      frequency: BudgetFrequency;
      rollover: boolean;
    }) => setTarget(budgetId, categoryId, amount, frequency, rollover),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save target"),
  });
}

export function useRemoveTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, categoryId }: { budgetId: string; categoryId: string }) =>
      removeTarget(budgetId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success("Target removed");
    },
  });
}

export function useSetBudgetViewPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, period }: { id: string; period: BudgetPeriod }) =>
      setBudgetViewPeriod(id, period),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}

export function useEnsureMissingTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, categoryIds }: { budgetId: string; categoryIds: string[] }) =>
      ensureMissingTargets(budgetId, categoryIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to sync budget categories"),
  });
}
