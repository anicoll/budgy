"use client";

import { useQueryClient } from "@tanstack/react-query";
import { EyeOff, Link as LinkIcon, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getBasiqAuthLink, syncBasiq } from "@/lib/api/basiq";
import { queryKeys } from "@/lib/query/keys";
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useReorderAccounts,
  useSetArchived,
  useUpdateAccount,
} from "../hooks";
import type { Account } from "../types";
import { AccountFormSheet } from "./AccountFormSheet";
import { AccountList } from "./AccountList";
import { AccountsEmpty } from "./AccountsEmpty";
import { AccountsSummary } from "./AccountsSummary";

type SheetMode = { kind: "create" } | { kind: "edit"; account: Account } | null;

export function AccountsPageClient() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const accountsQuery = useAccounts({ includeArchived: showArchived });
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const archiveMutation = useSetArchived();
  const deleteMutation = useDeleteAccount();
  const reorderMutation = useReorderAccounts();

  const submitting = createMutation.isPending || updateMutation.isPending;
  const accounts = accountsQuery.data ?? [];
  const hasAny = accounts.length > 0;
  const hasConnectedBank = accounts.some((a) => !!a.connectionId);

  async function handleConnectBank() {
    setIsConnecting(true);
    try {
      const { connect_url } = await getBasiqAuthLink();
      toast.success("Redirecting to bank authorization...");
      window.location.href = connect_url;
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to connect to bank");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSyncBank() {
    setIsSyncing(true);
    try {
      await syncBasiq();
      toast.success("Bank accounts synced successfully!");
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to sync bank accounts");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSubmit(
    values: Parameters<typeof createMutation.mutateAsync>[0],
    mode: NonNullable<SheetMode>,
  ) {
    if (mode.kind === "create") {
      await createMutation.mutateAsync(values);
    } else {
      await updateMutation.mutateAsync({ id: mode.account.id, values });
    }
    setSheetMode(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            aria-label="Show archived accounts"
          />
          <label
            htmlFor="show-archived"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" /> Show archived
          </label>
        </div>
        <div className="flex items-center gap-2">
          {hasConnectedBank && (
            <Button
              onClick={handleSyncBank}
              disabled={isSyncing || accountsQuery.isPending}
              variant="outline"
              className="border-violet-500/30 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 font-medium"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              Sync Bank
            </Button>
          )}
          <Button
            onClick={handleConnectBank}
            disabled={isConnecting}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-indigo-500/10 transition-all"
          >
            <LinkIcon className={`mr-1.5 h-4 w-4 ${isConnecting ? "animate-pulse" : ""}`} />
            Connect Bank
          </Button>
          <Button
            onClick={() => setSheetMode({ kind: "create" })}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90 font-medium"
          >
            <Plus className="mr-1 h-4 w-4" /> Add account
          </Button>
        </div>
      </div>

      {accountsQuery.isPending ? (
        <LoadingSkeleton />
      ) : hasAny ? (
        <>
          <AccountsSummary accounts={accounts} />
          <AccountList
            accounts={accounts}
            onEdit={(a) => setSheetMode({ kind: "edit", account: a })}
            onArchiveToggle={(a) => archiveMutation.mutate({ id: a.id, archived: !a.archived })}
            onDelete={(a) => setPendingDelete(a)}
            onReorder={(ids) => reorderMutation.mutate(ids)}
          />
        </>
      ) : (
        <AccountsEmpty onAdd={() => setSheetMode({ kind: "create" })} />
      )}

      <AccountFormSheet
        mode={sheetMode}
        onClose={() => setSheetMode(null)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => (!open ? setPendingDelete(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <strong>{pendingDelete?.name}</strong> removes its history. If you might come
              back to it, archive instead — that hides it from totals but keeps everything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    </div>
  );
}

const SKELETON_KEYS = ["a", "b", "c", "d"];

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {SKELETON_KEYS.map((k) => (
        <Skeleton key={k} className="h-[152px] rounded-2xl bg-surface/70" />
      ))}
    </div>
  );
}
