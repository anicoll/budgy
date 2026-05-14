import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { Cents } from "@/lib/money/cents";
import type {
  Budget,
  BudgetPeriod,
  CategoryTarget,
  FluidActual,
  FluidBudgetActuals,
} from "../types";
import { normaliseToPeriod } from "./normalise";
import { shiftBudgetPeriod } from "./period";

export function computeFluidActuals(
  transactions: Transaction[],
  categories: Category[],
  targets: CategoryTarget[],
  range: DateRange,
  viewPeriod: BudgetPeriod,
  budget: Budget,
): FluidBudgetActuals {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const targetMap = new Map(targets.map((t) => [t.categoryId, t]));

  // ── Step 1: Sum actuals in period ─────────────────────────────────────
  const inRange = transactions.filter((t) => t.date >= range.from && t.date <= range.to);

  const receivedByCategory = new Map<string, number>();
  const spentByCategory = new Map<string, number>();

  for (const t of inRange) {
    if (!t.categoryId) continue;
    if (t.type === "credit") {
      receivedByCategory.set(t.categoryId, (receivedByCategory.get(t.categoryId) ?? 0) + t.amount);
    } else if (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")) {
      spentByCategory.set(
        t.categoryId,
        (spentByCategory.get(t.categoryId) ?? 0) + Math.abs(signedAmount(t)),
      );
    }
  }

  // ── Step 2: Rollover — compute previous period's projected vs actual ──
  const prevProjectedByCategory = new Map<string, number>();
  const prevSpentByCategory = new Map<string, number>();
  const prevReceivedByCategory = new Map<string, number>();

  const needsRollover = targets.some((t) => t.rollover);
  if (needsRollover) {
    const prevRange = shiftBudgetPeriod(budget.period, budget.startDate, range, -1);
    const prevTxns = transactions.filter((t) => t.date >= prevRange.from && t.date <= prevRange.to);
    for (const t of prevTxns) {
      if (!t.categoryId) continue;
      if (t.type === "credit") {
        prevReceivedByCategory.set(
          t.categoryId,
          (prevReceivedByCategory.get(t.categoryId) ?? 0) + t.amount,
        );
      } else if (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")) {
        prevSpentByCategory.set(
          t.categoryId,
          (prevSpentByCategory.get(t.categoryId) ?? 0) + Math.abs(signedAmount(t)),
        );
      }
    }
    // Previous period's projected targets normalised to the same viewPeriod
    for (const target of targets) {
      if (target.rollover) {
        prevProjectedByCategory.set(
          target.categoryId,
          normaliseToPeriod(target.amount, target.frequency, viewPeriod),
        );
      }
    }
  }

  // ── Step 3: Union of all category IDs to surface ──────────────────────
  const allCategoryIds = new Set<string>([
    ...receivedByCategory.keys(),
    ...spentByCategory.keys(),
    ...targetMap.keys(),
  ]);

  // ── Step 4: Build FluidActual for each category ───────────────────────
  const incomeActuals: FluidActual[] = [];
  const expenseActuals: FluidActual[] = [];

  for (const categoryId of allCategoryIds) {
    const cat = catMap.get(categoryId);
    if (!cat || cat.type === "transfer") continue;

    const target = targetMap.get(categoryId);
    const isIncome = cat.type === "income";
    const actual = (
      isIncome ? (receivedByCategory.get(categoryId) ?? 0) : (spentByCategory.get(categoryId) ?? 0)
    ) as Cents;

    let projectedTarget: Cents | undefined;
    let rolloverAmount = 0 as Cents;
    let effectiveProjected: Cents | undefined;
    let variance: Cents | undefined;

    if (target) {
      projectedTarget = normaliseToPeriod(target.amount, target.frequency, viewPeriod);

      if (target.rollover) {
        const prevProjected = (prevProjectedByCategory.get(categoryId) ?? 0) as Cents;
        const prevActual = isIncome
          ? ((prevReceivedByCategory.get(categoryId) ?? 0) as Cents)
          : ((prevSpentByCategory.get(categoryId) ?? 0) as Cents);
        const prevSurplus = prevProjected - prevActual;
        rolloverAmount = Math.max(0, prevSurplus) as Cents;
      }

      effectiveProjected = (projectedTarget + rolloverAmount) as Cents;
      variance = (effectiveProjected - actual) as Cents;
    }

    const fluidActual: FluidActual = {
      categoryId,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryType: cat.type,
      actual,
      projectedTarget,
      rolloverAmount,
      effectiveProjected,
      variance,
      rollover: target?.rollover ?? false,
      hasTarget: !!target,
      targetFrequency: target?.frequency,
    };

    if (isIncome) {
      incomeActuals.push(fluidActual);
    } else {
      expenseActuals.push(fluidActual);
    }
  }

  // ── Step 5: Sort — targeted first, then by actual descending ─────────
  const sort = (items: FluidActual[]) =>
    items.sort((a, b) => {
      if (a.hasTarget !== b.hasTarget) return a.hasTarget ? -1 : 1;
      return b.actual - a.actual;
    });

  sort(incomeActuals);
  sort(expenseActuals);

  // ── Step 6: Totals ────────────────────────────────────────────────────
  const totalActualIncome = incomeActuals.reduce((s, a) => s + a.actual, 0) as Cents;
  const totalActualExpense = expenseActuals.reduce((s, a) => s + a.actual, 0) as Cents;
  const totalProjectedIncome = incomeActuals.reduce(
    (s, a) => s + (a.effectiveProjected ?? 0),
    0,
  ) as Cents;
  const totalProjectedExpense = expenseActuals.reduce(
    (s, a) => s + (a.effectiveProjected ?? 0),
    0,
  ) as Cents;

  return {
    income: incomeActuals,
    expense: expenseActuals,
    totalActualIncome,
    totalActualExpense,
    totalProjectedIncome,
    totalProjectedExpense,
    net: (totalActualIncome - totalActualExpense) as Cents,
    projectedNet: (totalProjectedIncome - totalProjectedExpense) as Cents,
  };
}

// ── Helpers preserved from M3 ─────────────────────────────────────────────

export function progressColor(actual: Cents, projected: Cents): "safe" | "warning" | "over" {
  if (projected <= 0) return "over";
  const ratio = actual / projected;
  if (ratio >= 1) return "over";
  if (ratio >= 0.75) return "warning";
  return "safe";
}

export function budgetSummaryTotals(actuals: FluidBudgetActuals) {
  return {
    income: {
      actual: actuals.totalActualIncome,
      projected: actuals.totalProjectedIncome,
    },
    expense: {
      actual: actuals.totalActualExpense,
      projected: actuals.totalProjectedExpense,
    },
    net: actuals.net,
    projectedNet: actuals.projectedNet,
  };
}
