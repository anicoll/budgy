import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { BudgetMethod, BudgetPeriod } from "@/gen/budgy/v1/budget_pb";
import { BudgetFrequency, CategoryType as ProtoCategoryType } from "@/gen/budgy/v1/category_pb";
import { clearActiveBudgetIdCache } from "@/lib/api/api-repository";
import { accountClient, budgetClient } from "@/lib/api/connect-client";
import { cents } from "@/lib/money/cents";
import type {
  BackendAccount,
  BackendBudget,
  BackendBudgetFrequency,
  BackendBudgetPeriod,
  BackendCategory,
  AvailableCategory,
} from "./types";

function tsToISO(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  const ms = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1000000);
  return new Date(ms).toISOString();
}

function bigintToCents(value: bigint) {
  return cents(Number(value));
}

function mapPeriod(period: BudgetPeriod): BackendBudgetPeriod {
  switch (period) {
    case BudgetPeriod.WEEKLY:
      return "weekly";
    case BudgetPeriod.FORTNIGHTLY:
      return "fortnightly";
    default:
      return "monthly";
  }
}

function toProtoPeriod(period: BackendBudgetPeriod): BudgetPeriod {
  switch (period) {
    case "weekly":
      return BudgetPeriod.WEEKLY;
    case "fortnightly":
      return BudgetPeriod.FORTNIGHTLY;
    default:
      return BudgetPeriod.MONTHLY;
  }
}

function mapFrequency(freq: BudgetFrequency): BackendBudgetFrequency {
  switch (freq) {
    case BudgetFrequency.WEEKLY:
      return "weekly";
    case BudgetFrequency.FORTNIGHTLY:
      return "fortnightly";
    case BudgetFrequency.QUARTERLY:
      return "quarterly";
    case BudgetFrequency.YEARLY:
      return "yearly";
    default:
      return "monthly";
  }
}

function toProtoFrequency(freq: BackendBudgetFrequency): BudgetFrequency {
  switch (freq) {
    case "weekly":
      return BudgetFrequency.WEEKLY;
    case "fortnightly":
      return BudgetFrequency.FORTNIGHTLY;
    case "quarterly":
      return BudgetFrequency.QUARTERLY;
    case "yearly":
      return BudgetFrequency.YEARLY;
    default:
      return BudgetFrequency.MONTHLY;
  }
}

function mapBudget(b: {
  id: string;
  name: string;
  currency: string;
  period?: BudgetPeriod;
  startDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}): BackendBudget {
  return {
    id: b.id,
    name: b.name,
    currency: b.currency,
    period: mapPeriod(b.period ?? BudgetPeriod.MONTHLY),
    startDate: b.startDate || new Date().toISOString().slice(0, 10),
    createdAt: tsToISO(b.createdAt),
    updatedAt: tsToISO(b.updatedAt),
  };
}

function mapAvailableCategory(c: {
  id: string;
  name: string;
  type: ProtoCategoryType;
}): AvailableCategory {
  return {
    id: c.id,
    name: c.name,
    type:
      c.type === ProtoCategoryType.INCOME
        ? "income"
        : c.type === ProtoCategoryType.TRANSFER
          ? "transfer"
          : "expense",
  };
}

function mapBudgetCategory(bc: {
  category?: {
    id: string;
    name: string;
    type: ProtoCategoryType;
    parentId: string;
    system: boolean;
  };
  budgeted: bigint;
  balance: bigint;
  targetLimit: bigint;
  budgetedFrequency?: BudgetFrequency;
}): BackendCategory {
  const c = bc.category;
  if (!c) throw new Error("Missing category in budget line");
  return {
    id: c.id,
    name: c.name,
    type:
      c.type === ProtoCategoryType.INCOME
        ? "income"
        : c.type === ProtoCategoryType.TRANSFER
          ? "transfer"
          : "expense",
    parentId: c.parentId || null,
    system: c.system,
    budgeted: bigintToCents(bc.budgeted),
    balance: bigintToCents(bc.balance),
    targetLimit: bigintToCents(bc.targetLimit),
    budgetedFrequency: mapFrequency(bc.budgetedFrequency ?? BudgetFrequency.MONTHLY),
  };
}

function mapAccount(a: { id: string; name: string; balance: bigint }): BackendAccount {
  const cleanName = a.name.split(" ||")[0];
  return {
    id: a.id,
    name: cleanName,
    balance: bigintToCents(a.balance),
  };
}

export async function fetchBudgets(): Promise<BackendBudget[]> {
  const res = await budgetClient.listBudgets({});
  return (res.budgets ?? []).map(mapBudget);
}

export async function createBudget(input: {
  name: string;
  currency: string;
  period: BackendBudgetPeriod;
  startDate: string;
}): Promise<BackendBudget> {
  const res = await budgetClient.createBudget({
    name: input.name,
    method: BudgetMethod.ZERO_SUM,
    currency: input.currency,
    period: toProtoPeriod(input.period),
    startDate: input.startDate,
  });
  if (!res.budget) throw new Error("Failed to create budget");
  return mapBudget(res.budget);
}

export async function updateBudget(
  budgetId: string,
  input: {
    name: string;
    currency: string;
    period: BackendBudgetPeriod;
    startDate: string;
  },
): Promise<BackendBudget> {
  const res = await budgetClient.updateBudget({
    budgetId,
    name: input.name,
    method: BudgetMethod.ZERO_SUM,
    currency: input.currency,
    period: toProtoPeriod(input.period),
    startDate: input.startDate,
  });
  if (!res.budget) throw new Error("Failed to update budget");
  return mapBudget(res.budget);
}

export async function deleteBudget(budgetId: string): Promise<void> {
  await budgetClient.deleteBudget({ budgetId });
  clearActiveBudgetIdCache();
}

export async function fetchCategories(budgetId: string): Promise<BackendCategory[]> {
  const res = await budgetClient.listBudgetCategories({ budgetId });
  return (res.categories ?? []).map(mapBudgetCategory);
}

export async function fetchAvailableCategories(budgetId: string): Promise<AvailableCategory[]> {
  const res = await budgetClient.listAvailableCategories({ budgetId });
  return (res.categories ?? []).map(mapAvailableCategory);
}

export async function addCategoryToBudget(
  budgetId: string,
  categoryId: string,
): Promise<BackendCategory> {
  const res = await budgetClient.addCategoryToBudget({ budgetId, categoryId });
  if (!res.category) throw new Error("Failed to add category to budget");
  return mapBudgetCategory(res.category);
}

export async function fetchAccounts(budgetId: string): Promise<BackendAccount[]> {
  const res = await accountClient.listBudgetAccounts({ budgetId });
  return (res.accounts ?? []).map(mapAccount);
}

export async function assignCategoryFunds(
  budgetId: string,
  categoryId: string,
  amountCents: number,
  frequency: BackendBudgetFrequency,
  replaceTarget = false,
): Promise<BackendCategory> {
  const res = await budgetClient.assignCategoryFunds({
    budgetId,
    categoryId,
    amount: BigInt(amountCents),
    budgetedFrequency: toProtoFrequency(frequency),
    replaceTarget,
  });
  if (!res.category) throw new Error("Failed to assign funds");
  return mapBudgetCategory(res.category);
}

export { linkAccountToBudget, unlinkAccountFromBudget } from "@/features/accounts/api/client";
