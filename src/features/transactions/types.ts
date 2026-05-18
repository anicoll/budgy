import type { Cents } from "@/lib/money/cents";

export type TxnType = "debit" | "credit" | "transfer";
export type TransferDirection = "in" | "out";

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: Cents;
  type: TxnType;
  transferDirection?: TransferDirection;
  categoryId: string | null;
  payee?: string;
  description?: string;
  tags: string[];
  transferAccountId?: string;
  transferPairId?: string;
  /** Links the two sides of an envelope-cover pair. */
  transferGroupId?: string;
  cleared: boolean;
  createdAt: string;
  updatedAt: string;
}

export function signedAmount(txn: Transaction): Cents {
  if (txn.type === "debit") return -txn.amount as Cents;
  if (txn.type === "credit") return txn.amount;
  if (txn.type === "transfer") {
    return txn.transferDirection === "in" ? txn.amount : (-txn.amount as Cents);
  }
  return 0 as Cents;
}

export const TXN_TYPE_LABEL: Record<TxnType, string> = {
  debit: "Expense",
  credit: "Income",
  transfer: "Transfer",
};
