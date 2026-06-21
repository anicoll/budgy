"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/features/accounts/hooks";
import {
  useBackendAccounts,
  useBackendBudgets,
  useBackendBudgetSummary,
  useBackendCategories,
  useSelectedBudgetId,
} from "@/features/budgets/api/hooks";
import { currentPeriodRange, formatPeriodLabel } from "@/features/budgets/utils/period";
import { BudgetSummaryHero } from "@/features/budgets/components/BudgetSummaryHero";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { useOnlineQueryEnabled } from "@/lib/query/use-online-query-enabled";
import {
  computeCategorySpend,
  computeMonthlyCashflow,
  computeNetWorthHistory,
  computePeriodKpis,
  computeSpendingInsights,
} from "../selectors";
import { AccountStrip } from "./AccountStrip";
import { CashflowChart } from "./CashflowChart";
import { CategorySpendDonut } from "./CategorySpendDonut";
import { InsightsCard } from "./InsightsCard";
import { KpiCards } from "./KpiCards";
import { NetWorthChart } from "./NetWorthChart";
import { RecentTransactions } from "./RecentTransactions";

export function DashboardPageClient() {
  const online = useOnlineQueryEnabled();
  const { data: budgets = [] } = useBackendBudgets();
  const { selectedId } = useSelectedBudgetId(budgets);
  const activeBudget = useMemo(
    () => budgets.find((b) => b.id === selectedId) ?? budgets[0] ?? null,
    [budgets, selectedId],
  );

  const periodLabel = useMemo(() => {
    if (!activeBudget) return "This month";
    const range = currentPeriodRange(activeBudget.period, activeBudget.startDate);
    return `This ${formatPeriodLabel(range, activeBudget.period).toLowerCase()}`;
  }, [activeBudget]);

  const range = useMemo(() => {
    if (!activeBudget) {
      const to = new Date();
      const from = new Date(to);
      from.setDate(1);
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      };
    }
    return currentPeriodRange(activeBudget.period, activeBudget.startDate);
  }, [activeBudget]);

  const historyRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setFullYear(from.getFullYear() - 1);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, []);

  const { data: accounts = [], isPending: accsLoading } = useAccounts();
  const { data: allTxns = [], isPending: txnsLoading } = useTransactions({ range: historyRange });
  const { data: categories = [], isPending: catsLoading } = useCategories();

  const { data: budgetCategories } = useBackendCategories(activeBudget?.id ?? null);
  const { data: budgetAccounts = [] } = useBackendAccounts(activeBudget?.id ?? null);
  const budgetAccountIds = useMemo(() => budgetAccounts.map((a) => a.id), [budgetAccounts]);
  const budgetSummary = useBackendBudgetSummary(
    activeBudget,
    budgetCategories,
    activeBudget?.period ?? "monthly",
    allTxns,
    budgetAccountIds,
    range,
  );

  const isLoading = accsLoading || txnsLoading || catsLoading;

  const kpis = useMemo(
    () => computePeriodKpis(accounts, allTxns, range),
    [accounts, allTxns, range],
  );

  const netWorthHistory = useMemo(
    () => computeNetWorthHistory(accounts, allTxns, 12),
    [accounts, allTxns],
  );

  const cashflow = useMemo(() => computeMonthlyCashflow(allTxns, 6), [allTxns]);

  const categorySpend = useMemo(
    () => computeCategorySpend(allTxns, categories, range, 6),
    [allTxns, categories, range],
  );

  const recentTxns = useMemo(
    () => [...allTxns].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 8),
    [allTxns],
  );

  const insights = useMemo(
    () => computeSpendingInsights(allTxns, categories, range),
    [allTxns, categories, range],
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      <KpiCards kpis={kpis} />

      {accounts.length > 0 && <AccountStrip accounts={accounts} transactions={allTxns} />}

      {online && budgetSummary ? (
        <BudgetSummaryHero summary={budgetSummary} periodLabel={periodLabel} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <NetWorthChart data={netWorthHistory} />
        <CashflowChart data={cashflow} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CategorySpendDonut data={categorySpend} periodLabel={periodLabel} />
        <InsightsCard insights={insights} periodLabel={periodLabel} />
      </div>

      <RecentTransactions transactions={recentTxns} accounts={accounts} categories={categories} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {["a", "b", "c"].map((k) => (
          <Skeleton key={k} className="h-28 min-w-[160px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
