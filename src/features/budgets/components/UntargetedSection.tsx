"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import type { FluidActual } from "../types";

interface Props {
  label: string;
  actuals: FluidActual[];
  onSetTarget: (categoryId: string, categoryName: string) => void;
}

export function UntargetedSection({ label, actuals, onSetTarget }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (actuals.length === 0) return null;

  const total = actuals.reduce((s, a) => s + a.actual, 0) as Cents;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="flex-1 text-left">{label}</span>
        <Badge variant="secondary" className="text-[10px]">
          {actuals.length}
        </Badge>
        <Money value={total} className="text-xs text-muted-foreground" />
      </button>

      {expanded && (
        <div className="ml-5 flex flex-col gap-0.5 border-l border-border/40 pl-3">
          {actuals.map((actual) => (
            <div
              key={actual.categoryId}
              className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border/40 hover:bg-surface/50"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: actual.categoryColor }}
              />
              <span className="flex-1 truncate text-sm">{actual.categoryName}</span>
              <Money
                value={actual.actual}
                className={cn(
                  "text-xs tabular-nums",
                  actual.actual > 0 ? "text-foreground" : "text-muted-foreground",
                )}
              />
              <button
                type="button"
                onClick={() => onSetTarget(actual.categoryId, actual.categoryName)}
                className="inline-flex items-center gap-1 rounded-md bg-muted/0 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Set target for ${actual.categoryName}`}
              >
                <Plus className="h-3 w-3" /> Set target
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
