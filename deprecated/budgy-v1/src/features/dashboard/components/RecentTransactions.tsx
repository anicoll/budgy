"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/money/money";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Account } from "@/features/accounts/types";
import type { Category } from "@/features/categories/types";
import { signedAmount, type Transaction } from "@/features/transactions/types";
import { formatAUDateShort } from "@/lib/date/au-locale";
import { cn } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export function RecentTransactions({ transactions, accounts, categories }: Props) {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <Card className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-0 pt-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Recent transactions
        </h2>
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="pb-2 pt-2">
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="flex flex-col divide-y divide-border/30">
            {transactions.map((txn) => {
              const account = accountMap.get(txn.accountId);
              const category = categoryMap.get(txn.categoryId ?? "");
              const signed = signedAmount(txn);
              const isPositive = signed > 0;

              return (
                <div key={txn.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-[64px] text-[11px] tabular-nums text-muted-foreground">
                    {formatAUDateShort(txn.date)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {txn.payee || txn.description || txn.type}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {category && (
                        <>
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: category.color }}
                          />
                          <span>{category.name}</span>
                          {account && <span>·</span>}
                        </>
                      )}
                      {account && <span>{account.name}</span>}
                    </div>
                  </div>
                  <Money
                    value={signed}
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      isPositive ? "text-income" : "text-foreground",
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
