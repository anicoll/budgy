"use client";

import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendBudgetSummary } from "../api/types";

interface Props {
  summary: BackendBudgetSummary;
}

export function BudgetSummaryHero({ summary }: Props) {
  if (summary.kind === "zero_sum") {
    return (
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-surface/80 to-cyan-500/5">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ready to assign
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              <Money value={summary.readyToAssign} signColor />
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Unallocated cash across your accounts. Assign it to categories until this reaches
              zero.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricChip label="In accounts" value={summary.totalAvailableFunds} />
            <MetricChip label="Assigned" value={summary.totalAssignedFunds} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-surface/80 to-violet-500/5">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total envelope balance
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            <Money value={summary.totalBalance} signColor />
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Combined balance across all envelope categories for this budget.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label="On track" count={summary.onTrack} tone="healthy" />
          <StatusChip label="Watch" count={summary.watch} tone="watch" />
          <StatusChip label="Overspent" count={summary.overspent} tone="overspent" />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: Parameters<typeof Money>[0]["value"];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">
        <Money value={value} />
      </p>
    </div>
  );
}

function StatusChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "healthy" | "watch" | "overspent";
}) {
  const toneClass =
    tone === "healthy"
      ? "border-emerald-500/40 text-emerald-400"
      : tone === "watch"
        ? "border-amber-500/40 text-amber-400"
        : "border-rose-500/40 text-rose-400";

  return (
    <div className={`rounded-xl border bg-surface/60 px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{count}</p>
    </div>
  );
}
