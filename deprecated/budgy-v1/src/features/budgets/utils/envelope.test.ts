import { describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { cents } from "@/lib/money/cents";
import type { Budget, CategoryTarget } from "../types";
import {
  computeEnvelopeStates,
  defaultModeFor,
  fundedBetween,
  progressColor,
  UNCATEGORISED_ID,
} from "./envelope";

const RANGE = { from: "2024-02-01", to: "2024-02-29" };
const NOW = "2024-02-15";

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "bud1",
    name: "Feb",
    period: "monthly",
    startDate: "2024-01-01",
    active: true,
    targets: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const CAT_SALARY: Category = {
  id: "cat-salary",
  name: "Salary",
  type: "income",
  parentId: null,
  color: "#34d399",
  archived: false,
  sortOrder: 0,
};
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
const CAT_RATES: Category = {
  id: "cat-rates",
  name: "Council rates",
  type: "expense",
  parentId: null,
  color: "#7c5cff",
  archived: false,
  sortOrder: 2,
};

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    accountId: "acc1",
    date: "2024-02-10",
    amount: cents(1000),
    type: "debit",
    categoryId: null,
    tags: [],
    cleared: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function target(t: Partial<CategoryTarget> & { categoryId: string }): CategoryTarget {
  return {
    amount: cents(0),
    frequency: "monthly",
    mode: "period",
    openedAt: "2024-01-01",
    ...t,
  };
}

describe("defaultModeFor", () => {
  it("envelope for quarterly", () => expect(defaultModeFor("quarterly")).toBe("envelope"));
  it("envelope for yearly", () => expect(defaultModeFor("yearly")).toBe("envelope"));
  it("period for monthly", () => expect(defaultModeFor("monthly")).toBe("period"));
  it("period for fortnightly", () => expect(defaultModeFor("fortnightly")).toBe("period"));
  it("period for weekly", () => expect(defaultModeFor("weekly")).toBe("period"));
});

describe("fundedBetween", () => {
  it("monthly $300 for one month → ~$300", () => {
    const t = target({ categoryId: "x", amount: cents(30000), frequency: "monthly" });
    expect(fundedBetween(t, "2024-01-01", "2024-01-31")).toBe(30000);
  });

  it("quarterly $1200 for one month → ~$396 (smoothed)", () => {
    const t = target({ categoryId: "x", amount: cents(120000), frequency: "quarterly" });
    // 30 days of 91 = 30/91 ≈ 0.3297 × $1200 = $395.60
    expect(fundedBetween(t, "2024-01-01", "2024-01-31")).toBe(39560);
  });

  it("yearly $1000 for a full year → $1000", () => {
    const t = target({ categoryId: "x", amount: cents(100000), frequency: "yearly" });
    // Jan 1 → Dec 31 is 365 days → 365/365 × $1000 = $1000
    expect(fundedBetween(t, "2024-01-01", "2024-12-31")).toBe(100000);
  });

  it("zero funding when openedAt is after the toISO", () => {
    const t = target({ categoryId: "x", amount: cents(30000), frequency: "monthly" });
    expect(fundedBetween(t, "2024-03-01", "2024-02-01")).toBe(0);
  });
});

describe("period mode — actuals in view range only", () => {
  it("surfaces income + expense actuals matching the view range", () => {
    const budget = makeBudget({
      targets: [
        target({ categoryId: "cat-salary", amount: cents(720000), frequency: "monthly" }),
        target({ categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly" }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_SALARY, CAT_GROCERIES],
      transactions: [
        txn({ id: "t1", type: "credit", categoryId: "cat-salary", amount: cents(720000) }),
        txn({ id: "t2", type: "debit", categoryId: "cat-groceries", amount: cents(42000) }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });

    expect(r.income[0].periodActual).toBe(720000);
    expect(r.income[0].periodTarget).toBe(720000);
    expect(r.expense[0].periodActual).toBe(42000);
    expect(r.expense[0].periodVariance).toBe(18000);
  });

  it("excludes out-of-range transactions from period figures", () => {
    const budget = makeBudget({
      targets: [target({ categoryId: "cat-groceries", amount: cents(60000) })],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_GROCERIES],
      transactions: [
        txn({
          date: "2024-01-15",
          type: "debit",
          categoryId: "cat-groceries",
          amount: cents(50000),
        }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].periodActual).toBe(0);
  });

  it("normalises weekly $100 to monthly = $428.57", () => {
    const budget = makeBudget({
      targets: [target({ categoryId: "cat-groceries", amount: cents(10000), frequency: "weekly" })],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_GROCERIES],
      transactions: [],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].periodTarget).toBe(42857);
  });
});

describe("envelope mode — accumulating balance", () => {
  it("quarterly $1200 with openedAt = Jan 1, viewed mid-Feb: ~$594 funded, $0 spent, $594 balance", () => {
    const budget = makeBudget({
      targets: [
        target({
          categoryId: "cat-rates",
          amount: cents(120000),
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-01-01",
        }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_RATES],
      transactions: [],
      nowISO: NOW, // 2024-02-15 → 45 days from openedAt
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    // 45/91 × 120000 = 59340 cents = $593.40
    expect(r.expense[0].funded).toBe(59341);
    expect(r.expense[0].spent).toBe(0);
    expect(r.expense[0].balance).toBe(59341);
    expect(r.expense[0].status).toBe("healthy");
  });

  it("envelope: a $1200 bill arriving mid-period shows balance going negative but periodActual reflects the spike", () => {
    // The whole point of envelope mode — quarterly $1200 with the bill landing this month.
    // After 45 days you've funded ~$593, then a $1200 spend leaves balance at -$606.
    const budget = makeBudget({
      targets: [
        target({
          categoryId: "cat-rates",
          amount: cents(120000),
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-01-01",
        }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_RATES],
      transactions: [
        txn({
          id: "t1",
          date: "2024-02-10",
          type: "debit",
          categoryId: "cat-rates",
          amount: cents(120000),
        }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].funded).toBe(59341);
    expect(r.expense[0].spent).toBe(120000);
    expect(r.expense[0].balance).toBe(-60659);
    expect(r.expense[0].status).toBe("overspent");
    // Period figures still see the spike — useful for the Period view
    expect(r.expense[0].periodActual).toBe(120000);
  });

  it("envelope: full quarter elapsed with no spend → balance equals one quarter's worth", () => {
    const budget = makeBudget({
      targets: [
        target({
          categoryId: "cat-rates",
          amount: cents(120000),
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-01-01",
        }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_RATES],
      transactions: [],
      nowISO: "2024-04-01", // exactly 91 days
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].funded).toBe(120000);
    expect(r.expense[0].balance).toBe(120000);
  });

  it("envelope: future-dated openedAt yields zero funding", () => {
    const budget = makeBudget({
      targets: [
        target({
          categoryId: "cat-rates",
          amount: cents(120000),
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-06-01",
        }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_RATES],
      transactions: [],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].funded).toBe(0);
    expect(r.expense[0].spent).toBe(0);
    expect(r.expense[0].balance).toBe(0);
  });

  it("envelope: balance status watches when spent eats most of the funding", () => {
    // Funded $593, spent $500 → balance $93, expected $593, ratio 0.157 → watch
    const budget = makeBudget({
      targets: [
        target({
          categoryId: "cat-rates",
          amount: cents(120000),
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-01-01",
        }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_RATES],
      transactions: [
        txn({
          id: "t1",
          date: "2024-02-05",
          type: "debit",
          categoryId: "cat-rates",
          amount: cents(50000),
        }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].balance).toBe(9341);
    expect(r.expense[0].status).toBe("watch");
  });
});

describe("uncategorised + sentinels", () => {
  it("uncategorised expense in period surfaces as a number on the bundle", () => {
    const budget = makeBudget();
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_GROCERIES],
      transactions: [txn({ id: "t1", type: "debit", categoryId: null, amount: cents(5000) })],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.uncategorisedExpense).toBe(5000);
    expect(r.uncategorisedIncome).toBe(0);
    expect(r.expense).toHaveLength(0);
  });

  it("uncategorised id sentinel is exported as the expected string", () => {
    expect(UNCATEGORISED_ID).toBe("__uncategorised__");
  });
});

describe("subcategory rollup", () => {
  const CAT_HOUSING: Category = {
    id: "cat-housing",
    name: "Housing",
    type: "expense",
    parentId: null,
    color: "#7c5cff",
    archived: false,
    sortOrder: 0,
  };
  const CAT_RENT: Category = {
    id: "cat-rent",
    name: "Rent",
    type: "expense",
    parentId: "cat-housing",
    color: "#a78bfa",
    archived: false,
    sortOrder: 0,
  };
  const CAT_UTILITIES: Category = {
    id: "cat-utilities",
    name: "Utilities",
    type: "expense",
    parentId: "cat-housing",
    color: "#c4b5fd",
    archived: false,
    sortOrder: 1,
  };

  it("parent target aggregates child actuals (period mode)", () => {
    const budget = makeBudget({
      targets: [target({ categoryId: "cat-housing", amount: cents(500000), frequency: "monthly" })],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_HOUSING, CAT_RENT, CAT_UTILITIES],
      transactions: [
        txn({ id: "t1", type: "debit", categoryId: "cat-rent", amount: cents(370000) }),
        txn({ id: "t2", type: "debit", categoryId: "cat-utilities", amount: cents(18000) }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense).toHaveLength(1);
    expect(r.expense[0].categoryId).toBe("cat-housing");
    expect(r.expense[0].periodActual).toBe(388000);
  });
});

describe("sorting", () => {
  it("overspent rows sort before watch and healthy", () => {
    const budget = makeBudget({
      targets: [
        // healthy
        target({ categoryId: "cat-dining", amount: cents(60000), frequency: "monthly" }),
        // overspent
        target({ categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly" }),
      ],
    });
    const r = computeEnvelopeStates({
      budget,
      categories: [CAT_DINING, CAT_GROCERIES],
      transactions: [
        txn({ id: "t1", type: "debit", categoryId: "cat-groceries", amount: cents(80000) }),
        txn({ id: "t2", type: "debit", categoryId: "cat-dining", amount: cents(10000) }),
      ],
      nowISO: NOW,
      viewRange: RANGE,
      viewPeriod: "monthly",
    });
    expect(r.expense[0].categoryId).toBe("cat-groceries");
    expect(r.expense[0].status).toBe("overspent");
    expect(r.expense[1].categoryId).toBe("cat-dining");
  });
});

describe("progressColor", () => {
  it("healthy below 75%", () => expect(progressColor(cents(700), cents(1000))).toBe("healthy"));
  it("watch 75-100%", () => expect(progressColor(cents(800), cents(1000))).toBe("watch"));
  it("watch at exactly 100%", () => expect(progressColor(cents(1000), cents(1000))).toBe("watch"));
  it("overspent above 100%", () =>
    expect(progressColor(cents(1001), cents(1000))).toBe("overspent"));
  it("overspent when projected is 0 and there's spend", () =>
    expect(progressColor(cents(100), cents(0))).toBe("overspent"));
});
