"use client";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/features/accounts/types";
import type { Category } from "@/features/categories/types";
import { formatAUDateShort } from "@/lib/date/au-locale";
import { cn } from "@/lib/utils";
import { useBulkSetCategory } from "../hooks";
import { signedAmount, type Transaction, TXN_TYPE_LABEL } from "../types";
import type { Cents } from "@/lib/money/cents";

interface Props {
  txn: Transaction;
  accounts: Account[];
  categories: Category[];
  selected?: boolean;
  onToggleSelected?: (txn: Transaction) => void;
  onEdit: (txn: Transaction) => void;
  onDelete: (txn: Transaction) => void;
  onToggleCleared: (txn: Transaction) => void;
}

export function TransactionRow({
  txn,
  accounts,
  categories,
  selected = false,
  onToggleSelected,
  onEdit,
  onDelete,
  onToggleCleared,
}: Props) {
  const account = accounts.find((a) => a.id === txn.accountId);
  const category = categories.find((c) => c.id === txn.categoryId);
  const basiqCategory = categories.find((c) => c.id === txn.basiqCategoryId);
  const signed = signedAmount(txn);
  const isIncoming = signed > 0;
  const isSynced = !!account?.connectionId;
  const bulkSetCategory = useBulkSetCategory();

  const relevantCategories = categories
    .filter((c) => !c.archived && c.type === (txn.type === "credit" ? "income" : "expense"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasOverride =
    !!txn.customerCategoryId && txn.customerCategoryId !== (txn.basiqCategoryId ?? null);

  function assignCategory(categoryId: string | null) {
    bulkSetCategory.mutate({ ids: [txn.id], categoryId });
  }

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors",
        isSynced ? "bg-surface/10 hover:bg-surface/15" : "hover:border-border/50 hover:bg-surface/60",
      )}
    >
      <button
        type="button"
        aria-label={selected ? "Deselect transaction" : "Select transaction"}
        onClick={() => onToggleSelected?.(txn)}
        className={cn(
          "h-4 w-4 shrink-0 rounded border transition-colors",
          selected
            ? "border-foreground bg-foreground"
            : "border-muted-foreground/50 hover:border-foreground/70",
        )}
      />

      {!isSynced ? (
        <button
          type="button"
          aria-label={txn.cleared ? "Mark uncleared" : "Mark cleared"}
          onClick={() => onToggleCleared(txn)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {txn.cleared ? (
            <CheckCircle2 className="h-4 w-4 text-income" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
      ) : (
        <div className="shrink-0 text-muted-foreground/45 select-none">
          {txn.cleared ? (
            <CheckCircle2 className="h-4 w-4 text-income/60" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </div>
      )}

      {!isSynced ? (
        <button
          type="button"
          aria-label={`Edit transaction: ${txn.payee || txn.description || txn.type}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          onClick={() => onEdit(txn)}
        >
          <TxnMainContent
            txn={txn}
            category={category}
            account={account}
            signed={signed}
            isIncoming={isIncoming}
            muted={false}
          />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <TxnMainContent
            txn={txn}
            category={category}
            account={account}
            signed={signed}
            isIncoming={isIncoming}
            muted
            basiqCategory={basiqCategory}
            basiqCategoryTitle={txn.basiqCategoryTitle}
            hasOverride={hasOverride}
          />
        </div>
      )}

      {isSynced ? (
        <Select
          value={txn.categoryId ?? "none"}
          onValueChange={(v) => assignCategory(v === "none" ? null : v)}
          disabled={bulkSetCategory.isPending}
        >
          <SelectTrigger className="h-8 w-[9.5rem] shrink-0 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">
              Uncategorised
            </SelectItem>
            {relevantCategories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {!isSynced ? (
        <button
          type="button"
          aria-label="Delete transaction"
          onClick={() => onDelete(txn)}
          className="ml-1 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}
    </div>
  );
}

function TxnMainContent({
  txn,
  category,
  account,
  signed,
  isIncoming,
  muted,
  basiqCategory,
  basiqCategoryTitle,
  hasOverride,
}: {
  txn: Transaction;
  category?: Category;
  account?: Account;
  signed: Cents;
  isIncoming: boolean;
  muted: boolean;
  basiqCategory?: Category;
  basiqCategoryTitle?: string;
  hasOverride?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "min-w-[72px] shrink-0 text-xs tabular-nums",
          muted ? "text-muted-foreground/60" : "text-muted-foreground",
        )}
      >
        {formatAUDateShort(txn.date)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm font-medium",
              muted && "text-muted-foreground",
            )}
          >
            {txn.payee || txn.description || TXN_TYPE_LABEL[txn.type]}
          </span>
          {txn.tags.length > 0 && (
            <span className="hidden gap-1 sm:flex">
              {txn.tags.slice(0, 2).map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className={cn("h-4 px-1 text-[10px]", muted && "opacity-60")}
                >
                  {t}
                </Badge>
              ))}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 text-[11px]",
            muted ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
        >
          {category && !muted && (
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
              {category && !muted && <span>·</span>}
              <span>{account.name}</span>
            </>
          )}
          {muted && (basiqCategoryTitle || basiqCategory) && (
            <span className="text-[10px]">
              Basiq: {basiqCategory?.name ?? basiqCategoryTitle}
              {hasOverride ? " · recategorised" : ""}
            </span>
          )}
        </div>
      </div>

      <Money
        value={signed}
        className={cn(
          "shrink-0 text-sm tabular-nums",
          muted ? "font-medium" : "font-semibold",
          isIncoming ? (muted ? "text-income/80" : "text-income") : muted ? "text-muted-foreground" : "text-foreground",
        )}
      />
    </>
  );
}
