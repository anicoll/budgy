"use client";

import { PiggyBank, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { cents } from "@/lib/money/cents";
import {
  useAssignCategoryFunds,
  useBackendAccounts,
  useBackendBudgetSummary,
  useBackendBudgets,
  useBackendCategories,
  useBudgetViewCadence,
  useCreateBackendBudget,
  useDeleteBackendBudget,
  useSelectedBudgetId,
  useUpdateBackendBudget,
} from "../api/hooks";
import {
  computeCategoryPeriodView,
  sumTransactionsInRange,
  uncategorizedTransactionsInPeriod,
} from "../api/period-summary";
import type { BackendBudgetFormValues } from "../api/schema";
import type { BackendBudget, BackendCategory } from "../api/types";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "../utils/period";
import { AddBudgetCategorySheet } from "./AddBudgetCategorySheet";
import { AssignFundsDialog } from "./AssignFundsDialog";
import { BudgetAccountsPanel } from "./BudgetAccountsPanel";
import { BudgetPageHeader } from "./BudgetPageHeader";
import { BudgetPeriodNavigator } from "./BudgetPeriodNavigator";
import { BudgetSummaryHero } from "./BudgetSummaryHero";
import { CategoryBudgetList } from "./CategoryBudgetList";
import { CreateBudgetSheet } from "./CreateBudgetSheet";
import { UncategorizedInbox } from "./UncategorizedInbox";

export function BudgetsPageClient() {
  const { data: budgets = [], isPending: budgetsPending } = useBackendBudgets();
  const { selectedId, selectBudget } = useSelectedBudgetId(budgets);

  const selectedBudget = useMemo(
    () => budgets.find((b) => b.id === selectedId) ?? null,
    [budgets, selectedId],
  );

  const { viewCadence, setViewCadence, periodOffset, setPeriodOffset } = useBudgetViewCadence(
    selectedBudget?.period ?? "monthly",
  );

  const periodRange = useMemo(() => {
    if (!selectedBudget) return { from: "", to: "" };
    const base = currentPeriodRange(viewCadence, selectedBudget.startDate, new Date());
    if (periodOffset === 0) return base;
    return shiftBudgetPeriod(viewCadence, selectedBudget.startDate, base, periodOffset);
  }, [selectedBudget, viewCadence, periodOffset]);

  const periodLabel = useMemo(
    () => (periodRange.from ? formatPeriodLabel(periodRange, viewCadence) : ""),
    [periodRange, viewCadence],
  );

  const { data: categories, isPending: categoriesPending } = useBackendCategories(
    selectedBudget?.id ?? null,
  );
  const { data: taxonomyCategories = [] } = useCategories();
  const { data: accounts = [] } = useBackendAccounts(selectedBudget?.id ?? null);
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  const { data: transactions = [] } = useTransactions({
    range: periodRange.from ? periodRange : undefined,
  });

  const summary = useBackendBudgetSummary(
    selectedBudget,
    categories,
    accounts,
    viewCadence,
    transactions,
    accountIds,
    periodRange.from ? periodRange : undefined,
    taxonomyCategories,
  );

  const uncategorized = useMemo(() => {
    if (!periodRange.from) return [];
    return uncategorizedTransactionsInPeriod(transactions, accountIds, periodRange);
  }, [transactions, accountIds, periodRange]);

  const createMutation = useCreateBackendBudget();
  const updateMutation = useUpdateBackendBudget();
  const deleteMutation = useDeleteBackendBudget();
  const assignMutation = useAssignCategoryFunds(selectedBudget?.id ?? null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<BackendBudget | null>(null);
  const [assignCategory, setAssignCategory] = useState<BackendCategory | null>(null);
  const [coverCategory, setCoverCategory] = useState<BackendCategory | null>(null);

  const assignDialogCategory = assignCategory ?? coverCategory;
  const coverAmount = useMemo(() => {
    if (!coverCategory || !periodRange.from) return undefined;
    const actual = sumTransactionsInRange(
      transactions,
      new Set(accountIds),
      periodRange,
      coverCategory.id,
    );
    const view = computeCategoryPeriodView(coverCategory, viewCadence, actual);
    return view.overTarget ? cents(Math.abs(view.periodRemaining)) : undefined;
  }, [coverCategory, transactions, accountIds, periodRange, viewCadence]);

  async function handleBudgetSubmit(values: BackendBudgetFormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ budgetId: editing.id, ...values });
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

      <BudgetPeriodNavigator
        viewCadence={viewCadence}
        onViewCadenceChange={setViewCadence}
        periodRange={periodRange}
        periodOffset={periodOffset}
        onPeriodOffsetChange={setPeriodOffset}
      />

      {summary ? <BudgetSummaryHero summary={summary} periodLabel={periodLabel} /> : null}

      <BudgetAccountsPanel
        budgetId={selectedBudget.id}
        periodRange={periodRange}
        transactions={transactions}
      />

      <UncategorizedInbox
        transactions={uncategorized}
        categories={taxonomyCategories}
        allTransactions={transactions}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Categories</h2>
        <Button variant="outline" size="sm" onClick={() => setAddCategoryOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add category
        </Button>
      </div>

      <CategoryBudgetList
        budgetId={selectedBudget.id}
        categories={categories}
        isPending={categoriesPending}
        viewCadence={viewCadence}
        periodRange={periodRange}
        transactions={transactions}
        accountIds={accountIds}
        onAssign={setAssignCategory}
        onCover={setCoverCategory}
      />

      <AddBudgetCategorySheet
        budgetId={selectedBudget.id}
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
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
        open={!!assignDialogCategory}
        category={assignDialogCategory}
        mode={coverCategory ? "add" : "set"}
        defaultAmountCents={coverCategory ? coverAmount : assignCategory?.budgeted}
        defaultFrequency={assignDialogCategory?.budgetedFrequency}
        readyToAssign={summary?.pool.readyToAssign}
        onClose={() => {
          setAssignCategory(null);
          setCoverCategory(null);
        }}
        submitting={assignMutation.isPending}
        onSubmit={async (amountCents, frequency) => {
          if (!assignDialogCategory) return;
          await assignMutation.mutateAsync({
            categoryId: assignDialogCategory.id,
            amountCents,
            frequency,
            replaceTarget: !coverCategory,
          });
          setAssignCategory(null);
          setCoverCategory(null);
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
            Plan income and expenses for linked accounts — received vs spent each period.
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
