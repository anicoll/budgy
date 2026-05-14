"use client";

import { Plus, Settings2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveBudget, useCreateBudget, useDeleteBudget, useUpdateBudget } from "../hooks";
import type { BudgetFormValues } from "../schema";
import type { Budget } from "../types";
import { BudgetFormSheet } from "./BudgetFormSheet";
import { BudgetPlannerView } from "./BudgetPlannerView";

export function BudgetsPageClient() {
  const { data: budget, isPending } = useActiveBudget();
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  async function handleSubmit(values: BudgetFormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
    setSheetOpen(false);
    setEditing(null);
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {budget ? (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{budget.name}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Budget options">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(budget);
                    setSheetOpen(true);
                  }}
                >
                  Edit budget
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${budget.name}"?`)) {
                      deleteMutation.mutate(budget.id);
                    }
                  }}
                >
                  Delete budget
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div />
        )}
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          {budget ? "New budget" : "Create budget"}
        </Button>
      </div>

      {!budget ? (
        <NoBudgetEmpty onCreate={() => setSheetOpen(true)} />
      ) : (
        <BudgetPlannerView budget={budget} />
      )}

      <BudgetFormSheet
        open={sheetOpen}
        editing={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function NoBudgetEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="mx-auto max-w-md border-dashed border-border/70 bg-surface/40">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-accent text-primary-foreground shadow-md">
          <TrendingDown className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">No budget yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a budget and your transactions will automatically appear. Add targets to set
            spending and income goals — they normalise to any period you choose.
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          <Plus className="mr-1 h-4 w-4" /> Create budget
        </Button>
      </CardContent>
    </Card>
  );
}
