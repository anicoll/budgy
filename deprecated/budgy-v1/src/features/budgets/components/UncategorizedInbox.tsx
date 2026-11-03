"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { UncategorisedTxnItem } from "./shared/UncategorisedTxnItem";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  allTransactions: Transaction[];
}

export function UncategorizedInbox({ transactions, categories, allTransactions }: Props) {
  if (transactions.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-amber-400" />
          Uncategorized this period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {transactions.length} transaction{transactions.length === 1 ? "" : "s"} on linked accounts
          need a category.
        </p>
        <ul className="divide-y divide-border/50 rounded-lg border border-border/40">
          {transactions.slice(0, 5).map((tx) => (
            <UncategorisedTxnItem
              key={tx.id}
              txn={tx}
              allTxns={allTransactions}
              categories={categories}
            />
          ))}
        </ul>
        {transactions.length > 5 ? (
          <Link
            href="/transactions"
            className="text-sm font-medium text-violet-400 hover:underline"
          >
            View all in transactions →
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
