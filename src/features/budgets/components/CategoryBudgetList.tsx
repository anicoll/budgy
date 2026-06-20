"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendBudgetMethod, BackendCategory } from "../api/types";
import { CategoryBudgetRow } from "./CategoryBudgetRow";

interface Props {
  budgetId: string;
  method: BackendBudgetMethod;
  categories: BackendCategory[] | undefined;
  isPending: boolean;
  onAssign: (category: BackendCategory) => void;
  onFund: (category: BackendCategory) => void;
}

export function CategoryBudgetList({
  budgetId,
  method,
  categories,
  isPending,
  onAssign,
  onFund,
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
              Add categories for this budget to start assigning or funding envelopes.
            </p>
          </div>
          <Link
            href={`/categories?budgetId=${budgetId}`}
            className="text-sm font-medium text-violet-400 hover:underline"
          >
            Go to categories
          </Link>
        </CardContent>
      </Card>
    );
  }

  const columnHeaders =
    method === "zero_sum" ? (
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
        <span>Category</span>
        <span className="text-right">Assigned</span>
        <span className="text-right">Available</span>
        <span />
      </div>
    ) : (
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem]">
        <span>Category</span>
        <span className="text-right">Target</span>
        <span className="text-right">Balance</span>
        <span />
      </div>
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Categories</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {columnHeaders}
        {categories.map((category) => (
          <CategoryBudgetRow
            key={category.id}
            category={category}
            method={method}
            onAssign={() => onAssign(category)}
            onFund={() => onFund(category)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
