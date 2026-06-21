import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { computeBudgetSummary, computePeriodBudgetSummary } from "./summary";
import type { BackendCategory } from "./types";

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

const range = { from: "2024-06-01", to: "2024-06-30" };

describe("computePeriodBudgetSummary", () => {
  it("computes received, spent, and budgeted totals for the period", () => {
    const summary = computePeriodBudgetSummary(
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
    expect(summary.periodReceived).toBe(cents(800000));
    expect(summary.periodSpent).toBe(cents(12000));
    expect(summary.periodNet).toBe(cents(788000));
    expect(summary.budgetedIncome).toBe(cents(800000));
    expect(summary.budgetedExpenses).toBe(cents(30000));
    expect(summary.budgetedNet).toBe(cents(770000));
  });
});

describe("computeBudgetSummary", () => {
  it("returns null without transactions and range", () => {
    expect(computeBudgetSummary([cat()], "monthly")).toBeNull();
  });
});
