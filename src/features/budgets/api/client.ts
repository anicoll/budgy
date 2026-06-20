import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { BudgetMethod } from "@/gen/budgy/v1/budget_pb";
import { CategoryType as ProtoCategoryType } from "@/gen/budgy/v1/category_pb";
import { clearActiveBudgetIdCache } from "@/lib/api/api-repository";
import { accountClient, budgetClient } from "@/lib/api/connect-client";
import { cents } from "@/lib/money/cents";
import type { BackendAccount, BackendBudget, BackendBudgetMethod, BackendCategory } from "./types";

function tsToISO(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  const ms = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1000000);
  return new Date(ms).toISOString();
}

function bigintToCents(value: bigint) {
  return cents(Number(value));
}

function mapMethod(method: BudgetMethod): BackendBudgetMethod {
  return method === BudgetMethod.ENVELOPE ? "envelope" : "zero_sum";
}

function toBackendBudgetMethod(method: BackendBudgetMethod): BudgetMethod {
  return method === "envelope" ? BudgetMethod.ENVELOPE : BudgetMethod.ZERO_SUM;
}

function mapBudget(b: {
  id: string;
  name: string;
  method: BudgetMethod;
  currency: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}): BackendBudget {
  return {
    id: b.id,
    name: b.name,
    method: mapMethod(b.method),
    currency: b.currency,
    createdAt: tsToISO(b.createdAt),
    updatedAt: tsToISO(b.updatedAt),
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
  method: BackendBudgetMethod;
  currency: string;
}): Promise<BackendBudget> {
  const res = await budgetClient.createBudget({
    name: input.name,
    method: toBackendBudgetMethod(input.method),
    currency: input.currency,
  });
  if (!res.budget) throw new Error("Failed to create budget");
  return mapBudget(res.budget);
}

export async function updateBudget(
  budgetId: string,
  input: { name: string; method: BackendBudgetMethod; currency: string },
): Promise<BackendBudget> {
  const res = await budgetClient.updateBudget({
    budgetId,
    name: input.name,
    method: toBackendBudgetMethod(input.method),
    currency: input.currency,
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

export async function fetchAccounts(budgetId: string): Promise<BackendAccount[]> {
  const res = await accountClient.listBudgetAccounts({ budgetId });
  return (res.accounts ?? []).map(mapAccount);
}

export async function assignCategoryFunds(
  budgetId: string,
  categoryId: string,
  amountCents: number,
): Promise<BackendCategory> {
  const res = await budgetClient.assignCategoryFunds({
    budgetId,
    categoryId,
    amount: BigInt(amountCents),
  });
  if (!res.category) throw new Error("Failed to assign funds");
  return mapBudgetCategory(res.category);
}

export async function fundEnvelope(
  budgetId: string,
  categoryId: string,
  accountId: string,
  amountCents: number,
): Promise<BackendCategory> {
  const res = await budgetClient.fundEnvelope({
    budgetId,
    categoryId,
    accountId,
    amount: BigInt(amountCents),
  });
  const envelope = res.result?.envelope;
  if (!envelope) throw new Error("Failed to fund envelope");
  return mapBudgetCategory(envelope);
}
