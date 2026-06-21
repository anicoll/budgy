"use client";

import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BackendBudgetSummary } from "../api/types";

interface Props {
  summary: BackendBudgetSummary;
  periodLabel?: string;
}

export function BudgetSummaryHero({ summary, periodLabel }: Props) {
  const label = periodLabel ? ` ${periodLabel}` : "";
  const { pool } = summary;
  const rtaNegative = pool.readyToAssign < 0;
  const netNegative = summary.periodNet < 0;

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-surface/80 to-cyan-500/5">
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Net{label}
            </p>
            <p
              className={cn(
                "mt-1 text-4xl font-semibold tracking-tight",
                netNegative && "text-destructive",
              )}
            >
              <Money value={summary.periodNet} signColor />
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Income received minus expenses spent on linked accounts — categorized by category
              type, not raw account credits and debits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ComparisonChip
              kind="income"
              label={`Income${label}`}
              actual={summary.periodReceived}
              budgeted={summary.budgetedIncome}
            />
            <ComparisonChip
              kind="expense"
              label={`Expenses${label}`}
              actual={summary.periodSpent}
              budgeted={summary.budgetedExpenses}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
          <MetricChip label="Available" value={pool.totalAvailableFunds} />
          <MetricChip label="Assigned" value={pool.totalAssignedFunds} />
          <MetricChip
            label="Ready to assign"
            value={pool.readyToAssign}
            signColor
            negative={rtaNegative}
          />
          <MetricChip
            label={`Budgeted net${label}`}
            value={summary.budgetedNet}
            signColor
            negative={summary.budgetedNet < 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonChip({
  kind,
  label,
  actual,
  budgeted,
}: {
  kind: "income" | "expense";
  label: string;
  actual: Parameters<typeof Money>[0]["value"];
  budgeted: Parameters<typeof Money>[0]["value"];
}) {
  const over = actual > budgeted;
  const under = actual < budgeted;

  let status = "On target";
  let statusClass = "text-muted-foreground";
  if (kind === "income") {
    if (over) {
      status = "Above target";
      statusClass = "text-emerald-400";
    } else if (under) {
      status = "Below target";
      statusClass = "text-amber-400";
    }
  } else if (over) {
    status = "Over budget";
    statusClass = "text-amber-400";
  } else if (under) {
    status = "Under budget";
    statusClass = "text-emerald-400";
  }

  return (
    <div className="min-w-[9rem] rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">
        <Money value={actual} />
        <span className="mx-1 font-normal text-muted-foreground">/</span>
        <Money value={budgeted} className="font-medium text-muted-foreground" />
      </p>
      <p className={cn("mt-0.5 text-[10px]", statusClass)}>{status}</p>
    </div>
  );
}

function MetricChip({
  label,
  value,
  signColor,
  negative,
}: {
  label: string;
  value: Parameters<typeof Money>[0]["value"];
  signColor?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-medium", negative && "text-destructive")}>
        <Money value={value} signColor={signColor} />
      </p>
    </div>
  );
}
