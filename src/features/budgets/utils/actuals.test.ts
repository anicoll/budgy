import { describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { cents } from "@/lib/money/cents";
import type { Budget } from "../types";
import { budgetTotals, computeActuals, computeUnbudgetedSpend, progressColor } from "./actuals";

const CAT_GROCERIES: Category = {
  id: "cat-groceries",
  name: "Groceries",
  type: "expense",
  parentId: null,
  color: "#f5b942",
  archived: false,
  sortOrder: 0,
};

const CAT_DINING: Category = {
  id: "cat-dining",
  name: "Dining",
  type: "expense",
  parentId: null,
  color: "#fb7185",
  archived: false,
  sortOrder: 1,
};

const RANGE = { from: "2024-02-01", to: "2024-02-29" };

const BUDGET: Budget = {
  id: "bud1",
  name: "February",
  period: "monthly",
  startDate: "2024-01-01",
  active: true,
  categoryAllocations: [
    { categoryId: "cat-groceries", amount: cents(40000), rollover: false },
    { categoryId: "cat-dining", amount: cents(20000), rollover: false },
  ],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

function makeTxn(overrides: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    accountId: "acc1",
    date: "2024-02-10",
    amount: cents(1000),
    type: "debit",
    categoryId: null,
    tags: [],
    cleared: false,
    createdAt: "2024-02-10T00:00:00Z",
    updatedAt: "2024-02-10T00:00:00Z",
    ...overrides,
  };
}

describe("computeActuals", () => {
  it("maps spending to the right category", () => {
    const txns: Transaction[] = [
      makeTxn({ id: "t1", categoryId: "cat-groceries", amount: cents(15000) }),
      makeTxn({ id: "t2", categoryId: "cat-dining", amount: cents(8000) }),
    ];

    const actuals = computeActuals(BUDGET, txns, [CAT_GROCERIES, CAT_DINING], RANGE);

    expect(actuals.find((a) => a.categoryId === "cat-groceries")?.spent).toBe(15000);
    expect(actuals.find((a) => a.categoryId === "cat-dining")?.spent).toBe(8000);
  });

  it("remaining = allocated - spent", () => {
    const txns: Transaction[] = [
      makeTxn({ id: "t1", categoryId: "cat-groceries", amount: cents(15000) }),
    ];

    const actuals = computeActuals(BUDGET, txns, [CAT_GROCERIES, CAT_DINING], RANGE);
    const g = actuals.find((a) => a.categoryId === "cat-groceries");
    expect(g?.remaining).toBe(40000 - 15000);
  });

  it("excludes transactions outside the range", () => {
    const txns: Transaction[] = [
      makeTxn({ id: "t1", date: "2024-01-15", categoryId: "cat-groceries", amount: cents(50000) }),
    ];

    const actuals = computeActuals(BUDGET, txns, [CAT_GROCERIES, CAT_DINING], RANGE);
    expect(actuals.find((a) => a.categoryId === "cat-groceries")?.spent).toBe(0);
  });

  it("credits are not counted as spend", () => {
    const txns: Transaction[] = [
      makeTxn({ id: "t1", type: "credit", categoryId: "cat-groceries", amount: cents(10000) }),
    ];

    const actuals = computeActuals(BUDGET, txns, [CAT_GROCERIES, CAT_DINING], RANGE);
    expect(actuals.find((a) => a.categoryId === "cat-groceries")?.spent).toBe(0);
  });

  it("rollover adds previous-period surplus to effective allocation", () => {
    const budgetWithRollover: Budget = {
      ...BUDGET,
      categoryAllocations: [{ categoryId: "cat-groceries", amount: cents(40000), rollover: true }],
    };

    // Previous period (Jan): spent only 30000 of 40000 → surplus 10000
    const janTxn = makeTxn({
      id: "t-jan",
      date: "2024-01-15",
      categoryId: "cat-groceries",
      amount: cents(30000),
    });
    // Current period: spent 25000
    const febTxn = makeTxn({
      id: "t-feb",
      date: "2024-02-10",
      categoryId: "cat-groceries",
      amount: cents(25000),
    });

    const actuals = computeActuals(budgetWithRollover, [janTxn, febTxn], [CAT_GROCERIES], RANGE);

    const g = actuals[0];
    expect(g.rolloverAmount).toBe(10000);
    expect(g.effectiveAllocated).toBe(50000); // 40000 + 10000 rollover
    expect(g.remaining).toBe(25000); // 50000 - 25000
  });
});

describe("computeUnbudgetedSpend", () => {
  it("sums debits with no category or with unallocated category", () => {
    const txns: Transaction[] = [
      makeTxn({ id: "t1", categoryId: null, amount: cents(5000) }), // uncategorised
      makeTxn({ id: "t2", categoryId: "cat-other", amount: cents(3000) }), // unallocated
      makeTxn({ id: "t3", categoryId: "cat-groceries", amount: cents(10000) }), // allocated
    ];

    const total = computeUnbudgetedSpend(BUDGET, txns, RANGE);
    expect(total).toBe(8000); // 5000 + 3000
  });
});

describe("budgetTotals", () => {
  it("sums allocated, spent, remaining across all actuals", () => {
    const totals = budgetTotals([
      {
        categoryId: "a",
        categoryName: "A",
        categoryColor: "#fff",
        allocated: cents(10000),
        spent: cents(6000),
        rolloverAmount: cents(0),
        effectiveAllocated: cents(10000),
        remaining: cents(4000),
        rollover: false,
      },
      {
        categoryId: "b",
        categoryName: "B",
        categoryColor: "#fff",
        allocated: cents(5000),
        spent: cents(5500),
        rolloverAmount: cents(0),
        effectiveAllocated: cents(5000),
        remaining: cents(-500),
        rollover: false,
      },
    ]);
    expect(totals.allocated).toBe(15000);
    expect(totals.spent).toBe(11500);
    expect(totals.remaining).toBe(3500);
  });
});

describe("progressColor", () => {
  it("returns safe below 75%", () => expect(progressColor(cents(700), cents(1000))).toBe("safe"));
  it("returns warning 75-99%", () =>
    expect(progressColor(cents(800), cents(1000))).toBe("warning"));
  it("returns over at 100%+", () => expect(progressColor(cents(1000), cents(1000))).toBe("over"));
  it("returns over when effective is zero", () =>
    expect(progressColor(cents(100), cents(0))).toBe("over"));
});
