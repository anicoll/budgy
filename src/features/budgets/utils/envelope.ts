import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { Cents } from "@/lib/money/cents";
import type {
  Budget,
  BudgetFrequency,
  BudgetMode,
  BudgetPeriod,
  CategoryTarget,
  EnvelopeBundle,
  EnvelopeState,
  EnvelopeStatus,
} from "../types";
import { normaliseToPeriod } from "./normalise";

export const UNCATEGORISED_ID = "__uncategorised__";

const MS_PER_DAY = 86_400_000;

const FREQUENCY_DAYS: Record<BudgetFrequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

/** Default mode when a target is created without one. Lumpy → envelope, frequent → period. */
export function defaultModeFor(frequency: BudgetFrequency): BudgetMode {
  return frequency === "quarterly" || frequency === "yearly" ? "envelope" : "period";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return Math.max(0, (to - from) / MS_PER_DAY);
}

function hasTargetAncestor(
  categoryId: string,
  catMap: Map<string, Category>,
  targetMap: Map<string, CategoryTarget>,
): boolean {
  const parentId = catMap.get(categoryId)?.parentId;
  if (!parentId) return false;
  if (targetMap.has(parentId)) return true;
  return hasTargetAncestor(parentId, catMap, targetMap);
}

function getDescendantSum(
  categoryId: string,
  catMap: Map<string, Category>,
  sumMap: Map<string, number>,
): number {
  let total = sumMap.get(categoryId) ?? 0;
  for (const cat of catMap.values()) {
    if (cat.parentId === categoryId) total += getDescendantSum(cat.id, catMap, sumMap);
  }
  return total;
}

/** Cumulative funding for a target between two ISO dates. Smoothed (fractional periods). */
export function fundedBetween(target: CategoryTarget, fromISO: string, toISO: string): Cents {
  const days = daysBetween(fromISO, toISO);
  const periodDays = FREQUENCY_DAYS[target.frequency];
  return Math.round((target.amount * days) / periodDays) as Cents;
}

/** Envelope status threshold for sinking funds. */
function envelopeStatus(
  balance: Cents,
  expected: Cents,
  type: "income" | "expense",
): EnvelopeStatus {
  if (balance < 0) return "overspent";
  if (type === "income") {
    // For income envelopes (rare but supported), under-funding is a watch.
    if (expected > 0 && balance < expected * 0.5) return "watch";
    return "healthy";
  }
  // For expense envelopes, balance significantly below expected = burning faster than funding.
  if (expected > 0 && balance < expected * 0.25) return "watch";
  return "healthy";
}

/** Period-mode status uses the actual/target ratio, mirroring the old progressColor. */
function periodStatus(
  periodActual: Cents,
  periodTarget: Cents,
  type: "income" | "expense",
): EnvelopeStatus {
  if (type === "income") {
    // Income: under-receipt → watch (or overspent in extreme cases is irrelevant)
    if (periodTarget <= 0) return "healthy";
    const ratio = periodActual / periodTarget;
    if (ratio >= 1) return "healthy";
    if (ratio >= 0.75) return "watch";
    return "overspent"; // significantly under-received
  }
  // Expense:
  if (periodTarget <= 0) return periodActual > 0 ? "overspent" : "healthy";
  const ratio = periodActual / periodTarget;
  if (ratio > 1) return "overspent";
  if (ratio >= 0.75) return "watch";
  return "healthy";
}

// ── Main compute ─────────────────────────────────────────────────────────────

export interface ComputeInput {
  budget: Budget;
  transactions: Transaction[];
  categories: Category[];
  nowISO: string;
  viewRange: DateRange;
  viewPeriod: BudgetPeriod;
}

/**
 * Compute envelope + period figures for every targeted category in the budget,
 * plus uncategorised totals. Pure function — safe to call from a worker.
 */
