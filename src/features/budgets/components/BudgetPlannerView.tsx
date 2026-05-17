"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import { useMortgagePlan } from "@/features/mortgage/hooks";
import { calcMinRepayment } from "@/features/mortgage/utils/amortise";
import { useTransactions } from "@/features/transactions/hooks";
import { signedAmount, type Transaction } from "@/features/transactions/types";
import type { Cents } from "@/lib/money/cents";
import { formatAUDCompact } from "@/lib/money/format";
import { queryKeys } from "@/lib/query/keys";
import type { NovatedLease } from "@/lib/state/prefs-store";
import { usePrefs } from "@/lib/state/prefs-store";
import { cn } from "@/lib/utils";

// Stable empty array — prevents Zustand selector infinite loop when novatedLeases is undefined
const EMPTY_LEASES: NovatedLease[] = [];

import {
  useEnsureMissingTargets,
  useRemoveTarget,
  useSetBudgetViewPeriod,
  useSetTarget,
} from "../hooks";
import type { Budget, BudgetFrequency, BudgetPeriod, CategoryTarget, PlannerItem } from "../types";
import { BUDGET_PERIOD_LABEL } from "../types";
import { computeFluidActuals, progressColor } from "../utils/actuals";
import { estimateFortnightlyNet } from "../utils/au-tax";
import { FREQUENCY_LABEL, normaliseToPeriod } from "../utils/normalise";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "../utils/period";
import { HousingSetupDialog, isHousingCategory } from "./HousingSetupDialog";

