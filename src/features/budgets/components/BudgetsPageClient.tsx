"use client";

import { PiggyBank, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAssignCategoryFunds,
  useBackendAccounts,
  useBackendBudgetSummary,
  useBackendBudgets,
  useBackendCategories,
  useCreateBackendBudget,
  useDeleteBackendBudget,
  useFundEnvelope,
  useSelectedBudgetId,
  useUpdateBackendBudget,
} from "../api/hooks";
import type { BackendBudgetFormValues } from "../api/schema";
import type { BackendBudget, BackendCategory } from "../api/types";
import { AssignFundsDialog } from "./AssignFundsDialog";
import { BudgetPageHeader } from "./BudgetPageHeader";
import { BudgetSummaryHero } from "./BudgetSummaryHero";
import { CategoryBudgetList } from "./CategoryBudgetList";
import { CreateBudgetSheet } from "./CreateBudgetSheet";
import { FundEnvelopeDialog } from "./FundEnvelopeDialog";

export function BudgetsPageClient() {
  const { data: budgets = [], isPending: budgetsPending } = useBackendBudgets();
  const { selectedId, selectBudget } = useSelectedBudgetId(budgets);

  const selectedBudget = useMemo(
    () => budgets.find((b) => b.id === selectedId) ?? null,
    [budgets, selectedId],
  );

  const { data: categories, isPending: categoriesPending } = useBackendCategories(
    selectedBudget?.id ?? null,
  );
  const { data: accounts = [] } = useBackendAccounts(selectedBudget?.id ?? null);
  const summary = useBackendBudgetSummary(selectedBudget, categories, accounts);

  const createMutation = useCreateBackendBudget();
  const updateMutation = useUpdateBackendBudget();
  const deleteMutation = useDeleteBackendBudget();
  const assignMutation = useAssignCategoryFunds(selectedBudget?.id ?? null);
  const fundMutation = useFundEnvelope(selectedBudget?.id ?? null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BackendBudget | null>(null);
  const [assignCategory, setAssignCategory] = useState<BackendCategory | null>(null);
  const [fundCategory, setFundCategory] = useState<BackendCategory | null>(null);

  async function handleBudgetSubmit(values: BackendBudgetFormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ budgetId: editing.id, ...values });
      if (values.method !== editing.method) {
        selectBudget(editing.id);
      }
    } else {
      const created = await createMutation.mutateAsync(values);
      selectBudget(created.id);
    }
    setEditing(null);
  }

  if (budgetsPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!selectedBudget) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyBudgetsState onCreate={() => setSheetOpen(true)} />
        <CreateBudgetSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSubmit={handleBudgetSubmit}
          submitting={createMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BudgetPageHeader
        budgets={budgets}
        selected={selectedBudget}
        onSelect={selectBudget}
        onCreate={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        onEdit={() => {
          setEditing(selectedBudget);
          setSheetOpen(true);
        }}
        onDelete={() => {
          if (confirm(`Delete "${selectedBudget.name}"?`)) {
            deleteMutation.mutate(selectedBudget.id);
          }
        }}
      />

      {summary ? <BudgetSummaryHero summary={summary} /> : null}

      <CategoryBudgetList
        budgetId={selectedBudget.id}
        method={selectedBudget.method}
        categories={categories}
        isPending={categoriesPending}
        onAssign={setAssignCategory}
        onFund={setFundCategory}
      />

      <CreateBudgetSheet
        open={sheetOpen}
        editing={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSubmit={handleBudgetSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <AssignFundsDialog
        open={!!assignCategory}
        category={assignCategory}
        onClose={() => setAssignCategory(null)}
        submitting={assignMutation.isPending}
        onSubmit={async (amountCents) => {
          if (!assignCategory) return;
          await assignMutation.mutateAsync({ categoryId: assignCategory.id, amountCents });
          setAssignCategory(null);
        }}
      />

      <FundEnvelopeDialog
        open={!!fundCategory}
        category={fundCategory}
        accounts={accounts}
        onClose={() => setFundCategory(null)}
        submitting={fundMutation.isPending}
        onSubmit={async (accountId, amountCents) => {
          if (!fundCategory) return;
          await fundMutation.mutateAsync({
            categoryId: fundCategory.id,
            accountId,
            amountCents,
          });
          setFundCategory(null);
        }}
      />
    </div>
  );
}

function EmptyBudgetsState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-surface/60 to-cyan-500/5">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <PiggyBank className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Create your first budget</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Budgets live on the server and sync with your accounts and categories.
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create budget
        </Button>
      </CardContent>
    </Card>
  );
}
