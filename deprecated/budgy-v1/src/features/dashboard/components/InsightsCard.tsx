"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import type { SpendingInsight } from "../selectors";

interface Props {
  insights: SpendingInsight[];
  periodLabel: string;
}

export function InsightsCard({ insights, periodLabel }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/70 p-4 backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Spending insights · {periodLabel}
      </p>
      <div className="flex flex-col gap-2">
        {insights.map((insight) => {
          const up = insight.changePct > 0;
          const pct = Math.abs(insight.changePct).toFixed(0);
          return (
            <div key={insight.categoryId} className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: insight.color }}
              />
              <span className="flex-1 truncate text-sm">{insight.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {formatAUDCompact(insight.currentSpend)}
              </span>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                  up ? "text-expense" : "text-income",
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : "-"}
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
