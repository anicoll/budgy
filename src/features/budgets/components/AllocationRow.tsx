"use client";

import { Repeat, Trash2 } from "lucide-react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AllocationActual } from "../types";
import { progressColor } from "../utils/actuals";

interface Props {
  actual: AllocationActual;
  onEditAmount: (actual: AllocationActual) => void;
  onToggleRollover: (categoryId: string, current: boolean) => void;
  onRemove: (categoryId: string) => void;
}

export function AllocationRow({ actual, onEditAmount, onToggleRollover, onRemove }: Props) {
  const color = progressColor(actual.spent, actual.effectiveAllocated);
  const pct =
    actual.effectiveAllocated > 0
      ? Math.min(100, (actual.spent / actual.effectiveAllocated) * 100)
      : 100;

  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-border/40 bg-surface/50 px-4 py-3 transition-colors hover:border-border/70">
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-xs font-bold"
          style={{ background: actual.categoryColor }}
        >
          {actual.categoryName.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{actual.categoryName}</span>
            {actual.rolloverAmount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] gap-0.5">
                <Repeat className="h-2.5 w-2.5" />
                +<Money value={actual.rolloverAmount} variant="compact" className="text-[10px]" />
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs tabular-nums">
          <div className="text-right">
            <div className="text-muted-foreground">spent</div>
            <Money
              value={actual.spent}
              className={cn(
                "font-semibold",
                color === "over" && "text-expense",
                color === "warning" && "text-warning",
              )}
            />
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">of</div>
            <button
              type="button"
              onClick={() => onEditAmount(actual)}
              className="font-semibold hover:text-primary transition-colors"
              aria-label={`Edit allocation for ${actual.categoryName}`}
            >
              <Money value={actual.effectiveAllocated} />
            </button>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">left</div>
            <Money
              value={actual.remaining}
              className={cn("font-semibold", actual.remaining < 0 ? "text-expense" : "text-income")}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Switch
            checked={actual.rollover}
            onCheckedChange={() => onToggleRollover(actual.categoryId, actual.rollover)}
            aria-label="Rollover unused budget"
            className="scale-75"
          />
          <button
            type="button"
            onClick={() => onRemove(actual.categoryId)}
            aria-label={`Remove ${actual.categoryName} allocation`}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            color === "safe" && "bg-income",
            color === "warning" && "bg-warning",
            color === "over" && "bg-expense",
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
