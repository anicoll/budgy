import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { Cents } from "@/lib/money/cents";
import type { AllocationActual, Budget } from "../types";
import { currentPeriodRange, shiftBudgetPeriod } from "./period";

export function computeActuals(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
): AllocationActual[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // transactions in range, debit/transfer-out only (expense side)
  const rangeTxns = transactions.filter(
    (t) =>
      t.date >= range.from &&
      t.date <= range.to &&
      (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")),
  );

  const spentByCategory = new Map<string, number>();
  for (const t of rangeTxns) {
    if (!t.categoryId) continue;
    const current = spentByCategory.get(t.categoryId) ?? 0;
    spentByCategory.set(t.categoryId, current + Math.abs(signedAmount(t)));
  }

  // Previous period for rollover calculation
  let prevRange: DateRange | null = null;
  let prevRangeTxns: Transaction[] = [];
  if (budget.categoryAllocations.some((a) => a.rollover)) {
    prevRange = shiftBudgetPeriod(budget.period, budget.startDate, range, -1);
    prevRangeTxns = transactions.filter(
      (t) =>
        prevRange &&
        t.date >= prevRange.from &&
        t.date <= prevRange.to &&
        (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")),
    );
  }

  const prevSpentByCategory = new Map<string, number>();
  for (const t of prevRangeTxns) {
    if (!t.categoryId) continue;
    const current = prevSpentByCategory.get(t.categoryId) ?? 0;
    prevSpentByCategory.set(t.categoryId, current + Math.abs(signedAmount(t)));
  }

  return budget.categoryAllocations.map((alloc) => {
    const cat = catMap.get(alloc.categoryId);
    const spent = (spentByCategory.get(alloc.categoryId) ?? 0) as Cents;

    let rolloverAmount = 0 as Cents;
    if (alloc.rollover) {
      const prevSpent = (prevSpentByCategory.get(alloc.categoryId) ?? 0) as Cents;
      const prevRemaining = alloc.amount - prevSpent;
      rolloverAmount = Math.max(0, prevRemaining) as Cents;
    }

    const effectiveAllocated = (alloc.amount + rolloverAmount) as Cents;
    const remaining = (effectiveAllocated - spent) as Cents;

    return {
      categoryId: alloc.categoryId,
      categoryName: cat?.name ?? "Unknown",
      categoryColor: cat?.color ?? "#94a3b8",
      allocated: alloc.amount,
      spent,
      rolloverAmount,
      effectiveAllocated,
      remaining,
      rollover: alloc.rollover,
    };
  });
}

export function computeUnbudgetedSpend(
  budget: Budget,
  transactions: Transaction[],
  range: DateRange,
): Cents {
  const allocatedCategoryIds = new Set(budget.categoryAllocations.map((a) => a.categoryId));
  const rangeTxns = transactions.filter(
    (t) =>
      t.date >= range.from &&
      t.date <= range.to &&
      (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")) &&
      (!t.categoryId || !allocatedCategoryIds.has(t.categoryId)),
  );
  let total = 0;
  for (const t of rangeTxns) total += Math.abs(signedAmount(t));
  return total as Cents;
}

export function budgetTotals(actuals: AllocationActual[]): {
  allocated: Cents;
  spent: Cents;
  remaining: Cents;
} {
  let allocated = 0;
  let spent = 0;
  let remaining = 0;
  for (const a of actuals) {
    allocated += a.effectiveAllocated;
    spent += a.spent;
    remaining += a.remaining;
  }
  return { allocated: allocated as Cents, spent: spent as Cents, remaining: remaining as Cents };
}

export function progressColor(spent: Cents, effective: Cents): "safe" | "warning" | "over" {
  if (effective <= 0) return "over";
  const ratio = spent / effective;
  if (ratio >= 1) return "over";
  if (ratio >= 0.75) return "warning";
  return "safe";
}

export { currentPeriodRange };