const PERIOD_TABS: { value: BudgetPeriod; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "fortnightly", label: "2 Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

// Smart default frequency for new targets
function defaultFrequency(type: "income" | "expense"): BudgetFrequency {
  return type === "income" ? "fortnightly" : "monthly";
}

function computePlannerItems(
  targets: CategoryTarget[],
  categoryMap: Map<
    string,
    { name: string; color: string; type: string; system?: boolean; parentId?: string | null }
  >,
  actualByCategory: Map<
    string,
    {
      actual: Cents;
      effectiveProjected?: Cents;
      variance?: Cents;
    }
  >,
  viewPeriod: BudgetPeriod,
): { income: PlannerItem[]; expense: PlannerItem[]; totalIncome: Cents; totalExpense: Cents } {
  const income: PlannerItem[] = [];
  const expense: PlannerItem[] = [];

  for (const target of targets) {
    const cat = categoryMap.get(target.categoryId);
    if (!cat || cat.type === "transfer") continue;

    const normalisedAmount = normaliseToPeriod(
      target.amount,
      target.frequency,
      viewPeriod as BudgetFrequency,
    );
    const tracking = actualByCategory.get(target.categoryId);
    const actualAmount = (tracking?.actual ?? (0 as Cents)) as Cents;
    const projectedAmount = (tracking?.effectiveProjected ?? normalisedAmount) as Cents;
    const varianceAmount = (tracking?.variance ?? projectedAmount - actualAmount) as Cents;
    const progress =
      cat.type === "expense"
        ? progressColor(actualAmount, projectedAmount)
        : actualAmount >= projectedAmount
          ? "safe"
          : "warning";

    const parentCat = cat.parentId ? categoryMap.get(cat.parentId) : undefined;
    const item: PlannerItem = {
      categoryId: target.categoryId,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryType: cat.type as "income" | "expense",
      categorySystem: cat.system,
      nativeAmount: target.amount,
      nativeFrequency: target.frequency,
      normalisedAmount,
      actualAmount,
      projectedAmount,
      varianceAmount,
      progress,
      parentCategoryId: cat.parentId ?? undefined,
      parentCategoryName: parentCat?.name,
    };

    if (cat.type === "income") income.push(item);
    else expense.push(item);
  }

  // Sort expenses so subcategories are grouped adjacent to their parent group
  expense.sort((a, b) => {
    const aGroup = a.parentCategoryId ?? a.categoryId;
    const bGroup = b.parentCategoryId ?? b.categoryId;
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    // Within same group: subcategories after root items
    if (a.parentCategoryId && !b.parentCategoryId) return 1;
    if (!a.parentCategoryId && b.parentCategoryId) return -1;
    return 0;
  });

  const totalIncome = income.reduce((s, i) => s + i.normalisedAmount, 0) as Cents;
  const totalExpense = expense.reduce((s, i) => s + i.normalisedAmount, 0) as Cents;

  return { income, expense, totalIncome, totalExpense };
}

// ── Budget allocation bar ─────────────────────────────────────────────────────

function BudgetAllocationBar({ items, totalBudget }: { items: PlannerItem[]; totalBudget: Cents }) {
  if (totalBudget <= 0 || items.length === 0) return null;

  // Pre-compute left offsets for each segment
  const segments = items
    .filter((item) => item.normalisedAmount > 0)
    .map((item) => ({
      item,
      widthPct: (item.normalisedAmount / totalBudget) * 100,
      spentPct:
        item.normalisedAmount > 0
          ? Math.min(100, (item.actualAmount / item.normalisedAmount) * 100)
          : 0,
    }));

  let accumulated = 0;
  return (
    <div className="flex flex-col gap-1.5">
      {/* Stacked proportional bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
        {segments.map(({ item, widthPct, spentPct }) => {
          const left = accumulated;
          accumulated += widthPct;
          return (
            <div
              key={item.categoryId}
              title={`${item.categoryName}: ${(widthPct).toFixed(1)}% of budget`}
              className="absolute top-0 h-full"
              style={{ left: `${left}%`, width: `${widthPct}%`, background: item.categoryColor }}
            >
              {/* Darker fill showing actual spend progress */}
              <div
                className="absolute inset-y-0 left-0 bg-black/25"
                style={{ width: `${spentPct}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Legend: top-N category names */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {segments.slice(0, 8).map(({ item, widthPct }) => (
          <div key={item.categoryId} className="flex shrink-0 items-center gap-1">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: item.categoryColor }}
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
              {item.categoryName}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {widthPct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  budget: Budget;
}

interface SankeyLink {
  from: string;
  to: string;
  value: Cents;
  color: string;
}

export function BudgetPlannerView({ budget }: Props) {
  const [viewPeriod, setViewPeriodLocal] = useState<BudgetPeriod>(budget.period);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [housingDialogCat, setHousingDialogCat] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const qc = useQueryClient();
  const setTargetMutation = useSetTarget();
  const removeTargetMutation = useRemoveTarget();
  const setPeriodMutation = useSetBudgetViewPeriod();
  const ensureMissingTargetsMutation = useEnsureMissingTargets();
  const { data: allCategories = [], isPending: catsLoading } = useCategories({
    includeArchived: true,
  });
  const { data: transactions = [] } = useTransactions();
  const { data: mortgagePlan } = useMortgagePlan();
  const annualSalary = usePrefs((s) => s.annualSalary);
  const hasPrivateHealth = usePrefs((s) => s.hasPrivateHealth ?? false);
  const novatedLeases = usePrefs((s) => s.novatedLeases ?? EMPTY_LEASES);
  const autoEnsureInFlightRef = useRef<Set<string>>(new Set());
  const autoEnsureFailedRef = useRef<string | null>(null);

  const categoryMap = useMemo(
    () =>
      new Map(
        allCategories.map((c) => [
          c.id,
          { name: c.name, color: c.color, type: c.type, system: c.system, parentId: c.parentId },
        ]),
      ),
    [allCategories],
  );

  const periodRange = useMemo(() => {
    const current = currentPeriodRange(viewPeriod, budget.startDate, new Date());
    if (periodOffset === 0) return current;
    return shiftBudgetPeriod(viewPeriod, budget.startDate, current, periodOffset);
  }, [viewPeriod, budget.startDate, periodOffset]);

  const fluidActuals = useMemo(
    () =>
      computeFluidActuals(
        transactions,
        allCategories,
        budget.targets,
        periodRange,
        viewPeriod,
        budget,
      ),
    [transactions, allCategories, budget.targets, periodRange, viewPeriod, budget],
  );

  const actualByCategory = useMemo(() => {
    const map = new Map<
      string,
      {
        actual: Cents;
        effectiveProjected?: Cents;
        variance?: Cents;
      }
    >();
    for (const actual of [...fluidActuals.income, ...fluidActuals.expense]) {
      map.set(actual.categoryId, {
        actual: actual.actual,
        effectiveProjected: actual.effectiveProjected,
        variance: actual.variance,
      });
    }
    return map;
  }, [fluidActuals]);

  const inPeriodTransactionsByCategory = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    const inRange = transactions.filter(
      (t) => t.date >= periodRange.from && t.date <= periodRange.to,
    );
    for (const txn of inRange) {
      if (!txn.categoryId) continue;
      const existing = map.get(txn.categoryId) ?? [];
      existing.push(txn);
      map.set(txn.categoryId, existing);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    }
    return map;
  }, [transactions, periodRange]);

  const { income, expense, totalIncome, totalExpense } = useMemo(
    () => computePlannerItems(budget.targets, categoryMap, actualByCategory, viewPeriod),
    [budget.targets, categoryMap, actualByCategory, viewPeriod],
  );

  const net = (totalIncome - totalExpense) as Cents;
  const allocatedIds = useMemo(
    () => new Set(budget.targets.map((t) => t.categoryId)),
    [budget.targets],
  );

  const missingExpenseTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const txn of transactions) {
      if (!txn.categoryId) continue;
      const cat = categoryMap.get(txn.categoryId);
      if (!cat || cat.type !== "expense") continue;
      if (allocatedIds.has(txn.categoryId)) continue;
      // Skip subcategories whose parent is already in the budget — they roll up
      if (cat.parentId && allocatedIds.has(cat.parentId)) continue;
      ids.add(txn.categoryId);
    }
    return [...ids];
  }, [transactions, categoryMap, allocatedIds]);

  useEffect(() => {
    if (missingExpenseTargetIds.length === 0) return;
    const signature = `${budget.id}:${[...missingExpenseTargetIds].sort().join(",")}`;
    if (autoEnsureFailedRef.current === signature) return;
    if (autoEnsureInFlightRef.current.has(signature)) return;

    autoEnsureInFlightRef.current.add(signature);
    ensureMissingTargetsMutation.mutate(
      { budgetId: budget.id, categoryIds: missingExpenseTargetIds },
      {
        onSuccess: () => {
          autoEnsureFailedRef.current = null;
        },
        onError: () => {
          autoEnsureFailedRef.current = signature;
        },
        onSettled: () => {
          autoEnsureInFlightRef.current.delete(signature);
        },
      },
    );
  }, [budget.id, ensureMissingTargetsMutation, missingExpenseTargetIds]);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const availableIncome = allCategories
    .filter((c) => c.type === "income" && !c.archived && !allocatedIds.has(c.id))
    .sort(byName);
  const availableExpense = allCategories
    .filter((c) => c.type === "expense" && !c.archived && !allocatedIds.has(c.id))
    .sort(byName);

  function switchPeriod(next: BudgetPeriod) {
    if (next === viewPeriod) return;
    setViewPeriodLocal(next);
    setPeriodOffset(0);
    setPeriodMutation.mutate({ id: budget.id, period: next });
  }

  function addCategory(categoryId: string, type: "income" | "expense") {
    const cat = allCategories.find((c) => c.id === categoryId);
    const catName = cat?.name ?? "";

    // Intercept housing/rent/mortgage — open smart dialog instead
    if (isHousingCategory(catName) && cat) {
      setHousingDialogCat({ id: cat.id, name: cat.name, color: cat.color });
      return;
    }

    // Smart salary default: pre-fill estimated net fortnightly (AU tax estimate)
    const isSalary = /salary/i.test(catName);
    const defaultAmount = isSalary && salaryEstimate ? salaryEstimate : (0 as Cents);

    setTargetMutation.mutate({
      budgetId: budget.id,
      categoryId,
      amount: defaultAmount,
      frequency: isSalary ? "fortnightly" : defaultFrequency(type),
      rollover: false,
    });
  }

  function removeTarget(categoryId: string) {
    removeTargetMutation.mutate({ budgetId: budget.id, categoryId });
  }

  function saveTarget(categoryId: string, amount: number, frequency: BudgetFrequency) {
    setTargetMutation.mutate({
      budgetId: budget.id,
      categoryId,
      amount,
      frequency,
      rollover: false,
    });
  }

  const periodLabel = BUDGET_PERIOD_LABEL[viewPeriod].toLowerCase();
  const sankeyLinks = useMemo(() => {
    const expenseActuals = fluidActuals.expense.filter((x) => x.actual > 0);

    // Group subcategories under their parent; root categories stay individual
    const grouped = new Map<string, { name: string; color: string; total: Cents }>();
    for (const item of expenseActuals) {
      const cat = categoryMap.get(item.categoryId);
      const parentId = cat?.parentId;
      if (parentId) {
        const parent = categoryMap.get(parentId);
        if (parent) {
          const existing = grouped.get(parentId) ?? {
            name: parent.name,
            color: parent.color,
            total: 0 as Cents,
          };
          existing.total = (existing.total + item.actual) as Cents;
          grouped.set(parentId, existing);
          continue;
        }
      }
      const existing = grouped.get(item.categoryId) ?? {
        name: item.categoryName,
        color: item.categoryColor,
        total: 0 as Cents,
      };
      existing.total = (existing.total + item.actual) as Cents;
      grouped.set(item.categoryId, existing);
    }

    const sorted = [...grouped.values()].sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, 8);
    const otherTotal = sorted.slice(8).reduce((s, g) => s + g.total, 0) as Cents;

    const links: SankeyLink[] = top.map((g) => ({
      from: "Income",
      to: g.name,
      value: g.total,
      color: g.color,
    }));

    if (otherTotal > 0) {
      links.push({ from: "Income", to: "Other expenses", value: otherTotal, color: "#94a3b8" });
    }

    const totalSpent = links.reduce((s, l) => s + l.value, 0) as Cents;
    const remainder = (fluidActuals.totalActualIncome - totalSpent) as Cents;
    if (remainder > 0) {
      links.push({ from: "Income", to: "Remaining", value: remainder, color: "#34d399" });
    } else if (remainder < 0) {
      links.push({
        from: "Income",
        to: "Deficit",
        value: Math.abs(remainder) as Cents,
        color: "#ef4444",
      });
    }
    return links;
  }, [fluidActuals, categoryMap]);

  // Mortgage ↔ budget mismatch: detect when the mortgage minimum repayment
  // diverges from the housing category's budget target by more than $1/month.
  const mortgageMismatch = useMemo(() => {
    if (!mortgagePlan) return null;
    const housingItems = expense.filter((e) => isHousingCategory(e.categoryName));
    if (housingItems.length === 0) return null;
    const minRepayment = calcMinRepayment(
      mortgagePlan.currentBalance,
      mortgagePlan.interestRate,
      mortgagePlan.termYears,
      mortgagePlan.repaymentFrequency,
    );
    const mortgageMonthly = normaliseToPeriod(
      minRepayment,
      mortgagePlan.repaymentFrequency as BudgetFrequency,
      "monthly",
    );
    // If ANY housing item already has a budget close to the mortgage repayment, no hint needed
    const alreadySynced = housingItems.some((item) => {
      const budgetMonthly = normaliseToPeriod(item.nativeAmount, item.nativeFrequency, "monthly");
      return Math.abs(mortgageMonthly - budgetMonthly) <= 100;
    });
    if (alreadySynced) return null;
    // Target the most specific item (prefer "rent/mortgage" name) for the sync action
    const targetItem =
      housingItems.find((e) => /rent|mortgage/i.test(e.categoryName)) ?? housingItems[0];
    return { categoryId: targetItem.categoryId, mortgageMonthly };
  }, [mortgagePlan, expense]);

  const salaryEstimate = useMemo(
    () =>
      annualSalary && annualSalary > 0
        ? estimateFortnightlyNet(annualSalary, hasPrivateHealth, novatedLeases)
        : null,
    [annualSalary, hasPrivateHealth, novatedLeases],
  );

  const salaryIncomeItem = income.find((item) => /salary/i.test(item.categoryName));
  const salaryOutOfSync =
    salaryEstimate !== null &&
    salaryIncomeItem !== undefined &&
    salaryIncomeItem.nativeFrequency === "fortnightly" &&
    Math.abs(salaryIncomeItem.nativeAmount - salaryEstimate) > 100; // > $1/fn difference

  function syncSalaryTarget() {
    if (!salaryIncomeItem || !salaryEstimate) return;
    // Optimistically update the cache so the banner disappears and the row resets immediately
    const updatedBudget: Budget = {
      ...budget,
      targets: budget.targets.map((t) =>
        t.categoryId === salaryIncomeItem.categoryId
          ? { ...t, amount: salaryEstimate, frequency: "fortnightly" as BudgetFrequency }
          : t,
      ),
    };
    qc.setQueryData([...queryKeys.budgets.list(), "active"], updatedBudget);
    // Persist to DB in the background
    setTargetMutation.mutate({
      budgetId: budget.id,
      categoryId: salaryIncomeItem.categoryId,
      amount: salaryEstimate,
      frequency: "fortnightly",
      rollover: false,
    });
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Period header */}
      <div className="border-b border-border/60 bg-surface/40 backdrop-blur-md">
        {/* Row 1: period type tabs */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center">
            {PERIOD_TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => switchPeriod(value)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  viewPeriod === value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {viewPeriod === value && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-accent" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 pr-2 text-sm tabular-nums">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Income{" "}
              </span>
              <Money value={totalIncome} className="font-semibold text-income" />
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Expenses{" "}
              </span>
              <Money value={totalExpense} className="font-semibold text-expense" />
            </div>
            <div className="hidden text-right sm:block">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Net{" "}
              </span>
              <Money
                value={net}
                className={cn("font-semibold", net >= 0 ? "text-income" : "text-expense")}
              />
            </div>
          </div>
        </div>
        {/* Row 2: period navigator */}
        <div className="flex items-center justify-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setPeriodOffset((o) => o - 1)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-medium tabular-nums">
            {formatPeriodLabel(periodRange, viewPeriod)}
          </span>
          <button
            type="button"
            onClick={() => setPeriodOffset((o) => Math.min(0, o + 1))}
            disabled={periodOffset >= 0}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Salary sync banner */}
      {salaryOutOfSync && salaryEstimate && (
        <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2.5 text-sm">
          <span className="flex-1 text-muted-foreground">
            Your salary settings changed — estimated take-home is now{" "}
            <strong className="text-foreground tabular-nums">
              <Money value={salaryEstimate} />
              /fn
            </strong>
          </span>
          <button
            type="button"
            onClick={syncSalaryTarget}
            className="shrink-0 rounded-lg bg-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
          >
            Update budget
          </button>
        </div>
      )}

      {/* Budget allocation bar */}
      {totalExpense > 0 && (
        <div className="border-b border-border/60 bg-surface/30 px-4 py-3">
          <BudgetAllocationBar items={expense} totalBudget={totalExpense} />
        </div>
      )}

      {/* Main planner */}
      <div className="flex flex-col gap-0 divide-y divide-border/30">
        {/* Income section */}
        <PlannerSection
          title="Income"
          items={income}
          viewPeriod={viewPeriod}
          periodLabel={periodLabel}
          available={availableIncome.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          onAdd={(id) => addCategory(id, "income")}
          onSave={saveTarget}
          onRemove={removeTarget}
          expandedCategoryId={expandedCategoryId}
          onToggleExpand={(categoryId) =>
            setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId))
          }
          txnsByCategory={inPeriodTransactionsByCategory}
          loading={catsLoading}
        />

        {/* Mortgage/budget mismatch hint */}
        {mortgageMismatch && (
          <div className="flex items-center gap-3 border-border/30 bg-warning/5 px-4 py-2 text-xs">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="flex-1 text-muted-foreground">
              Your mortgage repayment may have changed — housing budget could be stale.
            </span>
            <button
              type="button"
              onClick={() =>
                saveTarget(mortgageMismatch.categoryId, mortgageMismatch.mortgageMonthly, "monthly")
              }
              className="shrink-0 rounded px-2 py-0.5 text-xs bg-muted hover:bg-muted/80 transition-colors"
            >
              Sync ${(mortgageMismatch.mortgageMonthly / 100).toFixed(0)}/mo
            </button>
          </div>
        )}

        {/* Expense section */}
        <PlannerSection
          title="Expenses"
          items={expense}
          viewPeriod={viewPeriod}
          periodLabel={periodLabel}
          available={availableExpense.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          onAdd={(id) => addCategory(id, "expense")}
          onSave={saveTarget}
          onRemove={removeTarget}
          expandedCategoryId={expandedCategoryId}
          onToggleExpand={(categoryId) =>
            setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId))
          }
          txnsByCategory={inPeriodTransactionsByCategory}
          loading={catsLoading}
        />
      </div>

      {housingDialogCat && (
        <HousingSetupDialog
          category={housingDialogCat}
          budgetId={budget.id}
          onClose={() => setHousingDialogCat(null)}
        />
      )}

      <SankeyOverview links={sankeyLinks} periodLabel={periodLabel} />
    </div>
  );
}

function SankeyOverview({ links, periodLabel }: { links: SankeyLink[]; periodLabel: string }) {
  const total = links.reduce((sum, l) => sum + l.value, 0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build apexsankey-compatible data — unique node IDs from category names
  const sankeyData = useMemo(() => {
    const nodeIds = new Set<string>(["income"]);
    const nodes: { id: string; title: string }[] = [{ id: "income", title: "Income" }];
    const edges: { source: string; target: string; value: number; type: string }[] = [];

    links.forEach((link, i) => {
      // Ensure unique IDs even if two categories normalise to the same string
      const base = link.to.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const targetId = nodeIds.has(base) ? `${base}-${i}` : base;
      nodeIds.add(targetId);
      nodes.push({ id: targetId, title: link.to });
      edges.push({
        source: "income",
        target: targetId,
        value: Math.round(link.value / 100),
        type: "flow",
      }); // whole dollars
    });

    return { nodes, edges };
  }, [links]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || sankeyData.edges.length === 0) return;

    let destroyed = false;
    // Store only the destroy fn so render stays fully typed inside .then
    let destroyFn: (() => void) | undefined;

    // Lazy import — keeps apexsankey out of the SSR bundle
    import("apexsankey").then(({ default: ApexSankeyLib }) => {
      if (destroyed || !container) return;

      const isDark = document.documentElement.classList.contains("dark");
      const fmt = (v: number) =>
        new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

      const instance = new ApexSankeyLib(container, {
        width: "100%",
        height: 280,
        spacing: 60,
        nodeWidth: 16,
        edgeOpacity: 0.5,
        edgeGradientFill: true,
        enableToolbar: false,
        canvasStyle: "background:transparent;border:none;",
        fontColor: isDark ? "#cbd5e1" : "#374151",
        tooltipTheme: isDark ? "dark" : "light",
        tooltipTemplate: (content) => {
          // TooltipContent.source/target are NodeData | null | undefined
          const c = content as {
            source?: { title?: string } | null;
            target?: { title?: string } | null;
            value?: number;
          };
          return `<div style="font-size:12px;padding:4px 8px;">${c.source?.title ?? ""} → ${c.target?.title ?? ""}: <strong>${fmt(Number(c.value ?? 0))}</strong></div>`;
        },
        a11y: { enabled: true, diagramLabel: `Cash flow for ${periodLabel}` },
      });

      instance.render({
        nodes: sankeyData.nodes,
        edges: sankeyData.edges,
        options: instance.options,
      });
      destroyFn = () => instance.destroy();
    });

    return () => {
      destroyed = true;
      destroyFn?.();
    };
  }, [sankeyData, periodLabel]);

  if (total <= 0) {
    return (
      <div className="mt-4 rounded-xl border border-border/60 bg-surface/30 p-4">
        <p className="text-sm font-semibold">Cash flow</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No transactions for this {periodLabel} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-surface/30 p-4">
      <p className="mb-1 text-sm font-semibold">Cash flow this {periodLabel}</p>
      {/* apexsankey renders inside this div */}
      <div ref={containerRef} className="min-h-[280px] w-full" />
      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {links.map((link) => (
          <div key={`legend-${link.to}`} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: link.color }} />
              <span className="truncate text-muted-foreground">{link.to}</span>
            </span>
            <Money value={link.value} className="shrink-0 tabular-nums font-medium" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PlannerSection ────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  items: PlannerItem[];
  viewPeriod: BudgetPeriod;
  periodLabel: string;
  available: { id: string; name: string; color: string }[];
  onAdd: (categoryId: string) => void;
  onSave: (categoryId: string, amount: number, frequency: BudgetFrequency) => void;
  onRemove: (categoryId: string) => void;
  expandedCategoryId: string | null;
  onToggleExpand: (categoryId: string) => void;
  txnsByCategory: Map<string, Transaction[]>;
  loading: boolean;
}

function PlannerSection({
  title,
  items,
  viewPeriod,
  periodLabel,
  available,
  onAdd,
  onSave,
  onRemove,
  expandedCategoryId,
  onToggleExpand,
  txnsByCategory,
  loading,
}: SectionProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between bg-surface/50 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(!addOpen)}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`Add ${title.toLowerCase()} category`}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
          {addOpen && (
            <AddCategoryDropdown
              available={available}
              onSelect={(id) => {
                onAdd(id);
                setAddOpen(false);
              }}
              onClose={() => setAddOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="flex flex-col gap-0 px-4 py-2">
          {["a", "b"].map((k) => (
            <Skeleton key={k} className="mb-2 h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} categories yet — click Add to set one up.
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {items.map((item, i) => {
            const prevParent = i > 0 ? items[i - 1].parentCategoryId : undefined;
            const showGroupHeader = item.parentCategoryId && item.parentCategoryId !== prevParent;
            return (
              <Fragment key={item.categoryId}>
                {showGroupHeader && (
                  <div className="flex items-center gap-2 bg-muted/20 px-4 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.parentCategoryName}
                    </span>
                  </div>
                )}
                <PlannerRow
                  key={`${item.categoryId}-${item.nativeAmount}`}
                  item={item}
                  viewPeriod={viewPeriod}
                  periodLabel={periodLabel}
                  onSave={onSave}
                  onRemove={onRemove}
                  expanded={expandedCategoryId === item.categoryId}
                  onToggleExpand={onToggleExpand}
                  transactions={txnsByCategory.get(item.categoryId) ?? []}
                />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PlannerRow ────────────────────────────────────────────────────────────

interface RowProps {
  item: PlannerItem;
  viewPeriod: BudgetPeriod;
  periodLabel: string;
  onSave: (categoryId: string, amount: number, frequency: BudgetFrequency) => void;
  onRemove: (categoryId: string) => void;
  expanded: boolean;
  onToggleExpand: (categoryId: string) => void;
  transactions: Transaction[];
}

function PlannerRow({
  item,
  viewPeriod,
  periodLabel,
  onSave,
  onRemove,
  expanded,
  onToggleExpand,
  transactions,
}: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawAmount, setRawAmount] = useState(
    item.nativeAmount > 0 ? String(item.nativeAmount / 100) : "",
  );
  const [frequency, setFrequency] = useState<BudgetFrequency>(item.nativeFrequency);

  // Live preview: normalised for current view period
  const parsedCents = parseFloat(rawAmount) * 100;
  const preview =
    Number.isFinite(parsedCents) && parsedCents > 0
      ? normaliseToPeriod(
          Math.round(parsedCents) as Cents,
          frequency,
          viewPeriod as BudgetFrequency,
        )
      : null;

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(rawAmount);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSave(item.categoryId, Math.round(parsed * 100), frequency);
    }
  }, [rawAmount, frequency, item.categoryId, onSave]);

  const handleFrequencyChange = useCallback(
    (newFreq: BudgetFrequency) => {
      setFrequency(newFreq);
      const parsed = parseFloat(rawAmount);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onSave(item.categoryId, Math.round(parsed * 100), newFreq);
      }
    },
    [rawAmount, item.categoryId, onSave],
  );

  const isExpense = item.categoryType === "expense";

  // Progress bar fill — capped at 100%, colour tracks progress state
  const spentPct =
    item.projectedAmount > 0 ? Math.min(100, (item.actualAmount / item.projectedAmount) * 100) : 0;
  const barColor =
    item.progress === "over"
      ? "bg-destructive"
      : item.progress === "warning"
        ? "bg-amber-500"
        : "bg-income";

  // "$X left" / "$X over" framing
  const absVariance = Math.abs(item.varianceAmount) as Cents;
  const remainingLabel = isExpense
    ? item.varianceAmount > 0
      ? `${formatAUDCompact(absVariance)} left`
      : item.varianceAmount < 0
        ? `${formatAUDCompact(absVariance)} over`
        : "On budget"
    : item.varianceAmount >= 0
      ? `${formatAUDCompact(absVariance)} ahead`
      : `${formatAUDCompact(absVariance)} short`;

  const remainingColor = isExpense
    ? item.progress === "over"
      ? "text-destructive"
      : item.progress === "warning"
        ? "text-amber-500"
        : "text-income"
    : item.actualAmount >= item.projectedAmount
      ? "text-income"
      : "text-amber-500";

  return (
    <div className="group px-4 py-3">
      {/* Main row */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: item.categoryColor }}
        >
          {item.categoryName.charAt(0).toUpperCase()}
        </span>

        <button
          type="button"
          onClick={() => onToggleExpand(item.categoryId)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary transition-colors"
        >
          {item.categoryName}
        </button>

        {/* Actual / Budget */}
        <div className="hidden text-right tabular-nums sm:block">
          <span className="text-xs text-muted-foreground">
            {formatAUDCompact(item.actualAmount)}
          </span>
          {item.projectedAmount > 0 && (
            <span className="text-xs text-muted-foreground/50">
              {" "}
              / {formatAUDCompact(item.projectedAmount)}
            </span>
          )}
        </div>

        {/* Remaining / over framing */}
        {item.projectedAmount > 0 && (
          <span
            className={cn(
              "w-24 text-right text-sm font-semibold tabular-nums shrink-0",
              remainingColor,
            )}
          >
            {remainingLabel}
          </span>
        )}

        {/* Remove — visible on hover, hidden for system */}
        {!item.categorySystem && (
          <button
            type="button"
            onClick={() => onRemove(item.categoryId)}
            aria-label={`Remove ${item.categoryName}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {item.categorySystem && <div className="h-6 w-6 shrink-0" />}
      </div>

      {/* Progress bar */}
      {item.projectedAmount > 0 && (
        <div className="mt-2 sm:ml-10">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barColor)}
              style={{ width: `${spentPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded: edit controls + transactions */}
      {expanded && (
        <div className="mt-3 sm:ml-10 flex flex-col gap-3">
          {/* Inline budget edit */}
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.blur()}
                placeholder="0"
                className="w-full rounded-md border border-border/60 bg-surface/60 py-1.5 pl-6 pr-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label={`Budget amount for ${item.categoryName}`}
              />
            </div>
            <Select
              value={frequency}
              onValueChange={(v) => handleFrequencyChange(v as BudgetFrequency)}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABEL) as BudgetFrequency[]).map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preview !== null && frequency !== viewPeriod && (
              <span className="text-xs text-muted-foreground tabular-nums">
                = {formatAUDCompact(preview)}/{periodLabel}
              </span>
            )}
          </div>

          {/* Transactions */}
          <div className="rounded-lg border border-border/50 bg-surface/40 p-2.5 text-xs">
            {transactions.length === 0 ? (
              <div className="text-muted-foreground">No transactions in this period.</div>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {txn.payee || txn.description || "Transaction"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{txn.date}</div>
                    </div>
                    <Money value={signedAmount(txn)} className="shrink-0 tabular-nums" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add category dropdown ─────────────────────────────────────────────────

function AddCategoryDropdown({
  available,
  onSelect,
  onClose,
}: {
  available: { id: string; name: string; color: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  if (available.length === 0) {
    return (
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-surface-elevated p-3 text-xs text-muted-foreground shadow-lg backdrop-blur-xl">
        All categories are already added.
      </div>
    );
  }

  return (
    <>
      {/* Click-outside overlay */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border/60 bg-surface-elevated shadow-lg backdrop-blur-xl">
        {available.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: cat.color }} />
            {cat.name}
          </button>
        ))}
      </div>
    </>
  );
}
