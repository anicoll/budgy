import type { DateRange } from "@/lib/date/periods";
import { ulid } from "@/lib/id/ulid";
import { type Cents, cents } from "@/lib/money/cents";
import { getRepositories } from "@/lib/storage";
import type { TxnFormValues } from "./schema";
import { signedAmount, type Transaction } from "./types";

export function txnsRepo() {
  return getRepositories().transactions;
}

export async function listTransactions(opts?: {
  accountId?: string;
  categoryId?: string;
  range?: DateRange;
  limit?: number;
}): Promise<Transaction[]> {
  const all = await txnsRepo().list();
  let filtered = all;

  if (opts?.accountId) {
    filtered = filtered.filter((t) => t.accountId === opts.accountId);
  }
  if (opts?.categoryId) {
    filtered = filtered.filter((t) => t.categoryId === opts.categoryId);
  }
  if (opts?.range) {
    const { from, to } = opts.range;
    filtered = filtered.filter((t) => t.date >= from && t.date <= to);
  }

  filtered.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

  if (opts?.limit) filtered = filtered.slice(0, opts.limit);

  return filtered;
}

export async function createTransaction(values: TxnFormValues): Promise<Transaction[]> {
  const now = new Date().toISOString();
  const amount = cents(values.amount);

  if (values.type === "transfer") {
    if (!values.transferAccountId) throw new Error("Transfer requires a destination account");
    const sourceId = ulid();
    const destId = ulid();

    const source: Transaction = {
      id: sourceId,
      accountId: values.accountId,
      date: values.date,
      amount,
      type: "transfer",
      transferDirection: "out",
      categoryId: values.categoryId ?? null,
      payee: values.payee?.trim() || undefined,
      description: values.description?.trim() || undefined,
      tags: values.tags ?? [],
      transferAccountId: values.transferAccountId,
      transferPairId: destId,
      cleared: values.cleared ?? false,
      createdAt: now,
      updatedAt: now,
    };

    const dest: Transaction = {
      id: destId,
      accountId: values.transferAccountId,
      date: values.date,
      amount,
      type: "transfer",
      transferDirection: "in",
      categoryId: values.categoryId ?? null,
      payee: values.payee?.trim() || undefined,
      description: values.description?.trim() || undefined,
      tags: values.tags ?? [],
      transferAccountId: values.accountId,
      transferPairId: sourceId,
      cleared: values.cleared ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await txnsRepo().bulkUpsert([source, dest]);
    await recomputeAccountBalance(values.accountId);
    await recomputeAccountBalance(values.transferAccountId);
    return [source, dest];
  }

  const txn: Transaction = {
    id: ulid(),
    accountId: values.accountId,
    date: values.date,
    amount,
    type: values.type,
    categoryId: values.categoryId ?? null,
    payee: values.payee?.trim() || undefined,
    description: values.description?.trim() || undefined,
    tags: values.tags ?? [],
    cleared: values.cleared ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await txnsRepo().upsert(txn);
  await recomputeAccountBalance(values.accountId);
  return [txn];
}

export async function updateTransaction(id: string, values: TxnFormValues): Promise<Transaction[]> {
  const existing = await txnsRepo().get(id);
  if (!existing) throw new Error(`Transaction ${id} not found`);

  // If it was a transfer, delete the pair first
  if (existing.type === "transfer" && existing.transferPairId) {
    const oldAccounts = new Set(
      [existing.accountId, existing.transferAccountId].filter(Boolean) as string[],
    );
    await txnsRepo().delete(existing.transferPairId);
    await txnsRepo().delete(id);
    for (const acId of oldAccounts) await recomputeAccountBalance(acId);
    return createTransaction(values);
  }

  const now = new Date().toISOString();
  const updated: Transaction = {
    ...existing,
    date: values.date,
    amount: cents(values.amount),
    type: values.type,
    categoryId: values.categoryId ?? null,
    payee: values.payee?.trim() || undefined,
    description: values.description?.trim() || undefined,
    tags: values.tags ?? [],
    cleared: values.cleared ?? existing.cleared,
    updatedAt: now,
  };

  await txnsRepo().upsert(updated);
  await recomputeAccountBalance(values.accountId);
  return [updated];
}

export async function deleteTransaction(id: string): Promise<void> {
  const txn = await txnsRepo().get(id);
  if (!txn) return;

  const accountsToRecompute = new Set<string>([txn.accountId]);

  if (txn.type === "transfer" && txn.transferPairId) {
    const pair = await txnsRepo().get(txn.transferPairId);
    if (pair) {
      accountsToRecompute.add(pair.accountId);
      await txnsRepo().delete(txn.transferPairId);
    }
  }

  await txnsRepo().delete(id);
  for (const accountId of accountsToRecompute) {
    await recomputeAccountBalance(accountId);
  }
}

export async function toggleCleared(id: string): Promise<Transaction> {
  const txn = await txnsRepo().get(id);
  if (!txn) throw new Error(`Transaction ${id} not found`);
  const updated = { ...txn, cleared: !txn.cleared, updatedAt: new Date().toISOString() };
  return txnsRepo().upsert(updated);
}

export async function recomputeAccountBalance(accountId: string): Promise<Cents> {
  const repo = getRepositories();
  const account = await repo.accounts.get(accountId);
  if (!account) return 0 as Cents;

  const txns = await txnsRepo().list({ where: { accountId } });
  let balance = account.openingBalance;
  for (const t of txns) {
    balance = (balance + signedAmount(t)) as Cents;
  }

  await repo.accounts.upsert({ ...account, currentBalance: balance });
  return balance;
}
