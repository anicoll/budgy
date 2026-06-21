import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import type { Transaction } from "@/features/transactions/types";
import {
  buildCategoryTypeLookup,
  computePeriodReceived,
  computePeriodSpent,
} from "./period-summary";

const range = { from: "2024-06-01", to: "2024-06-30" };
const lookup = buildCategoryTypeLookup([
  { id: "salary", type: "income" },
  { id: "groceries", type: "expense" },
  { id: "xfer", type: "transfer" },
]);

const tx = (
  overrides: Partial<Transaction> & Pick<Transaction, "id">,
): Transaction => ({
  accountId: "a1",
  categoryId: "groceries",
  amount: cents(1000),
  type: "debit",
  date: "2024-06-10",
  tags: [],
  cleared: true,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("computePeriodReceived", () => {
  it("counts only credits on income categories", () => {
    const received = computePeriodReceived(
      [
        tx({ id: "t1", categoryId: "salary", type: "credit", amount: cents(500000) }),
        tx({ id: "t2", categoryId: null, type: "credit", amount: cents(10000) }),
        tx({ id: "t3", categoryId: "groceries", type: "credit", amount: cents(5000) }),
        tx({ id: "t4", categoryId: "xfer", type: "credit", amount: cents(20000) }),
      ],
      ["a1"],
      range,
      lookup,
    );
    expect(received).toBe(cents(500000));
  });
});

describe("computePeriodSpent", () => {
  it("counts only debits on expense categories", () => {
    const spent = computePeriodSpent(
      [
        tx({ id: "t1", categoryId: "groceries", type: "debit", amount: cents(3000) }),
        tx({ id: "t2", categoryId: null, type: "debit", amount: cents(9000) }),
        tx({ id: "t3", categoryId: "salary", type: "debit", amount: cents(1000) }),
        tx({ id: "t4", categoryId: "xfer", type: "debit", amount: cents(4000) }),
      ],
      ["a1"],
      range,
      lookup,
    );
    expect(spent).toBe(cents(3000));
  });
});
