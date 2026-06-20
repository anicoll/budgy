"use client";

import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { envelopeCategoryStatus, envelopeProgressRatio, envelopeStatusToUi } from "../api/summary";
import type { BackendBudgetMethod, BackendCategory } from "../api/types";
import { EnvelopeProgress } from "./shared/EnvelopeProgress";

interface Props {
  category: BackendCategory;
  method: BackendBudgetMethod;
  onAssign?: () => void;
  onFund?: () => void;
}

export function CategoryBudgetRow({ category, method, onAssign, onFund }: Props) {
  if (method === "zero_sum") {
    return (
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
        <div className="min-w-0">
          <p className="truncate font-medium">{category.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Assigned</p>
          <Money value={category.budgeted} className="text-sm" />
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Available</p>
          <Money value={category.balance} className="text-sm" signColor />
        </div>
        <Button size="sm" variant="outline" onClick={onAssign}>
          Assign
        </Button>
      </div>
    );
  }

  const status = envelopeCategoryStatus(category);
  const uiStatus = envelopeStatusToUi(status);
  const ratio = envelopeProgressRatio(category);

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 px-4 py-3 last:border-b-0">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
        <div className="min-w-0">
          <p className="truncate font-medium">{category.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Target</p>
          <Money value={category.targetLimit} className="text-sm" />
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Balance</p>
          <Money value={category.balance} className="text-sm" signColor />
        </div>
        <Button size="sm" variant="outline" onClick={onFund}>
          Fund
        </Button>
      </div>
      <EnvelopeProgress ratio={ratio} status={uiStatus} height="thick" />
    </div>
  );
}
