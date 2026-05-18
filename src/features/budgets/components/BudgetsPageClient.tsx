"use client";

import { Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { SetupWizard } from "./SetupWizard";

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
        <SetupWizard onCreated={() => undefined} />
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
