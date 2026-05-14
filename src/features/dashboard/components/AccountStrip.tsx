"use client";

import { useMemo } from "react";
import { SparklineChart } from "@/components/charts/SparklineChart";
import { Money } from "@/components/money/money";
import type { Account } from "@/features/accounts/types";
import { ACCOUNT_TYPE_LABEL, isLiability } from "@/features/accounts/types";
import type { Transaction } from "@/features/transactions/types";
import { computeAccountSparkline } from "../selectors";

interface Props {
  accounts: Account[];
  transactions: Transaction[];
}

export function AccountStrip({ accounts, transactions }: Props) {
  const visible = accounts.filter((a) => !a.archived);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
      {visible.map((account) => (
        <AccountMiniCard key={account.id} account={account} transactions={transactions} />
      ))}
    </div>
  );
}

function AccountMiniCard({
  account,
  transactions,
}: {
  account: Account;
  transactions: Transaction[];
}) {
  const sparkData = useMemo(
    () => computeAccountSparkline(account, transactions, 30),
    [account, transactions],
  );

  const liability = isLiability(account.type);

  return (
    <div
      className="flex min-w-[160px] shrink-0 flex-col rounded-xl border border-border/60 bg-surface/70 p-3 backdrop-blur-md"
      style={{ borderTop: `3px solid ${account.color}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{account.name}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {ACCOUNT_TYPE_LABEL[account.type]}
          </div>
        </div>
      </div>
      <div className="-mx-1 my-1">
        <SparklineChart data={sparkData} color={account.color} positive={!liability} height={36} />
      </div>
      <Money value={account.currentBalance} className="text-sm font-semibold tabular-nums" />
    </div>
  );
}
