import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import {
  computeCategoryPeriodView,
  sumTransactionsInRange,
  uncategorizedTransactionsInPeriod,
} from "./period-summary";
import type { BackendCategory } from "./types";

const cat = (): BackendCategory => ({
  id: "c1",
  name: "Groceries",
  type: "expense",
  parentId: null,
  system: false,
  budgeted: cents(40000),
  balance: cents(-5000),
  targetLimit: cents(0),
  budgetedFrequency: "fortnightly",
});

describe("sumTransactionsInRange", () => {
  it("sums tx for category in range on linked accounts", () => {
    const total = sumTransactionsInRange(
      [
        {
          id: "t1",
          accountId: "a1",
          categoryId: "c1",
          amount: cents(2000),
          type: "debit",
          date: "2024-06-10",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "t2",
          accountId: "a1",
          categoryId: "c1",
          amount: cents(3000),
          type: "debit",
          date: "2024-05-01",
          tags: [],
          cleared: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      new Set(["a1"]),
      { from: "2024-06-01", to: "2024-06-30" },
      "c1",
    );
    expect(total).toBe(cents(-2000));
  });
});

describe("computeCategoryPeriodView", () => {
  it("flags over target when spend exceeds normalised target", () => {
    const view = computeCategoryPeriodView(cat(), "fortnightly", cents(-50000));
    expect(view.overTarget).toBe(true);
    expect(view.periodTarget).toBe(cents(40000));
  });
});

describe("uncategorizedTransactionsInPeriod", () => {
  it("lists uncategorized tx on linked accounts", () => {
    const list = uncategorizedTransactionsInPeriod(
      [
        {
          id: "t1",
          accountId: "a1",
          categoryId: null,
          amount: cents(1000),
          type: "debit",
          date: "2024-06-05",
          description: "Coffee",
          tags: [],
          cleared: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      ["a1"],
      { from: "2024-06-01", to: "2024-06-30" },
    );
    expect(list).toHaveLength(1);
  });
});
