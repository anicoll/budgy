"use client";

import type { ReactNode } from "react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { frequencyConversionLabel } from "../utils/normalise";
import {
  computeCategoryPeriodView,
  sumTransactionsInRange,
} from "../api/period-summary";
import type { DateRange } from "@/lib/date/periods";
import type { Transaction } from "@/features/transactions/types";
import type { BackendCategory, CategoryPeriodView, ViewCadence } from "../api/types";

interface Props {
  category: BackendCategory;
  viewCadence: ViewCadence;
  periodRange: DateRange;
  transactions: Transaction[];
  accountIds: string[];
  onAssign?: () => void;
  onCover?: () => void;
}

export function CategoryBudgetRow({
  category,
  viewCadence,
  periodRange,
  transactions,
  accountIds,
  onAssign,
  onCover,
}: Props) {
  const accountIdSet = new Set(accountIds);
  const periodActual = sumTransactionsInRange(
    transactions,
    accountIdSet,
    periodRange,
    category.id,
  );
  const view = computeCategoryPeriodView(category, viewCadence, periodActual);
  const freqHint =
    category.budgetedFrequency !== viewCadence && category.budgeted > 0
      ? frequencyConversionLabel(category.budgetedFrequency, viewCadence)
      : null;

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
      <div className="min-w-0">
        <p className="truncate font-medium">{category.name}</p>
        {freqHint ? (
          <p className="truncate text-[10px] text-muted-foreground">{freqHint}</p>
        ) : null}
      </div>
      <PeriodCell label="Target" value={view.periodTarget} />
      <PeriodCell
        label={view.actualLabel}
        value={view.periodActualDisplay}
        badge={view.overTarget ? <OverTargetBadge view={view} onCover={onCover} /> : null}
      />
      <RemainingCell view={view} onAssign={onAssign} />
    </div>
  );
}

function PeriodCell({
  label,
  value,
  badge,
}: {
  label: string;
  value: Parameters<typeof Money>[0]["value"];
  badge?: ReactNode;
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <Money value={value} className="text-sm" />
      {badge}
    </div>
  );
}

function RemainingCell({
  view,
  onAssign,
}: {
  view: CategoryPeriodView;
  onAssign?: () => void;
}) {
  const remainingLabel =
    view.actualLabel === "Received"
      ? view.overTarget
        ? "Under"
        : "Extra"
      : view.overTarget
        ? "Over"
        : "Left";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="text-right">
        <p className="text-[10px] uppercase text-muted-foreground">{remainingLabel}</p>
        <Money
          value={view.periodRemaining}
          className={`text-sm ${view.overTarget ? "text-rose-400" : ""}`}
          signColor
        />
      </div>
      <Button size="sm" variant="outline" onClick={onAssign}>
        Set target
      </Button>
    </div>
  );
}

function OverTargetBadge({
  view,
  onCover,
}: {
  view: CategoryPeriodView;
  onCover?: () => void;
}) {
  const label = view.actualLabel === "Received" ? "Under target" : "Over target";
  return (
    <div className="mt-1 flex flex-col items-end gap-1">
      <Badge variant="destructive" className="text-[10px]">
        {label}
      </Badge>
      {onCover && view.actualLabel === "Spent" ? (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCover}>
          Cover
        </Button>
      ) : null}
    </div>
  );
}
