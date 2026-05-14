import { z } from "zod";
import type { Account } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { getRepositories } from "@/lib/storage";

export const EXPORT_VERSION = 1;

export interface BudgyExport {
  version: number;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

// ── Export ────────────────────────────────────────────────────────────────

export async function exportData(): Promise<BudgyExport> {
  const repos = getRepositories();
  const [accounts, categories, transactions, budgets] = await Promise.all([
    repos.accounts.list(),
    repos.categories.list(),
    repos.transactions.list(),
    repos.budgets.list(),
  ]);
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    budgets,
  };
}

export function downloadJSON(data: BudgyExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `budgy-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import ────────────────────────────────────────────────────────────────

// Zod v4: z.record() requires both key and value schemas
const rowArraySchema = z.array(z.record(z.string(), z.unknown())).default([]);

const importSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  accounts: rowArraySchema,
  categories: rowArraySchema,
  transactions: rowArraySchema,
  budgets: rowArraySchema,
});

export type ImportMode = "replace" | "merge";

export async function importData(
  raw: unknown,
  mode: ImportMode = "replace",
): Promise<{ accounts: number; categories: number; transactions: number; budgets: number }> {
  const parsed = importSchema.parse(raw);
  const repos = getRepositories();

  if (mode === "replace") {
    const [accs, cats, txns, buds] = await Promise.all([
      repos.accounts.list(),
      repos.categories.list(),
      repos.transactions.list(),
      repos.budgets.list(),
    ]);
    await Promise.all([
      ...accs.map((r) => repos.accounts.delete(r.id)),
      ...cats.map((r) => repos.categories.delete(r.id)),
      ...txns.map((r) => repos.transactions.delete(r.id)),
      ...buds.map((r) => repos.budgets.delete(r.id)),
    ]);
  }

  await Promise.all([
    repos.accounts.bulkUpsert(parsed.accounts as unknown as Account[]),
    repos.categories.bulkUpsert(parsed.categories as unknown as Category[]),
    repos.transactions.bulkUpsert(parsed.transactions as unknown as Transaction[]),
    repos.budgets.bulkUpsert(parsed.budgets as unknown as Budget[]),
  ]);

  return {
    accounts: parsed.accounts.length,
    categories: parsed.categories.length,
    transactions: parsed.transactions.length,
    budgets: parsed.budgets.length,
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────

export async function resetAllData(): Promise<void> {
  const repos = getRepositories();
  const [accs, cats, txns, buds] = await Promise.all([
    repos.accounts.list(),
    repos.categories.list(),
    repos.transactions.list(),
    repos.budgets.list(),
  ]);
  await Promise.all([
    ...accs.map((r) => repos.accounts.delete(r.id)),
    ...cats.map((r) => repos.categories.delete(r.id)),
    ...txns.map((r) => repos.transactions.delete(r.id)),
    ...buds.map((r) => repos.budgets.delete(r.id)),
  ]);
}
