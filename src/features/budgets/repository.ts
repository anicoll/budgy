import type { Transaction } from "@/features/transactions/types";
import { isoDateAU } from "@/lib/date/au-locale";
import { ulid } from "@/lib/id/ulid";
import { type Cents, cents } from "@/lib/money/cents";
import { getRepositories } from "@/lib/storage";
import type { BudgetFormValues } from "./schema";
import type { Budget, BudgetFrequency, BudgetMode, CategoryTarget } from "./types";
import { defaultModeFor } from "./utils/envelope";

export function budgetsRepo() {
  return getRepositories().budgets;
}

export async function listBudgets(): Promise<Budget[]> {
  return budgetsRepo().list();
}

export async function getActiveBudget(): Promise<Budget | null> {
  const all = await budgetsRepo().list();
  return all.find((b) => b.active) ?? all[0] ?? null;
}

export async function createBudget(values: BudgetFormValues): Promise<Budget> {
  const now = new Date().toISOString();
  const all = await budgetsRepo().list();

  for (const b of all.filter((b) => b.period === values.period && b.active)) {
    await budgetsRepo().upsert({ ...b, active: false, updatedAt: now });
  }

  const budget: Budget = {
    id: ulid(),
    name: values.name,
    period: values.period,
    startDate: values.startDate,
    targets: values.targets.map((t) => ({
      categoryId: t.categoryId,
      amount: cents(t.amount),
      frequency: t.frequency,
      mode: t.mode ?? defaultModeFor(t.frequency),
      openedAt: t.openedAt ?? values.startDate,
    })),
    notes: values.notes?.trim() || undefined,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  return budgetsRepo().upsert(budget);
}

export async function updateBudget(id: string, values: BudgetFormValues): Promise<Budget> {
  const current = await budgetsRepo().get(id);
  if (!current) throw new Error(`Budget ${id} not found`);
  const updated: Budget = {
    ...current,
    name: values.name,
    period: values.period,
    startDate: values.startDate,
    targets: values.targets.map((t) => ({
      categoryId: t.categoryId,
      amount: cents(t.amount),
      frequency: t.frequency,
      mode: t.mode ?? defaultModeFor(t.frequency),
      openedAt: t.openedAt ?? values.startDate,
    })),
    notes: values.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function deleteBudget(id: string): Promise<void> {
  return budgetsRepo().delete(id);
}

export async function setBudgetViewPeriod(id: string, period: Budget["period"]): Promise<void> {
  const budget = await budgetsRepo().get(id);
  if (!budget) return;
  await budgetsRepo().upsert({ ...budget, period, updatedAt: new Date().toISOString() });
}

export interface SetTargetInput {
  budgetId: string;
  categoryId: string;
  amount: number;
  frequency: BudgetFrequency;
  mode?: BudgetMode;
  openedAt?: string;
}

export async function setTarget(input: SetTargetInput): Promise<Budget> {
  const budget = await budgetsRepo().get(input.budgetId);
  if (!budget) throw new Error(`Budget ${input.budgetId} not found`);
  const existing = budget.targets.find((t) => t.categoryId === input.categoryId);
  const mode = input.mode ?? existing?.mode ?? defaultModeFor(input.frequency);
  const openedAt = input.openedAt ?? existing?.openedAt ?? budget.startDate;

  const next: CategoryTarget = {
    categoryId: input.categoryId,
    amount: cents(input.amount),
    frequency: input.frequency,
    mode,
    openedAt,
  };
  const rest = budget.targets.filter((t) => t.categoryId !== input.categoryId);
  const updated: Budget = {
    ...budget,
    targets: [...rest, next],
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function removeTarget(budgetId: string, categoryId: string): Promise<Budget> {
  const budget = await budgetsRepo().get(budgetId);
  if (!budget) throw new Error(`Budget ${budgetId} not found`);
  const updated: Budget = {
    ...budget,
    targets: budget.targets.filter((t) => t.categoryId !== categoryId),
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function ensureMissingTargets(
  budgetId: string,
  categoryIds: string[],
): Promise<Budget> {
  const budget = await budgetsRepo().get(budgetId);
  if (!budget) throw new Error(`Budget ${budgetId} not found`);

  const existingIds = new Set(budget.targets.map((t) => t.categoryId));
  const seen = new Set<string>();
  const missing = categoryIds
    .filter((id) => !!id)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return !existingIds.has(id);
    });

  if (missing.length === 0) return budget;

  const frequency = budget.period as BudgetFrequency;
  const updated: Budget = {
    ...budget,
    targets: [
      ...budget.targets,
      ...missing.map((categoryId) => ({
        categoryId,
        amount: cents(0),
        frequency,
        mode: defaultModeFor(frequency),
        openedAt: budget.startDate,
      })),
    ],
    updatedAt: new Date().toISOString(),
  };

  return budgetsRepo().upsert(updated);
}

export interface CoverOverspendingInput {
  budgetId: string;
  fromCategoryId: string;
  toCategoryId: string;
  amount: Cents;
  dateISO: string;
}

/** Moves `amount` from one envelope to another via a synthetic transfer pair. */
export async function coverOverspending({
  budgetId,
  fromCategoryId,
  toCategoryId,
  amount,
  dateISO,
}: CoverOverspendingInput): Promise<void> {
  if (amount <= 0) throw new Error("Amount must be positive");

  const budget = await budgetsRepo().get(budgetId);
  if (!budget) throw new Error(`Budget ${budgetId} not found`);

  const fromTarget = budget.targets.find((t) => t.categoryId === fromCategoryId);
  const toTarget = budget.targets.find((t) => t.categoryId === toCategoryId);
  if (!fromTarget) throw new Error(`Category ${fromCategoryId} not found in budget`);
  if (!toTarget) throw new Error(`Category ${toCategoryId} not found in budget`);

  const repo = getRepositories();
  const fromCat = await repo.categories.get(fromCategoryId);
  const toCat = await repo.categories.get(toCategoryId);
  const fromName = fromCat?.name ?? fromCategoryId;
  const toName = toCat?.name ?? toCategoryId;

  const transferGroupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceId = ulid();
  const destId = ulid();

  const source: Transaction = {
    id: sourceId,
    accountId: "__budget__",
    date: dateISO,
    amount,
    type: "transfer",
    transferDirection: "out",
    categoryId: fromCategoryId,
    payee: "Envelope cover",
    description: `Cover from ${fromName} to ${toName}`,
    tags: [],
    transferPairId: destId,
    transferGroupId,
    cleared: true,
    createdAt: now,
    updatedAt: now,
  };

  const dest: Transaction = {
    id: destId,
    accountId: "__budget__",
    date: dateISO,
    amount,
    type: "transfer",
    transferDirection: "in",
    categoryId: toCategoryId,
    payee: "Envelope cover",
    description: `Cover from ${fromName} to ${toName}`,
    tags: [],
    transferPairId: sourceId,
    transferGroupId,
    cleared: true,
    createdAt: now,
    updatedAt: now,
  };

  await repo.transactions.bulkUpsert([source, dest]);
}

export function defaultBudgetValues(): BudgetFormValues {
  return {
    name: "Monthly budget",
    period: "monthly",
    startDate: isoDateAU(),
    targets: [],
    notes: "",
  };
}
