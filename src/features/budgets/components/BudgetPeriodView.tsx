"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { cn } from "@/lib/utils";
import { useRemoveTarget, useSetTarget } from "../hooks";
import type { Budget, BudgetFrequency, BudgetPeriod, FluidActual } from "../types";
import { computeFluidActuals } from "../utils/actuals";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "../utils/period";
import { SetTargetDialog } from "./SetTargetDialog";
import { TargetEditDialog } from "./TargetEditDialog";
import { TargetRow } from "./TargetRow";
import { UntargetedSection } from "./UntargetedSection";

interface Props {
  budget: Budget;
}

export function BudgetPeriodView({ budget }: Props) {
  const viewPeriod = budget.period;
  const [range, setRange] = useState(() => currentPeriodRange(viewPeriod, budget.startDate));
  const [setTargetFor, setSetTargetFor] = useState<{ id: string; name: string } | null>(null);
  const [editActual, setEditActual] = useState<FluidActual | null>(null);

  const { data: allTxns = [], isPending: txnsLoading } = useTransactions();
  const { data: categories = [], isPending: catsLoading } = useCategories();
  const setTargetMutation = useSetTarget();
  const removeTargetMutation = useRemoveTarget();

  const actuals = useMemo(
    () => computeFluidActuals(allTxns, categories, budget.targets, range, viewPeriod, budget),
    [allTxns, categories, budget, range, viewPeriod],
  );

  const loading = txnsLoading || catsLoading;
  const label = formatPeriodLabel(range, viewPeriod);

  function prev() {
    setRange((r) => shiftBudgetPeriod(viewPeriod, budget.startDate, r, -1));
  }
  function next() {
    setRange((r) => shiftBudgetPeriod(viewPeriod, budget.startDate, r, 1));
  }

  // Split targeted vs untargeted for display
  const targetedIncome = actuals.income.filter((a) => a.hasTarget);
  const untargetedIncome = actuals.income.filter((a) => !a.hasTarget);
  const targetedExpense = actuals.expense.filter((a) => a.hasTarget);
  const untargetedExpense = actuals.expense.filter((a) => !a.hasTarget);

  const hasAnyData = actuals.income.length > 0 || actuals.expense.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Period navigation */}
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

      {/* KPI summary — actual vs projected */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            {
              label: "Income",
              actual: actuals.totalActualIncome,
              projected: actuals.totalProjectedIncome,
              isPositive: true,
            },
            {
              label: "Expenses",
              actual: actuals.totalActualExpense,
              projected: actuals.totalProjectedExpense,
              isPositive: false,
            },
            {
              label: "Net",
              actual: actuals.net,
              projected: actuals.projectedNet,
              isPositive: actuals.net >= 0,
            },
          ] as const
        ).map(({ label: l, actual, projected, isPositive }) => (
          <Card key={l} className="border-border/60 bg-surface/60 backdrop-blur-md">
            <CardContent className="py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
              <Money
                value={actual}
                className={cn(
                  "mt-0.5 text-xl font-semibold tabular-nums",
                  isPositive ? "text-income" : "text-expense",
                  l === "Net" && actual >= 0 && "text-income",
                  l === "Net" && actual < 0 && "text-expense",
                )}
              />
              {projected > 0 && (
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  <Money value={projected} className="text-[10px]" /> projected
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content card */}
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="flex flex-col gap-3 p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !hasAnyData ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions this period yet. Add some transactions to see your cashflow here.
            </p>
          ) : (
            <>
              {/* ── Income section ── */}
              {(targetedIncome.length > 0 || untargetedIncome.length > 0) && (
                <>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Income
                  </h3>
                  {targetedIncome.map((actual) => (
                    <TargetRow
                      key={actual.categoryId}
                      actual={actual}
                      viewPeriod={viewPeriod}
                      onEditTarget={setEditActual}
                      onToggleRollover={(cid, current) =>
                        setTargetMutation.mutate({
                          budgetId: budget.id,
                          categoryId: cid,
                          amount: actual.projectedTarget ?? 0,
                          frequency: actual.targetFrequency ?? (viewPeriod as BudgetFrequency),
                          rollover: !current,
                        })
                      }
                      onRemoveTarget={(cid) =>
                        removeTargetMutation.mutate({ budgetId: budget.id, categoryId: cid })
                      }
                    />
                  ))}
                  <UntargetedSection
                    label="Other income"
                    actuals={untargetedIncome}
                    onSetTarget={(id, name) => setSetTargetFor({ id, name })}
                  />
                  <Separator />
                </>
              )}

              {/* ── Expense section ── */}
              {(targetedExpense.length > 0 || untargetedExpense.length > 0) && (
                <>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Expenses
                  </h3>
                  {targetedExpense.map((actual) => (
                    <TargetRow
                      key={actual.categoryId}
                      actual={actual}
                      viewPeriod={viewPeriod}
                      onEditTarget={setEditActual}
                      onToggleRollover={(cid, current) =>
                        setTargetMutation.mutate({
                          budgetId: budget.id,
                          categoryId: cid,
                          amount: actual.projectedTarget ?? 0,
                          frequency: actual.targetFrequency ?? (viewPeriod as BudgetFrequency),
                          rollover: !current,
                        })
                      }
                      onRemoveTarget={(cid) =>
                        removeTargetMutation.mutate({ budgetId: budget.id, categoryId: cid })
                      }
                    />
                  ))}
                  <UntargetedSection
                    label="Other spending"
                    actuals={untargetedExpense}
                    onSetTarget={(id, name) => setSetTargetFor({ id, name })}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SetTargetDialog
        open={!!setTargetFor}
        categoryName={setTargetFor?.name ?? ""}
        defaultFrequency={viewPeriod as BudgetFrequency}
        viewPeriod={viewPeriod as BudgetPeriod}
        onClose={() => setSetTargetFor(null)}
        onSave={(amount, frequency, rollover) => {
          if (!setTargetFor) return;
          setTargetMutation.mutate({
            budgetId: budget.id,
            categoryId: setTargetFor.id,
            amount,
            frequency,
            rollover,
          });
          setSetTargetFor(null);
        }}
      />

      <TargetEditDialog
        actual={editActual}
        viewPeriod={viewPeriod as BudgetPeriod}
        onClose={() => setEditActual(null)}
        onSave={(categoryId, amount, frequency, rollover) =>
          setTargetMutation.mutate({ budgetId: budget.id, categoryId, amount, frequency, rollover })
        }
      />
    </div>
  );
}
