"use client";

import { Money } from "@/components/money/money";
import { fromCents } from "@/lib/money/cents";
import { Card, CardContent } from "@/components/ui/card";
import type { BackendBudgetSummary } from "../api/types";

interface Props {
  summary: BackendBudgetSummary;
  periodLabel?: string;
}

export function BudgetSummaryHero({ summary, periodLabel }: Props) {
  const label = periodLabel ? ` ${periodLabel}` : "";

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-surface/80 to-cyan-500/5">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Net{label}
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            <Money value={summary.periodNet} signColor />
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Received minus spent on linked accounts this period. Set category targets to plan income
            and expenses — not every dollar in your accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricChip label={`Received${label}`} value={summary.periodReceived} />
          <MetricChip label={`Spent${label}`} value={summary.periodSpent} />
          <MetricChip
            label={`Budgeted net${label}`}
            value={summary.budgetedNet}
            hint={`Income ${fromCents(summary.budgetedIncome).toFixed(0)} · Expenses ${fromCents(summary.budgetedExpenses).toFixed(0)}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: Parameters<typeof Money>[0]["value"];
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">
        <Money value={value} signColor={label.startsWith("Budgeted net")} />
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
