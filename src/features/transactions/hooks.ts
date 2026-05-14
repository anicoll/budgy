"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DateRange } from "@/lib/date/periods";
import { queryKeys } from "@/lib/query/keys";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  toggleCleared,
  updateTransaction,
} from "./repository";
import type { TxnFormValues } from "./schema";

interface ListOpts {
  accountId?: string;
  categoryId?: string;
  range?: DateRange;
  limit?: number;
}

export function useTransactions(opts?: ListOpts) {
  return useQuery({
    queryKey: queryKeys.transactions.list(opts),
    queryFn: () => listTransactions(opts),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: TxnFormValues) => createTransaction(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success("Transaction added");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add transaction"),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TxnFormValues }) =>
      updateTransaction(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success("Transaction updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update transaction"),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success("Transaction deleted");
    },
  });
}

export function useToggleCleared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleCleared(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
