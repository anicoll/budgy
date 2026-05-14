import { isoDateAU } from "@/lib/date/au-locale";
import { ulid } from "@/lib/id/ulid";
import { cents } from "@/lib/money/cents";
import { getRepositories } from "@/lib/storage";
import type { BudgetFormValues } from "./schema";
import type { Budget, BudgetFrequency, CategoryTarget } from "./types";

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

/** Reads a raw budget from storage and normalises legacy `categoryAllocations` → `targets`. */
export async function getActiveBudgetNormalised(): Promise<Budget | null> {
  const budget = await getActiveBudget();
  if (!budget) return null;
  return normaliseLegacyBudget(budget);
}

export function normaliseLegacyBudget(budget: Budget): Budget {
  // Migrate old `categoryAllocations` field written before the redesign.
  const raw = budget as Budget & { categoryAllocations?: CategoryTarget[] };
  if (raw.categoryAllocations && !raw.targets?.length) {
    return {
      ...budget,
      targets: raw.categoryAllocations.map((a) => ({
        ...a,
        frequency: budget.period as BudgetFrequency,
      })),
    };
  }
  // Ensure all targets have a frequency (could be missing from old data)
  return {
    ...budget,
    targets: (budget.targets ?? []).map((t) => ({
      ...t,
      frequency: t.frequency ?? budget.period,
    })),
  };
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
      rollover: t.rollover,
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
      rollover: t.rollover,
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
  const raw = await budgetsRepo().get(id);
  if (!raw) return;
  await budgetsRepo().upsert({ ...raw, period, updatedAt: new Date().toISOString() });
}

export async function setTarget(
  budgetId: string,
  categoryId: string,
  amount: number,
  frequency: BudgetFrequency,
  rollover: boolean,
): Promise<Budget> {
  const raw = await budgetsRepo().get(budgetId);
  if (!raw) throw new Error(`Budget ${budgetId} not found`);
  const budget = normaliseLegacyBudget(raw);
  const rest = budget.targets.filter((t) => t.categoryId !== categoryId);
  const updated: Budget = {
    ...budget,
    targets: [...rest, { categoryId, amount: cents(amount), frequency, rollover }],
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
}

export async function removeTarget(budgetId: string, categoryId: string): Promise<Budget> {
  const raw = await budgetsRepo().get(budgetId);
  if (!raw) throw new Error(`Budget ${budgetId} not found`);
  const budget = normaliseLegacyBudget(raw);
  const updated: Budget = {
    ...budget,
    targets: budget.targets.filter((t) => t.categoryId !== categoryId),
    updatedAt: new Date().toISOString(),
  };
  return budgetsRepo().upsert(updated);
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
