"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import { useOnlineQueryEnabled } from "@/lib/query/use-online-query-enabled";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  reorderAccounts,
  setArchived,
  updateAccount,
} from "./repository";
import type { AccountFormValues } from "./schema";

export function useAccounts(opts?: { includeArchived?: boolean }) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: queryKeys.accounts.list({ archived: opts?.includeArchived }),
    queryFn: () => listAccounts(opts),
    enabled,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: AccountFormValues) => createAccount(values),
    onSuccess: (account) => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success(`${account.name} added`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create account"),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AccountFormValues }) =>
      updateAccount(id, values),
    onSuccess: (account) => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success(`${account.name} updated`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update account"),
  });
}

export function useSetArchived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => setArchived(id, archived),
    onSuccess: (account) => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success(account.archived ? `${account.name} archived` : `${account.name} restored`);
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      toast.success("Account deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete account"),
  });
}

export function useReorderAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderAccounts(orderedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
