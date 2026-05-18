"use client";

import { PiggyBank, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveBudget } from "@/features/budgets/hooks";
import { computeEnvelopeStates } from "@/features/budgets/utils/envelope";
import { currentPeriodRange } from "@/features/budgets/utils/period";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";

export function EnvelopeHealthCard() {
  const { data: budget } = useActiveBudget();
  const { data: categories = [] } = useCategories({ includeArchived: false });
  const { data: transactions = [] } = useTransactions();

  const summary = useMemo(() => {
    if (!budget || categories.length === 0) return null;
    const viewRange = currentPeriodRange(budget.period, budget.startDate);
    const bundle = computeEnvelopeStates({
      budget,
      transactions,
      categories,
      nowISO: new Date().toISOString().slice(0, 10),
      viewRange,
      viewPeriod: budget.period,
    });
    const all = [...bundle.income, ...bundle.expense];
    const envelopes = all.filter((s) => s.mode === "envelope");
    const overspent = all.filter((s) => s.status === "overspent");
    const watch = all.filter((s) => s.status === "watch");
    const setAside = envelopes.reduce((sum, e) => sum + Math.max(0, e.balance), 0) as Cents;
    const topEnvelopes = [...envelopes].sort((a, b) => b.balance - a.balance).slice(0, 3);
    return { setAside, envelopes, overspent, watch, topEnvelopes };
  }, [budget, categories, transactions]);

  if (!budget) return null;

  return (
    <Link href="/budgets" className="block">
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md transition-colors hover:border-violet-500/60">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <PiggyBank className="h-3.5 w-3.5" />
              Envelope health
            </div>
            {summary && (summary.overspent.length > 0 || summary.watch.length > 0) && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  summary.overspent.length > 0
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-amber-500/15 text-amber-300",
                )}
              >
                <TriangleAlert className="h-2.5 w-2.5" />
                {summary.overspent.length + summary.watch.length} need attention
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <Money
              value={summary?.setAside ?? (0 as Cents)}
              className="text-2xl font-semibold tabular-nums"
            />
            <span className="text-xs text-muted-foreground">set aside</span>
          </div>

          {summary && summary.topEnvelopes.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-xs">
              {summary.topEnvelopes.map((e) => (
                <li key={e.categoryId} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: e.categoryColor }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-muted-foreground">{e.categoryName}</span>
                  <Money value={e.balance as Cents} className="text-foreground/80 tabular-nums" />
                </li>
              ))}
            </ul>
          )}

          {summary && summary.envelopes.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No envelopes yet — add a quarterly or yearly category in the budget to start.
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
