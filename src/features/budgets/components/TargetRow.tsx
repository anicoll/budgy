"use client";

import { Repeat, Trash2 } from "lucide-react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FluidActual } from "../types";
import { progressColor } from "../utils/actuals";
import { frequencyConversionLabel } from "../utils/normalise";

interface Props {
  actual: FluidActual;
  viewPeriod: string;
  onEditTarget: (actual: FluidActual) => void;
  onToggleRollover: (categoryId: string, current: boolean) => void;
  onRemoveTarget: (categoryId: string) => void;
}

export function TargetRow({
  actual,
  viewPeriod,
  onEditTarget,
  onToggleRollover,
  onRemoveTarget,
}: Props) {
  const color = actual.effectiveProjected
    ? progressColor(actual.actual, actual.effectiveProjected)
    : null;

  const pct =
    actual.effectiveProjected && actual.effectiveProjected > 0
      ? Math.min(100, (actual.actual / actual.effectiveProjected) * 100)
      : 0;

  const showFreqLabel =
    actual.targetFrequency &&
    frequencyConversionLabel(
      actual.targetFrequency,
      viewPeriod as Parameters<typeof frequencyConversionLabel>[1],
    ) !== actual.targetFrequency;

  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-border/40 bg-surface/50 px-4 py-3 transition-colors hover:border-border/70">
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: actual.categoryColor }}
        >
          {actual.categoryName.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{actual.categoryName}</span>
            {actual.rolloverAmount > 0 && (
              <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
                <Repeat className="h-2.5 w-2.5" />
                +<Money value={actual.rolloverAmount} variant="compact" className="text-[10px]" />
              </Badge>
            )}
          </div>
          {showFreqLabel && actual.targetFrequency && (
            <div className="text-[10px] text-muted-foreground">
              {frequencyConversionLabel(
                actual.targetFrequency,
                viewPeriod as Parameters<typeof frequencyConversionLabel>[1],
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs tabular-nums">
          <div className="text-right">
            <div className="text-muted-foreground">
              {actual.categoryType === "income" ? "received" : "spent"}
            </div>
            <Money
              value={actual.actual}
              className={cn(
                "font-semibold",
                color === "over" && "text-expense",
                color === "warning" && "text-warning",
              )}
            />
          </div>
          {actual.effectiveProjected !== undefined && (
            <>
              <div className="text-right">
                <div className="text-muted-foreground">projected</div>
                <button
                  type="button"
                  onClick={() => onEditTarget(actual)}
                  className="font-semibold transition-colors hover:text-primary"
                  aria-label={`Edit target for ${actual.categoryName}`}
                >
                  <Money value={actual.effectiveProjected} />
                </button>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">left</div>
                <Money
                  value={(actual.variance ?? 0) as import("@/lib/money/cents").Cents}
                  className={cn(
                    "font-semibold",
                    (actual.variance ?? 0) < 0 ? "text-expense" : "text-income",
                  )}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {actual.hasTarget && (
            <Switch
              checked={actual.rollover}
              onCheckedChange={() => onToggleRollover(actual.categoryId, actual.rollover)}
              aria-label="Rollover unused budget"
              className="scale-75"
            />
          )}
          {actual.hasTarget && (
            <button
              type="button"
              onClick={() => onRemoveTarget(actual.categoryId)}
              aria-label={`Remove target for ${actual.categoryName}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {actual.hasTarget && actual.effectiveProjected !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              color === "safe" && "bg-income",
              color === "warning" && "bg-warning",
              color === "over" && "bg-expense",
              actual.categoryType === "income" && color === "safe" && "bg-income",
            )}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}
    </div>
  );
}
