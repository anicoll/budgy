"use client";

import { useState } from "react";
import { Money } from "@/components/money/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/features/categories/types";
import { useBulkSetCategory } from "@/features/transactions/hooks";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import { suggestCategoryForPayee } from "@/features/transactions/utils/suggest-category";

interface Props {
  txn: Transaction;
  allTxns: Transaction[];
  categories: Category[];
}

export function UncategorisedTxnItem({ txn, allTxns, categories }: Props) {
  const [selectKey, setSelectKey] = useState(0);
  const bulkSetCategory = useBulkSetCategory();

  const relevantCategories = categories
    .filter((c) => !c.archived && c.type === (txn.type === "credit" ? "income" : "expense"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const suggestion = suggestCategoryForPayee(txn, allTxns, categories);

  function assign(categoryId: string) {
    bulkSetCategory.mutate({ ids: [txn.id], categoryId });
    setSelectKey((k) => k + 1);
  }

  return (
    <li className="flex flex-col gap-1 py-1.5 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground tabular-nums">{txn.date}</span>
        <span className="flex-1 truncate">{txn.payee || txn.description || "—"}</span>
        <Money value={signedAmount(txn)} variant="signed" signColor className="tabular-nums" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {suggestion && (
          <button
            type="button"
            onClick={() => assign(suggestion.id)}
            disabled={bulkSetCategory.isPending}
            className="shrink-0 rounded-full border border-violet-500/50 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
          >
            Apply: {suggestion.name}
          </button>
        )}
        <Select key={selectKey} onValueChange={assign} disabled={bulkSetCategory.isPending}>
          <SelectTrigger className="h-6 max-w-[180px] text-[11px]">
            <SelectValue placeholder="Assign category…" />
          </SelectTrigger>
          <SelectContent>
            {relevantCategories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  );
}
