"use client";

import { ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import { useRemoveAllocation, useUpsertAllocation } from "../hooks";
import type { AllocationActual, Budget } from "../types";
import { budgetTotals, computeActuals, computeUnbudgetedSpend } from "../utils/actuals";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "../utils/period";
import { AddAllocationDialog } from "./AddAllocationDialog";
import { AllocationEditDialog } from "./AllocationEditDialog";
import { AllocationRow } from "./AllocationRow";

interface Props {
  budget: Budget;
}

export function BudgetPeriodView({ budget }: Props) {
  const [range, setRange] = useState(() => currentPeriodRange(budget.period, budget.startDate));
  const [addOpen, setAddOpen] = useState(false);
  const [editActual, setEditActual] = useState<AllocationActual | null>(null);

  const { data: allTxns = [], isPending: txnsLoading } = useTransactions();
  const { data: categories = [], isPending: catsLoading } = useCategories();
  const upsertMutation = useUpsertAllocation();
  const removeMutation = useRemoveAllocation();

  const actuals = useMemo(
    () => computeActuals(budget, allTxns, categories, range),
    [budget, allTxns, categories, range],
  );

  const unbudgeted = useMemo(
    () => computeUnbudgetedSpend(budget, allTxns, range),
    [budget, allTxns, range],
  );

  const totals = useMemo(() => budgetTotals(actuals), [actuals]);

  const loading = txnsLoading || catsLoading;
  const label = formatPeriodLabel(range, budget.period);

  function prev() {
    setRange((r) => shiftBudgetPeriod(budget.period, budget.startDate, r, -1));
  }
  function next() {
    setRange((r) => shiftBudgetPeriod(budget.period, budget.startDate, r, 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Period navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prev}
            aria-label="Previous period"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium">{label}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={next}
            aria-label="Next period"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddOpen(true)}
          className="gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add category
        </Button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: "Budgeted", value: totals.allocated, cls: "text-foreground" },
            {
              label: "Spent",
              value: totals.spent,
              cls: totals.spent > totals.allocated ? "text-expense" : "text-foreground",
            },
            {
              label: "Remaining",
              value: totals.remaining,
              cls: totals.remaining < 0 ? "text-expense" : "text-income",
            },
          ] as const
        ).map(({ label: l, value, cls }) => (
          <Card key={l} className="border-border/60 bg-surface/60 backdrop-blur-md">
            <CardContent className="py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
              <Money
                value={value}
                className={cn("mt-0.5 text-xl font-semibold tabular-nums", cls)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Allocations */}
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="flex flex-col gap-2 p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : actuals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <p className="font-medium">No allocations yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add categories to start tracking spend against your budget.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add first allocation
              </Button>
            </div>
          ) : (
            <>
              {actuals.map((actual) => (
                <AllocationRow
                  key={actual.categoryId}
                  actual={actual}
                  onEditAmount={setEditActual}
                  onToggleRollover={(cid, current) =>
                    upsertMutation.mutate({
                      budgetId: budget.id,
                      categoryId: cid,
                      amount: actuals.find((a) => a.categoryId === cid)?.allocated ?? 0,
                      rollover: !current,
                    })
                  }
                  onRemove={(cid) =>
                    removeMutation.mutate({ budgetId: budget.id, categoryId: cid })
                  }
                />
              ))}

              <Separator className="my-1" />

              {/* Unbudgeted */}
              {unbudgeted > 0 && (
                <div className="flex items-center justify-between px-1 py-1 text-xs text-muted-foreground">
                  <span>Unbudgeted spend</span>
                  <Money value={unbudgeted as Cents} className="text-expense" />
                </div>
              )}

              {/* Totals row */}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2 text-sm font-semibold">
                <span>Total</span>
                <div className="flex items-center gap-6 tabular-nums">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Spent</div>
                    <Money value={totals.spent} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Budgeted</div>
                    <Money value={totals.allocated} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Left</div>
                    <Money
                      value={totals.remaining}
                      className={totals.remaining < 0 ? "text-expense" : "text-income"}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AddAllocationDialog
        open={addOpen}
        budget={budget}
        onClose={() => setAddOpen(false)}
        onAdd={(cid, amount) =>
          upsertMutation.mutate({ budgetId: budget.id, categoryId: cid, amount, rollover: false })
        }
      />

      <AllocationEditDialog
        actual={editActual}
        onClose={() => setEditActual(null)}
        onSave={(cid, amount, rollover) =>
          upsertMutation.mutate({ budgetId: budget.id, categoryId: cid, amount, rollover })
        }
      />
    </div>
  );
}
