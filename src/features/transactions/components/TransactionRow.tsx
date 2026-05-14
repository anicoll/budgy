"use client";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import type { Account } from "@/features/accounts/types";
import type { Category } from "@/features/categories/types";
import { formatAUDateShort } from "@/lib/date/au-locale";
import { cn } from "@/lib/utils";
import { signedAmount, type Transaction, TXN_TYPE_LABEL } from "../types";

interface Props {
  txn: Transaction;
  accounts: Account[];
  categories: Category[];
  onEdit: (txn: Transaction) => void;
  onDelete: (txn: Transaction) => void;
  onToggleCleared: (txn: Transaction) => void;
}

export function TransactionRow({
  txn,
  accounts,
  categories,
  onEdit,
  onDelete,
  onToggleCleared,
}: Props) {
  const account = accounts.find((a) => a.id === txn.accountId);
  const category = categories.find((c) => c.id === txn.categoryId);
  const signed = signedAmount(txn);
  const isIncoming = signed > 0;

  return (
    <button
      type="button"
      aria-label={`Edit transaction: ${txn.payee || txn.description || txn.type}`}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/50 hover:bg-surface/60"
      onClick={() => onEdit(txn)}
    >
      <button
        type="button"
        aria-label={txn.cleared ? "Mark uncleared" : "Mark cleared"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCleared(txn);
        }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        {txn.cleared ? (
          <CheckCircle2 className="h-4 w-4 text-income" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      <div className="min-w-[72px] shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatAUDateShort(txn.date)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {txn.payee || txn.description || TXN_TYPE_LABEL[txn.type]}
          </span>
          {txn.tags.length > 0 && (
            <span className="hidden gap-1 sm:flex">
              {txn.tags.slice(0, 2).map((t) => (
                <Badge key={t} variant="secondary" className="h-4 px-1 text-[10px]">
                  {t}
                </Badge>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {category && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: category.color }}
              />
              {category.name}
            </span>
          )}
          {account && (
            <>
              {category && <span>·</span>}
              <span>{account.name}</span>
            </>
          )}
        </div>
      </div>

      <Money
        value={signed}
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          isIncoming ? "text-income" : "text-foreground",
        )}
      />

      <button
        type="button"
        aria-label="Delete transaction"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(txn);
        }}
        className="ml-1 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}
