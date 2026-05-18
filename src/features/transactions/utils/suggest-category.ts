import type { Category } from "@/features/categories/types";
import type { Transaction } from "../types";

export function suggestCategoryForPayee(
  txn: Transaction,
  allTxns: Transaction[],
  categories: Category[],
): Category | undefined {
  const payee = txn.payee?.trim();
  if (!payee) return undefined;

  const payeeLower = payee.toLowerCase();
  const counts = new Map<string, number>();

  for (const t of allTxns) {
    if (t.id === txn.id) continue;
    if (!t.categoryId) continue;
    if (t.payee?.trim().toLowerCase() !== payeeLower) continue;
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  }

  if (counts.size === 0) return undefined;

  let bestId: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  }

  if (!bestId) return undefined;
  return categories.find((c) => c.id === bestId);
}
