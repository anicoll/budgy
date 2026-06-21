"use client";

import { ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllUserAccounts, useBackendAccounts, useSyncBudgetAccountLinks } from "../api/hooks";
import type { BackendAccount } from "../api/types";
import type { Account } from "@/features/accounts/types";

interface Props {
  budgetId: string;
}

export function BudgetAccountsPanel({ budgetId }: Props) {
  const { data: linked = [], isPending: linkedPending } = useBackendAccounts(budgetId);
  const { data: allAccounts = [], isPending: allPending } = useAllUserAccounts();
  const syncMutation = useSyncBudgetAccountLinks(budgetId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sheetOpen) {
      setSelected(new Set(linked.map((a) => a.id)));
    }
  }, [sheetOpen, linked]);

  const linkedElsewhere = useMemo(() => {
    const linkedIds = new Set(linked.map((a) => a.id));
    return allAccounts.filter((a) => !linkedIds.has(a.id));
  }, [allAccounts, linked]);

  async function handleSave() {
    await syncMutation.mutateAsync([...selected]);
    setSheetOpen(false);
  }

  function toggleAccount(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (linkedPending) {
    return <Skeleton className="h-24 rounded-2xl" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Linked accounts</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
            <Link2 className="mr-1 h-4 w-4" />
            Manage
          </Button>
        </CardHeader>
        <CardContent>
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts linked yet. Link accounts to track spending and assign from real balances.
            </p>
          ) : (
            <ul className="space-y-2">
              {linked.map((acc) => (
                <LinkedAccountRow key={acc.id} account={acc} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Link accounts</SheetTitle>
            <SheetDescription>
              Each account can belong to one budget. Linking includes all historical transactions
              for category reconciliation.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {allPending ? (
              <Skeleton className="h-32" />
            ) : allAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet. Add accounts first.</p>
            ) : (
              allAccounts.map((acc: Account) => (
                <label
                  key={acc.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={selected.has(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{acc.name}</p>
                    <Money value={acc.currentBalance} className="text-xs text-muted-foreground" />
                  </div>
                </label>
              ))
            )}
            {linkedElsewhere.length > 0 && selected.size > linked.length ? (
              <p className="text-xs text-amber-500">
                Moving an account from another budget will unlink it there first.
              </p>
            ) : null}
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? "Saving…" : "Save links"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function LinkedAccountRow({ account }: { account: BackendAccount }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
      <span className="truncate text-sm font-medium">{account.name}</span>
      <Badge variant="secondary" className="shrink-0 tabular-nums">
        <Money value={account.balance} />
      </Badge>
    </li>
  );
}
