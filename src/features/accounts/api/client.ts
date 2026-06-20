import { tsToISO } from "@/features/categories/api/client";
import { AccountType as ProtoAccountType } from "@/gen/budgy/v1/account_pb";
import { accountClient } from "@/lib/api/connect-client";
import { type Cents, cents } from "@/lib/money/cents";
import type { AccountFormValues } from "../schema";
import { ACCOUNT_DEFAULT_COLOR, type Account, type AccountType } from "../types";

function mapProtoType(type: ProtoAccountType, className: string): AccountType {
  const c = className.toLowerCase();
  if (c.includes("mortgage") || c.includes("loan") || c.includes("liability")) return "loan";
  if (c.includes("investment")) return "investment";
  if (c.includes("super")) return "super";
  switch (type) {
    case ProtoAccountType.SAVINGS:
      return "savings";
    case ProtoAccountType.CREDIT_CARD:
      return "credit";
    case ProtoAccountType.CASH:
      return "cash";
    default:
      return "checking";
  }
}

function toProtoType(type: AccountType): ProtoAccountType {
  switch (type) {
    case "savings":
      return ProtoAccountType.SAVINGS;
    case "credit":
      return ProtoAccountType.CREDIT_CARD;
    case "cash":
      return ProtoAccountType.CASH;
    default:
      return ProtoAccountType.CHECKING;
  }
}

function mapAccount(a: {
  id: string;
  name: string;
  type: ProtoAccountType;
  balance: bigint;
  class?: string;
  product?: string;
  connectionId?: string;
  institutionId?: string;
  lastUpdated?: Parameters<typeof tsToISO>[0];
  createdAt?: Parameters<typeof tsToISO>[0];
  updatedAt?: Parameters<typeof tsToISO>[0];
}): Account {
  const type = mapProtoType(a.type, a.class ?? "");
  const cleanName = a.name.split(" ||")[0];
  const displayName =
    a.connectionId && !cleanName ? (a.product ?? "Connected Account") : cleanName || a.name;
  const balance = cents(Number(a.balance));
  return {
    id: a.id,
    name: displayName,
    type,
    openingBalance: balance,
    currentBalance: balance,
    currency: "AUD",
    color: ACCOUNT_DEFAULT_COLOR[type] ?? "#7c5cff",
    archived: false,
    sortOrder: 0,
    createdAt: tsToISO(a.createdAt),
    updatedAt: tsToISO(a.updatedAt),
    connectionId: a.connectionId || undefined,
    institutionId: a.institutionId || undefined,
    lastUpdated: a.lastUpdated ? tsToISO(a.lastUpdated) : undefined,
  };
}

export async function fetchUserAccounts(): Promise<Account[]> {
  const res = await accountClient.listAccounts({});
  return (res.accounts ?? []).map(mapAccount);
}

export async function fetchBudgetAccounts(budgetId: string): Promise<Account[]> {
  const res = await accountClient.listBudgetAccounts({ budgetId });
  return (res.accounts ?? []).map(mapAccount);
}

export async function createAccountApi(values: AccountFormValues): Promise<Account> {
  const res = await accountClient.createAccount({
    name: values.name,
    type: toProtoType(values.type as AccountType),
    balance: BigInt(values.openingBalance),
  });
  if (!res.account) throw new Error("Failed to create account");
  return mapAccount(res.account);
}

export async function updateAccountApi(id: string, values: AccountFormValues): Promise<Account> {
  const res = await accountClient.updateAccount({
    accountId: id,
    name: values.name,
    type: toProtoType(values.type as AccountType),
    balance: BigInt(values.openingBalance),
  });
  if (!res.account) throw new Error("Failed to update account");
  return mapAccount(res.account);
}

export async function deleteAccountApi(id: string): Promise<void> {
  await accountClient.deleteAccount({ accountId: id });
}

export async function linkAccountToBudget(budgetId: string, accountId: string): Promise<void> {
  await accountClient.linkAccountToBudget({ budgetId, accountId });
}

export async function unlinkAccountFromBudget(budgetId: string, accountId: string): Promise<void> {
  await accountClient.unlinkAccountFromBudget({ budgetId, accountId });
}

export function accountBalanceCents(a: Account): Cents {
  return a.currentBalance;
}
