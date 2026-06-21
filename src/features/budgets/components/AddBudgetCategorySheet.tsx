"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackendAvailableCategories, useAddCategoryToBudget } from "../api/hooks";
import type { AvailableCategory } from "../api/types";

interface Props {
  budgetId: string;
  open: boolean;
  onClose: () => void;
}

export function AddBudgetCategorySheet({ budgetId, open, onClose }: Props) {
  const { data: categories, isPending } = useBackendAvailableCategories(open ? budgetId : null);
  const addMutation = useAddCategoryToBudget(budgetId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = categories ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  async function handleSelect(category: AvailableCategory) {
    await addMutation.mutateAsync(category.id);
    setQuery("");
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add category to budget</SheetTitle>
          <SheetDescription>
            Pick a category to plan for before spending, or wait for transactions to add categories
            automatically.
          </SheetDescription>
        </SheetHeader>

        <Input
          placeholder="Search categories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2"
        />

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <div className="space-y-2">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : filtered.length ? (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    disabled={addMutation.isPending}
                    onClick={() => handleSelect(category)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
                  >
                    <span className="truncate font-medium">{category.name}</span>
                    <span className="ml-2 shrink-0 text-xs capitalize text-muted-foreground">
                      {category.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {categories?.length === 0 ? (
                <>
                  <p>All your categories are already on this budget.</p>
                  <Link
                    href="/categories"
                    className="mt-2 inline-block font-medium text-violet-400 hover:underline"
                  >
                    Create a new category
                  </Link>
                </>
              ) : (
                <p>No categories match your search.</p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-4 sm:justify-start">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
