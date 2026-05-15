"use client";

import { CreditCard, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useToggleCleared,
  useTransactions,
  useUpdateTransaction,
} from "../hooks";
import type { defaultTxnValues } from "../schema";
import type { Transaction } from "../types";
import { CsvImportSheet } from "./CsvImportSheet";
import { FilterBar, INITIAL_FILTERS, type TxnFilters } from "./FilterBar";
import { TransactionFormSheet } from "./TransactionFormSheet";
import { TransactionRow } from "./TransactionRow";

export function TransactionsPageClient() {
  const [filters, setFilters] = useState<TxnFilters>(INITIAL_FILTERS);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: allTxns = [], isPending } = useTransactions();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const toggleMutation = useToggleCleared();

  const visible = useMemo(() => {
    let result = allTxns;
    if (filters.accountId !== "all") {
      result = result.filter((t) => t.accountId === filters.accountId);
    }
    if (filters.type !== "all") {
      result = result.filter((t) => t.type === filters.type);
    }
    if (filters.categoryId === "none") {
      result = result.filter((t) => !t.categoryId);
    } else if (filters.categoryId !== "all") {
      result = result.filter((t) => t.categoryId === filters.categoryId);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) => t.payee?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [allTxns, filters]);

  async function handleSubmit(values: ReturnType<typeof defaultTxnValues>) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    setSheetOpen(false);
    setEditing(null);
  }

  function handleEdit(txn: Transaction) {
    setEditing(txn);
    setSheetOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          accounts={accounts}
          categories={categories}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="shrink-0 gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Import CSV
        </Button>
      </div>

      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex flex-col gap-1 p-2">
              {["a", "b", "c", "d", "e"].map((k) => (
                <Skeleton key={k} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState hasFilters={Object.values(filters).some((v) => v !== "all" && v !== "")} />
          ) : (
            <div className="flex flex-col divide-y divide-border/40">
              {visible.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  accounts={accounts}
                  categories={categories}
                  onEdit={handleEdit}
                  onDelete={(t) => setPendingDelete(t)}
                  onToggleCleared={(t) => toggleMutation.mutate(t.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionFormSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === "transfer"
                ? "This is a transfer — deleting it will also remove the paired transaction on the other account."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <CreditCard className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="font-medium">
          {hasFilters ? "No transactions match" : "No transactions yet"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {hasFilters
            ? "Try adjusting your filters."
            : "Use the + button to record your first transaction."}
        </p>
      </div>
    </div>
  );
}
