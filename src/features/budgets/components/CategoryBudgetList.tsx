"use client";

import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/features/transactions/types";
import type { DateRange } from "@/lib/date/periods";
import type { BackendCategory, ViewCadence } from "../api/types";
import { CategoryBudgetRow } from "./CategoryBudgetRow";

interface Props {
  budgetId: string;
  categories: BackendCategory[] | undefined;
  isPending: boolean;
  viewCadence: ViewCadence;
  periodRange: DateRange;
  transactions: Transaction[];
  accountIds: string[];
  onAssign: (category: BackendCategory) => void;
  onCover: (category: BackendCategory) => void;
}

function CategorySection({
  title,
  categories,
  viewCadence,
  periodRange,
  transactions,
  accountIds,
  onAssign,
  onCover,
  actualHeader,
}: {
  title: string;
  categories: BackendCategory[];
  viewCadence: ViewCadence;
  periodRange: DateRange;
  transactions: Transaction[];
  accountIds: string[];
  onAssign: (category: BackendCategory) => void;
  onCover: (category: BackendCategory) => void;
  actualHeader: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
        <span>Category</span>
        <span className="text-right">Target</span>
        <span className="text-right">{actualHeader}</span>
        <span className="text-right">Left / Over</span>
      </div>
      {categories.map((category) => (
        <CategoryBudgetRow
          key={category.id}
          category={category}
          viewCadence={viewCadence}
          periodRange={periodRange}
          transactions={transactions}
          accountIds={accountIds}
          onAssign={() => onAssign(category)}
          onCover={() => onCover(category)}
        />
      ))}
    </div>
  );
}

export function CategoryBudgetList({
  categories,
  isPending,
  viewCadence,
  periodRange,
  transactions,
  accountIds,
  onAssign,
  onCover,
}: Props) {
  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3 p-0 pb-2">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="mx-4 h-12 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!categories?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No categories yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add income and expense categories to set targets, or let transactions on linked
              accounts create them automatically.
            </p>
          </div>
          <Link href="/categories" className="text-sm font-medium text-violet-400 hover:underline">
            Manage category taxonomy
          </Link>
        </CardContent>
      </Card>
    );
  }

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="sr-only">Categories</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <CategorySection
          title="Income"
          categories={incomeCategories}
          viewCadence={viewCadence}
          periodRange={periodRange}
          transactions={transactions}
          accountIds={accountIds}
          onAssign={onAssign}
          onCover={onCover}
          actualHeader="Received"
        />
        <CategorySection
          title="Expenses"
          categories={expenseCategories}
          viewCadence={viewCadence}
          periodRange={periodRange}
          transactions={transactions}
          accountIds={accountIds}
          onAssign={onAssign}
          onCover={onCover}
          actualHeader="Spent"
        />
      </CardContent>
    </Card>
  );
}
