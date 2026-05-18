"use client";

import { ChevronRight } from "lucide-react";
import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import type { EnvelopeBundle, EnvelopeState } from "../types";
import { EnvelopeProgress, STATUS_TEXT_COLOR } from "./shared/EnvelopeProgress";

interface Props {
  bundle: EnvelopeBundle;
  onOpen: (state: EnvelopeState) => void;
}

export function PeriodView({ bundle, onOpen }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PeriodSection title="Income" rows={bundle.income} type="income" onOpen={onOpen} />
      <PeriodSection title="Expenses" rows={bundle.expense} type="expense" onOpen={onOpen} />
      {(bundle.uncategorisedExpense > 0 || bundle.uncategorisedIncome > 0) && (
        <UncategorisedRow
          income={bundle.uncategorisedIncome}
          expense={bundle.uncategorisedExpense}
        />
      )}
      <Totals bundle={bundle} />
    </div>
  );
}

function PeriodSection({
  title,
  rows,
  type,
  onOpen,
}: {
  title: string;
  rows: EnvelopeState[];
  type: "income" | "expense";
  onOpen: (state: EnvelopeState) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h3>
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="divide-y divide-border/40 p-0">
          {rows.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No {title.toLowerCase()} categories targeted yet.
            </div>
          )}
          {rows.map((row) => (
            <PeriodRow key={row.categoryId} row={row} type={type} onOpen={onOpen} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function PeriodRow({
  row,
  type,
  onOpen,
}: {
  row: EnvelopeState;
  type: "income" | "expense";
  onOpen: (state: EnvelopeState) => void;
}) {
  const ratio = row.periodTarget > 0 ? row.periodActual / row.periodTarget : 0;
  // For expense rows we colour by overspend; for income we colour by under-receipt.
  const status = row.status;

  const variance = row.periodVariance;
  let varianceLabel: string;
  let varianceClass = "text-muted-foreground";
  if (type === "expense") {
    if (variance > 0) {
      varianceLabel = "left";
    } else if (variance < 0) {
      varianceLabel = "over";
      varianceClass = "text-rose-400";
    } else {
      varianceLabel = "on budget";
    }
  } else {
    if (variance > 0) {
      varianceLabel = "short";
      varianceClass = "text-amber-400";
    } else {
      varianceLabel = "ahead";
      varianceClass = "text-emerald-400";
    }
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border/50"
        style={{ background: row.categoryColor }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{row.categoryName}</span>
          {row.mode === "envelope" && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-violet-300">
              env
            </span>
          )}
        </div>
        <EnvelopeProgress ratio={ratio} status={status} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <div className="text-sm font-medium tabular-nums">
          <Money value={row.periodActual} />
          <span className="text-muted-foreground"> / </span>
          <Money value={row.periodTarget} muted />
        </div>
        <div className={cn("text-[10px]", varianceClass)}>
          <Money
            value={Math.abs(variance) as Cents}
            className={cn("text-current", STATUS_TEXT_COLOR[status])}
          />{" "}
          {varianceLabel}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
    </button>
  );
}

function UncategorisedRow({ income, expense }: { income: Cents; expense: Cents }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Uncategorised</h3>
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="flex items-center gap-4 px-4 py-3">
          {income > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Income
              </span>
              <Money value={income} className="text-sm font-medium text-emerald-400" />
            </div>
          )}
          {expense > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Expense
              </span>
              <Money value={expense} className="text-sm font-medium text-rose-300" />
            </div>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            Categorise these from the Transactions page.
          </span>
        </CardContent>
      </Card>
    </section>
  );
}

function Totals({ bundle }: { bundle: EnvelopeBundle }) {
  const net = (bundle.totals.periodActualIncome - bundle.totals.periodActualExpense) as Cents;
  const projectedNet = (bundle.totals.periodTargetIncome -
    bundle.totals.periodTargetExpense) as Cents;
  return (
    <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
      <CardContent className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Net this period
          </span>
          <Money value={net} variant="signed" signColor className="text-base font-medium" />
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Projected
          </span>
          <Money value={projectedNet} variant="signed" muted className="text-base font-medium" />
        </div>
      </CardContent>
    </Card>
  );
}
