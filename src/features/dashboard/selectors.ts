import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { Account } from "@/features/accounts/types";
import { isLiability } from "@/features/accounts/types";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { Cents } from "@/lib/money/cents";

const ISO = (d: Date) => format(d, "yyyy-MM-dd");
const MON_LABEL = (d: Date) => format(d, "MMM");

// ── Net worth time-series ─────────────────────────────────────────────────

export interface MonthlyNetWorth {
  month: string;
  netWorth: Cents;
}

export function computeNetWorthHistory(
  accounts: Account[],
  transactions: Transaction[],
  months = 12,
): MonthlyNetWorth[] {
  const now = new Date();
  const result: MonthlyNetWorth[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const ref = subMonths(now, i);
    const cutoff = ISO(endOfMonth(ref));

    let netWorth = 0;
    for (const acc of accounts) {
      if (acc.archived) continue;
      let balance = acc.openingBalance as number;
      for (const t of transactions) {
        if (t.accountId === acc.id && t.date <= cutoff) {
          balance += signedAmount(t);
        }
      }
      if (isLiability(acc.type)) {
        netWorth -= balance;
      } else {
        netWorth += balance;
      }
    }

    result.push({ month: MON_LABEL(ref), netWorth: netWorth as Cents });
  }

  return result;
}

// ── Monthly cashflow ──────────────────────────────────────────────────────

export interface MonthlyCashflow {
  month: string;
  income: Cents;
  expense: Cents;
}

export function computeMonthlyCashflow(transactions: Transaction[], months = 6): MonthlyCashflow[] {
  const now = new Date();
  const result: MonthlyCashflow[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const ref = subMonths(now, i);
    const from = ISO(startOfMonth(ref));
    const to = ISO(endOfMonth(ref));
    const inRange = transactions.filter((t) => t.date >= from && t.date <= to);

    let income = 0;
    let expense = 0;
    for (const t of inRange) {
      if (t.type === "credit") income += t.amount;
      else if (t.type === "debit") expense += t.amount;
    }

    result.push({ month: MON_LABEL(ref), income: income as Cents, expense: expense as Cents });
  }

  return result;
}

// ── Period KPIs ───────────────────────────────────────────────────────────

export interface PeriodKpis {
  income: Cents;
  expense: Cents;
  savingsRate: number;
  netWorth: Cents;
}

export function computePeriodKpis(
  accounts: Account[],
  transactions: Transaction[],
  range: DateRange,
): PeriodKpis {
  const inRange = transactions.filter((t) => t.date >= range.from && t.date <= range.to);
  let income = 0;
  let expense = 0;
  for (const t of inRange) {
    if (t.type === "credit") income += t.amount;
    else if (t.type === "debit") expense += t.amount;
  }

  const savingsRate = income > 0 ? Math.max(0, (income - expense) / income) : 0;

  let netWorth = 0;
  for (const acc of accounts) {
    if (acc.archived) continue;
    if (isLiability(acc.type)) netWorth -= acc.currentBalance;
    else netWorth += acc.currentBalance;
  }

  return {
    income: income as Cents,
    expense: expense as Cents,
    savingsRate,
    netWorth: netWorth as Cents,
  };
}

// ── Category spend breakdown ──────────────────────────────────────────────

export interface CategorySpend {
  label: string;
  value: Cents;
  color: string;
}

export function computeCategorySpend(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
  topN = 6,
): CategorySpend[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const inRange = transactions.filter(
    (t) => t.date >= range.from && t.date <= range.to && t.type === "debit",
  );

  const spendByCategory = new Map<string, number>();
  let uncategorised = 0;

  for (const t of inRange) {
    if (t.categoryId) {
      spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) ?? 0) + t.amount);
    } else {
      uncategorised += t.amount;
    }
  }

  const sorted = [...spendByCategory.entries()]
    .map(([catId, amt]) => ({
      label: catMap.get(catId)?.name ?? "Unknown",
      value: amt as Cents,
      color: catMap.get(catId)?.color ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);

  const top = sorted.slice(0, topN);
  const otherCategories = sorted.slice(topN);
  const otherTotal = otherCategories.reduce((s, c) => s + c.value, 0) + uncategorised;

  if (otherTotal > 0) {
    top.push({ label: "Other", value: otherTotal as Cents, color: "#94a3b8" });
  }

  return top;
}

// ── Account sparklines ────────────────────────────────────────────────────

export function computeAccountSparkline(
  account: Account,
  transactions: Transaction[],
  days = 30,
): number[] {
  const now = new Date();
  const result: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const cutoff = ISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    let balance = account.openingBalance as number;
    for (const t of transactions) {
      if (t.accountId === account.id && t.date <= cutoff) {
        balance += signedAmount(t);
      }
    }
    result.push(balance);
  }

  return result;
}

// ── Spending insights ─────────────────────────────────────────────────────

export interface SpendingInsight {
  categoryId: string;
  label: string;
  color: string;
  currentSpend: Cents;
  priorSpend: Cents;
  changePct: number; // positive = up, negative = down
}

export function computeSpendingInsights(
  transactions: Transaction[],
  categories: Category[],
  currentRange: DateRange,
  topN = 3,
): SpendingInsight[] {
  const currentFrom = new Date(currentRange.from);
  const currentTo = new Date(currentRange.to);
  const periodDays = Math.round(
    (currentTo.getTime() - currentFrom.getTime()) / (1000 * 60 * 60 * 24),
  );
  const priorTo = new Date(currentFrom);
  priorTo.setDate(priorTo.getDate() - 1);
  const priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - periodDays);
  const priorRange: DateRange = {
    from: priorFrom.toISOString().slice(0, 10),
    to: priorTo.toISOString().slice(0, 10),
  };

  const catMap = new Map(categories.map((c) => [c.id, c]));

  function spendInRange(range: DateRange): Map<string, number> {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "debit" || !t.categoryId) continue;
      if (t.date < range.from || t.date > range.to) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    }
    return map;
  }

  const current = spendInRange(currentRange);
  const prior = spendInRange(priorRange);
  const allCatIds = new Set([...current.keys(), ...prior.keys()]);
  const insights: SpendingInsight[] = [];

  for (const catId of allCatIds) {
    const cat = catMap.get(catId);
    if (!cat || cat.type !== "expense") continue;
    const cur = current.get(catId) ?? 0;
    const prv = prior.get(catId) ?? 0;
    if (prv === 0 && cur === 0) continue;
    const changePct = prv > 0 ? ((cur - prv) / prv) * 100 : 100;
    if (Math.abs(changePct) < 10) continue;
    insights.push({
      categoryId: catId,
      label: cat.name,
      color: cat.color,
      currentSpend: cur as Cents,
      priorSpend: prv as Cents,
      changePct,
    });
  }

  return insights.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, topN);
}
