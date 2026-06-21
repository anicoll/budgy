import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { computeBudgetSummary, computePeriodBudgetSummary, computeZeroSumPool } from "./summary";
import type { BackendAccount, BackendCategory } from "./types";

const cat = (overrides: Partial<BackendCategory> = {}): BackendCategory => ({
  id: "c1",
  name: "Groceries",
  type: "expense",
  parentId: null,
  system: false,
  budgeted: cents(50000),
  balance: cents(30000),
  targetLimit: cents(40000),
  budgetedFrequency: "monthly",
  ...overrides,
});

const acc = (overrides: Partial<BackendAccount> = {}): BackendAccount => ({
  id: "a1",
  name: "Checking",
  balance: cents(100000),
  ...overrides,
});

const range = { from: "2024-06-01", to: "2024-06-30" };

describe("computeZeroSumPool", () => {
  it("sums account balances and category budgeted targets", () => {
    const pool = computeZeroSumPool(
      [acc({ balance: cents(200000) }), acc({ id: "a2", balance: cents(50000) })],
      [cat({ budgeted: cents(80000) }), cat({ id: "c2", budgeted: cents(20000) })],
    );

    expect(pool.totalAvailableFunds).toBe(cents(250000));
    expect(pool.totalAssignedFunds).toBe(cents(100000));
    expect(pool.readyToAssign).toBe(cents(150000));
  });

  it("ignores transfer categories in assigned total", () => {
    const pool = computeZeroSumPool(
      [acc()],
      [
        cat({ budgeted: cents(50000) }),
        cat({ id: "xfer", type: "transfer", budgeted: cents(99999) }),
      ],
    );

    expect(pool.totalAssignedFunds).toBe(cents(50000));
  });
});

describe("computePeriodBudgetSummary", () => {
  it("computes pool, received, spent, and budgeted totals for the period", () => {
    const summary = computePeriodBudgetSummary(
      [acc()],
      [
        cat({ id: "salary", type: "income", name: "Salary", budgeted: cents(800000) }),
        cat({ budgeted: cents(30000) }),
      ],
      "monthly",
      [
        {
          id: "t1",
          accountId: "a1",
          categoryId: "salary",
          amount: cents(800000),
          type: "credit",
          date: "2024-06-15",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "t2",
          accountId: "a1",
          categoryId: "c1",
          amount: cents(12000),
          type: "debit",
          date: "2024-06-10",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      ["a1"],
      range,
    );

    expect(summary.kind).toBe("period");
    expect(summary.pool.readyToAssign).toBe(cents(100000 - 830000));
    expect(summary.periodReceived).toBe(cents(800000));
    expect(summary.periodSpent).toBe(cents(12000));
    expect(summary.periodNet).toBe(cents(788000));
    expect(summary.budgetedIncome).toBe(cents(800000));
    expect(summary.budgetedExpenses).toBe(cents(30000));
    expect(summary.budgetedNet).toBe(cents(770000));
  });

  it("excludes uncategorized and transfer transactions from received and spent", () => {
    const summary = computePeriodBudgetSummary(
      [acc()],
      [
        cat({ id: "salary", type: "income", budgeted: cents(500000) }),
        cat({ id: "groceries", type: "expense", budgeted: cents(20000) }),
        cat({ id: "xfer", type: "transfer", budgeted: cents(0) }),
      ],
      "monthly",
      [
        {
          id: "t1",
          accountId: "a1",
          categoryId: "salary",
          amount: cents(500000),
          type: "credit",
          date: "2024-06-05",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "t2",
          accountId: "a1",
          categoryId: null,
          amount: cents(99999),
          type: "credit",
          date: "2024-06-06",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "t3",
          accountId: "a1",
          categoryId: "groceries",
          amount: cents(5000),
          type: "debit",
          date: "2024-06-07",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "t4",
          accountId: "a1",
          categoryId: "xfer",
          amount: cents(100000),
          type: "transfer",
          transferDirection: "out",
          date: "2024-06-08",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      ["a1"],
      range,
      [
        { id: "salary", type: "income" },
        { id: "groceries", type: "expense" },
        { id: "xfer", type: "transfer" },
      ],
    );

    expect(summary.periodReceived).toBe(cents(500000));
    expect(summary.periodSpent).toBe(cents(5000));
  });
});

describe("computeBudgetSummary", () => {
  it("returns null without transactions and range", () => {
    expect(computeBudgetSummary([acc()], [cat()], "monthly")).toBeNull();
  });
});
