import { signedAmount, type Transaction } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import { type Cents, cents } from "@/lib/money/cents";
import { normaliseToPeriod } from "../utils/normalise";
import type { BackendCategory, CategoryPeriodView, ViewCadence } from "./types";

export type CategoryTypeLookup = ReadonlyMap<string, BackendCategory["type"]>;

export function buildCategoryTypeLookup(
  categories: ReadonlyArray<{ id: string; type: BackendCategory["type"] }>,
): CategoryTypeLookup {
  const map = new Map<string, BackendCategory["type"]>();
  for (const cat of categories) {
    map.set(cat.id, cat.type);
  }
  return map;
}

function isInRange(tx: Transaction, range: DateRange, accountIds: Set<string>): boolean {
  return accountIds.has(tx.accountId) && tx.date >= range.from && tx.date <= range.to;
}

export function sumTransactionsInRange(
  transactions: Transaction[],
  accountIds: Set<string>,
  range: DateRange,
  categoryId?: string,
): Cents {
  let total = 0;
  for (const tx of transactions) {
    if (!accountIds.has(tx.accountId)) continue;
    if (tx.date < range.from || tx.date > range.to) continue;
    if (categoryId !== undefined && tx.categoryId !== categoryId) continue;
    total += signedAmount(tx);
  }
  return cents(total);
}

export function sumCategoryPeriodActual(
  transactions: Transaction[],
  accountIds: Set<string>,
  range: DateRange,
  category: Pick<BackendCategory, "id" | "type">,
): Cents {
  let total = 0;
  for (const tx of transactions) {
    if (!accountIds.has(tx.accountId)) continue;
    if (tx.date < range.from || tx.date > range.to) continue;
    if (tx.categoryId !== category.id) continue;
    const signed = signedAmount(tx);
    if (category.type === "income") {
      if (signed > 0) total += signed;
    } else if (category.type === "expense") {
      if (signed < 0) total += signed;
    } else {
      total += signed;
    }
  }
  return cents(total);
}

export function computeCategoryPeriodView(
  category: BackendCategory,
  viewCadence: ViewCadence,
  periodActual: Cents,
): CategoryPeriodView {
  const target = normaliseToPeriod(category.budgeted, category.budgetedFrequency, viewCadence);
  let remaining: number;
  if (category.type === "income") {
    remaining = periodActual - target;
  } else {
    // periodActual is signed (debits negative); remaining = target + actual
    remaining = target + periodActual;
  }
  return {
    periodTarget: target,
    periodActual,
    periodActualDisplay: cents(
      category.type === "income" ? Math.max(0, periodActual) : Math.abs(Math.min(0, periodActual)),
    ),
    periodRemaining: cents(remaining),
    overTarget: remaining < 0,
    actualLabel: category.type === "income" ? "Received" : "Spent",
  };
}

export function computePeriodReceived(
  transactions: Transaction[],
  accountIds: string[],
  range: DateRange,
  categoryTypes: CategoryTypeLookup,
): Cents {
  const ids = new Set(accountIds);
  let received = 0;
  for (const tx of transactions) {
    if (!isInRange(tx, range, ids) || !tx.categoryId) continue;
    if (categoryTypes.get(tx.categoryId) !== "income") continue;
    const signed = signedAmount(tx);
    if (signed > 0) received += signed;
  }
  return cents(received);
}

export function computeBudgetedTotalsForPeriod(
  categories: BackendCategory[],
  viewCadence: ViewCadence,
): { income: Cents; expenses: Cents } {
  let income = 0;
  let expenses = 0;
  for (const cat of categories) {
    if (cat.type === "transfer") continue;
    const target = normaliseToPeriod(cat.budgeted, cat.budgetedFrequency, viewCadence);
    if (cat.type === "income") {
      income += target;
    } else {
      expenses += target;
    }
  }
  return { income: cents(income), expenses: cents(expenses) };
}

export function computePeriodSpent(
  transactions: Transaction[],
  accountIds: string[],
  range: DateRange,
  categoryTypes: CategoryTypeLookup,
): Cents {
  const ids = new Set(accountIds);
  let spent = 0;
  for (const tx of transactions) {
    if (!isInRange(tx, range, ids) || !tx.categoryId) continue;
    if (categoryTypes.get(tx.categoryId) !== "expense") continue;
    const signed = signedAmount(tx);
    if (signed < 0) spent += -signed;
  }
  return cents(spent);
}

export function uncategorizedTransactionsInPeriod(
  transactions: Transaction[],
  accountIds: string[],
  range: DateRange,
): Transaction[] {
  const ids = new Set(accountIds);
  return transactions.filter(
    (tx) => ids.has(tx.accountId) && tx.date >= range.from && tx.date <= range.to && !tx.categoryId,
  );
}
