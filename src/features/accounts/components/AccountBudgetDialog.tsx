"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fetchBudgets } from "@/features/budgets/api/client";
import { backendBudgetKeys } from "@/features/budgets/api/keys";
import { fetchAccountBudgetIds, syncAccountBudgetLinks } from "../api/budget-links";
import type { Account } from "../types";

interface Props {
  account: Account | null;
  open: boolean;
  onClose: () => void;
}

export function AccountBudgetDialog({ account, open, onClose }: Props) {
  const qc = useQueryClient();
  const accountId = account?.id ?? null;

  const budgetsQuery = useQuery({
    queryKey: backendBudgetKeys.list(),
    queryFn: fetchBudgets,
    enabled: open,
  });

  const linkedQuery = useQuery({
    queryKey: ["accounts", "budget-links", accountId],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return fetchAccountBudgetIds(accountId);
    },
    enabled: open && !!accountId,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (linkedQuery.data) {
      setSelected(new Set(linkedQuery.data));
    }
  }, [linkedQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!accountId || !linkedQuery.data) return;
      await syncAccountBudgetLinks(accountId, [...selected], linkedQuery.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backendBudgetKeys.all });
      qc.invalidateQueries({ queryKey: ["accounts", "budget-links", accountId] });
      toast.success("Budget links updated");
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update budget links"),
  });

  const loading = budgetsQuery.isPending || linkedQuery.isPending;
  const budgets = budgetsQuery.data ?? [];

  function toggleBudget(budgetId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(budgetId);
      else next.delete(budgetId);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to budget</DialogTitle>
          <DialogDescription>
            Choose which budgets include <strong>{account?.name}</strong>. Transactions in linked
            accounts appear in that budget&apos;s reports.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : budgets.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No budgets yet. Create one on the Budgets page first.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 py-1">
            {budgets.map((budget) => (
              <li
                key={budget.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm font-medium">{budget.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {budget.method.replace("_", " ")}
                  </p>
                </div>
                <Switch
                  checked={selected.has(budget.id)}
                  onCheckedChange={(checked) => toggleBudget(budget.id, checked)}
                  aria-label={`Include in ${budget.name}`}
                />
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={loading || budgets.length === 0 || saveMutation.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
