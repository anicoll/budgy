"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { rangeForPeriod } from "@/lib/date/periods";
import { usePrefs } from "@/lib/state/prefs-store";
import { useUIStore } from "@/lib/state/ui-store";
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

const PERIOD_LABEL: Record<string, string> = {
  week: "This week",
  fortnight: "This fortnight",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  custom: "Custom",
};

export function DashboardPageClient() {
  const period = useUIStore((s) => s.period);
  const { fortnightAnchor } = usePrefs();

  const range = useMemo(
    () => rangeForPeriod(period, new Date(), { fortnightAnchor }),
    [period, fortnightAnchor],
  );

  // Fetch a 12-month look-back window to cover KPIs, cashflow history and net worth trend.
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <NetWorthChart data={netWorthHistory} />
        <CashflowChart data={cashflow} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CategorySpendDonut data={categorySpend} periodLabel={PERIOD_LABEL[period] ?? period} />
        <RecentTransactions transactions={recentTxns} accounts={accounts} categories={categories} />
      </div>

      <InsightsCard insights={insights} periodLabel={PERIOD_LABEL[period] ?? period} />
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
