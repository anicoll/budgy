import { ulid } from "@/lib/id/ulid";
import { type Cents, cents } from "@/lib/money/cents";
import { getRepositories } from "@/lib/storage";
import type { AccountFormValues } from "./schema";
import { ACCOUNT_DEFAULT_COLOR, type Account, type AccountType } from "./types";

export function accountsRepo() {
  return getRepositories().accounts;
}

export async function listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]> {
  const rows = await accountsRepo().list();
  const filtered = opts?.includeArchived ? rows : rows.filter((r) => !r.archived);
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createAccount(values: AccountFormValues): Promise<Account> {
  const existing = await accountsRepo().list();
  const now = new Date().toISOString();
  const opening = cents(values.openingBalance);
  const account: Account = {
    id: ulid(),
    name: values.name,
    type: values.type as AccountType,
    institution: values.institution?.trim() || undefined,
    openingBalance: opening,
    currentBalance: opening,
    currency: "AUD",
    color: values.color || ACCOUNT_DEFAULT_COLOR[values.type as AccountType],
    archived: false,
    sortOrder: existing.length,
    createdAt: now,
    updatedAt: now,
  };
  return accountsRepo().upsert(account);
}

export async function updateAccount(id: string, values: AccountFormValues): Promise<Account> {
  const current = await accountsRepo().get(id);
  if (!current) throw new Error(`Account ${id} not found`);
  const nextOpening = cents(values.openingBalance);
  const delta = (nextOpening - current.openingBalance) as Cents;
  const updated: Account = {
    ...current,
    name: values.name,
    type: values.type as AccountType,
    institution: values.institution?.trim() || undefined,
    openingBalance: nextOpening,
    currentBalance: (current.currentBalance + delta) as Cents,
    color: values.color,
    archived: values.archived ?? current.archived,
    updatedAt: new Date().toISOString(),
  };
  return accountsRepo().upsert(updated);
}

export async function setArchived(id: string, archived: boolean): Promise<Account> {
  const current = await accountsRepo().get(id);
  if (!current) throw new Error(`Account ${id} not found`);
  const updated = { ...current, archived, updatedAt: new Date().toISOString() };
  return accountsRepo().upsert(updated);
}

export async function deleteAccount(id: string): Promise<void> {
  await accountsRepo().delete(id);
}

export async function reorderAccounts(orderedIds: string[]): Promise<Account[]> {
  const all = await accountsRepo().list();
  const byId = new Map(all.map((a) => [a.id, a]));
  const now = new Date().toISOString();
  const updates: Account[] = orderedIds
    .map((id, idx) => {
      const a = byId.get(id);
      if (!a) return null;
      return { ...a, sortOrder: idx, updatedAt: now };
    })
    .filter((a): a is Account => a !== null);
  await accountsRepo().bulkUpsert(updates);
  return updates;
}

export function totalsByType(accounts: Account[]): Map<AccountType, number> {
  const totals = new Map<AccountType, number>();
  for (const a of accounts) {
    totals.set(a.type, (totals.get(a.type) ?? 0) + a.currentBalance);
  }
  return totals;
}

export function netWorth(accounts: Account[]): number {
  let total = 0;
  for (const a of accounts) {
    if (a.archived) continue;
    if (a.type === "credit" || a.type === "loan") {
      total -= a.currentBalance;
    } else {
      total += a.currentBalance;
    }
  }
  return total;
}
