import { isoDateAU } from "@/lib/date/au-locale";
import { ulid } from "@/lib/id/ulid";
import { cents } from "@/lib/money/cents";
import { getRepositories } from "@/lib/storage";
import type { BudgetFormValues } from "./schema";
import type { Budget } from "./types";

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

  // deactivate existing budgets with same period
  for (const b of all.filter((b) => b.period === values.period && b.active)) {
    await budgetsRepo().upsert({ ...b, active: false, updatedAt: now });
  }

  const budget: Budget = {
    id: ulid(),
    name: values.name,
    period: values.period,
    startDate: values.startDate,
    categoryAllocations: values.categoryAllocations.map((a) => ({
      categoryId: a.categoryId,
      amount: cents(a.amount),
      rollover: a.rollover,
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
    categoryAllocations: values.categoryAllocations.map((a) => ({
      categoryId: a.categoryId,
      amount: cents(a.amount),
      rollover: a.rollover,
    })),
    notes: values.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function deleteBudget(id: string): Promise<void> {
  return budgetsRepo().delete(id);
}

export async function upsertAllocation(
  budgetId: string,
  categoryId: string,
  amount: number,
  rollover: boolean,
): Promise<Budget> {
  const budget = await budgetsRepo().get(budgetId);
  if (!budget) throw new Error(`Budget ${budgetId} not found`);
  const existing = budget.categoryAllocations.filter((a) => a.categoryId !== categoryId);
  const updated: Budget = {
    ...budget,
    categoryAllocations: [...existing, { categoryId, amount: cents(amount), rollover }],
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function removeAllocation(budgetId: string, categoryId: string): Promise<Budget> {
  const budget = await budgetsRepo().get(budgetId);
  if (!budget) throw new Error(`Budget ${budgetId} not found`);
  const updated: Budget = {
    ...budget,
    categoryAllocations: budget.categoryAllocations.filter((a) => a.categoryId !== categoryId),
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export function defaultBudgetValues(): BudgetFormValues {
  return {
    name: "Monthly budget",
    period: "monthly",
    startDate: isoDateAU(),
    categoryAllocations: [],
    notes: "",
  };
}