export function computeEnvelopeStates(input: ComputeInput): EnvelopeBundle {
  const { budget, transactions, categories, nowISO, viewRange, viewPeriod } = input;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const targetMap = new Map(budget.targets.map((t) => [t.categoryId, t]));

  // ── 1. Sum actuals in current view period (per category) ──────────────────
  const periodReceived = new Map<string, number>();
  const periodSpent = new Map<string, number>();
  for (const t of transactions) {
    if (t.date < viewRange.from || t.date > viewRange.to) continue;
    const bucket = t.categoryId ?? UNCATEGORISED_ID;
    if (t.type === "credit") {
      periodReceived.set(bucket, (periodReceived.get(bucket) ?? 0) + t.amount);
    } else if (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")) {
      periodSpent.set(bucket, (periodSpent.get(bucket) ?? 0) + Math.abs(signedAmount(t)));
    }
  }

  // ── 2. Sum cumulative actuals from each target's openedAt → now ───────────
  // Per-target buckets because openedAt varies. Keyed by categoryId.
  const cumulativeReceived = new Map<string, Map<string, number>>(); // categoryId → bucket map
  const cumulativeSpent = new Map<string, Map<string, number>>();
  // Envelope-cover transfer-ins tracked separately so they only offset expense spend.
  const cumulativeCovers = new Map<string, Map<string, number>>();

  for (const target of budget.targets) {
    const from = target.openedAt;
    if (from > nowISO) continue; // future-dated envelope: zero cumulative
    const received = new Map<string, number>();
    const spent = new Map<string, number>();
    const covers = new Map<string, number>();
    for (const t of transactions) {
      if (t.date < from || t.date > nowISO) continue;
      if (!t.categoryId) continue;
      if (t.type === "transfer" && t.transferDirection === "in") {
        covers.set(t.categoryId, (covers.get(t.categoryId) ?? 0) + t.amount);
      } else if (t.type === "credit") {
        received.set(t.categoryId, (received.get(t.categoryId) ?? 0) + t.amount);
      } else if (t.type === "debit" || (t.type === "transfer" && t.transferDirection === "out")) {
        spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + Math.abs(signedAmount(t)));
      }
    }
    cumulativeReceived.set(target.categoryId, received);
    cumulativeSpent.set(target.categoryId, spent);
    cumulativeCovers.set(target.categoryId, covers);
  }

  // ── 3. Build EnvelopeState rows for each targeted category ────────────────
  const income: EnvelopeState[] = [];
  const expense: EnvelopeState[] = [];

  for (const target of budget.targets) {
    const cat = catMap.get(target.categoryId);
    if (!cat || cat.type === "transfer") continue;

    const isIncome = cat.type === "income";

    // Period figures
    const periodRaw = isIncome ? periodReceived : periodSpent;
    const periodActual = (
      cat.parentId !== undefined && targetMap.has(target.categoryId)
        ? getDescendantSum(target.categoryId, catMap, periodRaw)
        : (periodRaw.get(target.categoryId) ?? 0)
    ) as Cents;
    const periodTarget = normaliseToPeriod(target.amount, target.frequency, viewPeriod);
    const periodVariance = (periodTarget - periodActual) as Cents;

    // Envelope figures
    const cumReceivedRaw = cumulativeReceived.get(target.categoryId) ?? new Map();
    const cumSpentRaw = cumulativeSpent.get(target.categoryId) ?? new Map();
    const cumCoversRaw = cumulativeCovers.get(target.categoryId) ?? new Map();
    // For income: spent = credits received. For expense: net debits after covers.
    const spent = isIncome
      ? (getDescendantSum(target.categoryId, catMap, cumReceivedRaw) as Cents)
      : ((getDescendantSum(target.categoryId, catMap, cumSpentRaw) -
          getDescendantSum(target.categoryId, catMap, cumCoversRaw)) as Cents);
    const fundedAtNow = fundedBetween(target, target.openedAt, nowISO);
    // Expected balance = funded so far (in a healthy envelope these track each other)
    const expectedBalance = fundedAtNow;
    const balance = (fundedAtNow - spent) as Cents;

    const status =
      target.mode === "envelope"
        ? envelopeStatus(balance, expectedBalance, cat.type)
        : periodStatus(periodActual, periodTarget, cat.type);

    const parentCat = cat.parentId ? catMap.get(cat.parentId) : undefined;

    const state: EnvelopeState = {
      categoryId: target.categoryId,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryType: cat.type,
      categorySystem: cat.system,
      parentCategoryId: cat.parentId ?? undefined,
      parentCategoryName: parentCat?.name,

      mode: target.mode,
      target,

      funded: fundedAtNow,
      spent,
      balance,
      expectedBalance,

      periodTarget,
      periodActual,
      periodVariance,

      status,
    };

    if (isIncome) income.push(state);
    else expense.push(state);
  }

  // ── 4. Sort: envelopes first (need attention), then period rows, then by status ──
  const sortRows = (rows: EnvelopeState[]) =>
    rows.sort((a, b) => {
      // overspent first, then watch, then healthy
      const order: Record<EnvelopeStatus, number> = { overspent: 0, watch: 1, healthy: 2 };
      const s = order[a.status] - order[b.status];
      if (s !== 0) return s;
      // envelope mode before period mode (envelopes are the differentiator)
      if (a.mode !== b.mode) return a.mode === "envelope" ? -1 : 1;
      return b.periodActual - a.periodActual;
    });

  sortRows(income);
  sortRows(expense);

  // ── 5. Uncategorised in current period ────────────────────────────────────
  const uncategorisedExpense = (periodSpent.get(UNCATEGORISED_ID) ?? 0) as Cents;
  const uncategorisedIncome = (periodReceived.get(UNCATEGORISED_ID) ?? 0) as Cents;

  // ── 6. Totals ─────────────────────────────────────────────────────────────
  const all = [...income, ...expense];
  const totals = {
    funded: all.reduce((s, r) => s + r.funded, 0) as Cents,
    spent: all.reduce((s, r) => s + r.spent, 0) as Cents,
    balance: all.reduce((s, r) => s + r.balance, 0) as Cents,
    periodTargetIncome: income.reduce((s, r) => s + r.periodTarget, 0) as Cents,
    periodActualIncome: income.reduce((s, r) => s + r.periodActual, 0) as Cents,
    periodTargetExpense: expense.reduce((s, r) => s + r.periodTarget, 0) as Cents,
    periodActualExpense: expense.reduce((s, r) => s + r.periodActual, 0) as Cents,
  };

  return { income, expense, uncategorisedIncome, uncategorisedExpense, totals };
}

// ── Period-mode progress color helper (kept for UI use) ──────────────────────

export function progressColor(actual: Cents, projected: Cents): EnvelopeStatus {
  if (projected <= 0) return actual > 0 ? "overspent" : "healthy";
  const ratio = actual / projected;
  if (ratio > 1) return "overspent";
  if (ratio >= 0.75) return "watch";
  return "healthy";
}

// re-export hasTargetAncestor for use in planner (subcategory roll-up suppression)
export { hasTargetAncestor };
