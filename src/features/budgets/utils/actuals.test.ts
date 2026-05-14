import { describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { cents } from "@/lib/money/cents";
import type { Budget, CategoryTarget } from "../types";
import { computeFluidActuals, progressColor } from "./actuals";

const RANGE = { from: "2024-02-01", to: "2024-02-29" };
const BUDGET: Budget = {
  id: "bud1",
  name: "Feb",
  period: "monthly",
  startDate: "2024-01-01",
  active: true,
  targets: [],
  createdAt: "",
  updatedAt: "",
};

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
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("actuals from transactions (no targets)", () => {
  it("surfaces all categorised income + expense", () => {
    const txns = [
      makeTxn({ id: "t1", type: "credit", categoryId: "cat-salary", amount: cents(720000) }),
      makeTxn({ id: "t2", type: "debit", categoryId: "cat-groceries", amount: cents(42000) }),
    ];
    const r = computeFluidActuals(txns, [CAT_SALARY, CAT_GROCERIES], [], RANGE, "monthly", BUDGET);
    expect(r.income[0].actual).toBe(720000);
    expect(r.expense[0].actual).toBe(42000);
    expect(r.income[0].hasTarget).toBe(false);
    expect(r.net).toBe(678000);
  });

  it("excludes out-of-range transactions", () => {
    const r = computeFluidActuals(
      [
        makeTxn({
          id: "t1",
          date: "2024-01-15",
          type: "debit",
          categoryId: "cat-groceries",
          amount: cents(50000),
        }),
      ],
      [CAT_GROCERIES],
      [],
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense).toHaveLength(0);
  });

  it("ignores uncategorised transactions", () => {
    const r = computeFluidActuals(
      [makeTxn({ categoryId: null })],
      [CAT_GROCERIES],
      [],
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense).toHaveLength(0);
  });
});

describe("with targets — same frequency as view period", () => {
  it("projectedTarget equals target amount when frequency matches view", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly", rollover: false },
    ];
    const r = computeFluidActuals(
      [makeTxn({ id: "t1", type: "debit", categoryId: "cat-groceries", amount: cents(42000) })],
      [CAT_GROCERIES],
      targets,
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense[0].projectedTarget).toBe(60000);
    expect(r.expense[0].variance).toBe(18000);
    expect(r.expense[0].hasTarget).toBe(true);
  });

  it("category with target but zero spending: actual=0, full projected", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "cat-dining", amount: cents(20000), frequency: "monthly", rollover: false },
    ];
    const r = computeFluidActuals([], [CAT_DINING], targets, RANGE, "monthly", BUDGET);
    expect(r.expense[0].actual).toBe(0);
    expect(r.expense[0].projectedTarget).toBe(20000);
  });
});

describe("frequency normalisation", () => {
  it("weekly $100 → monthly ≈ $433", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "cat-groceries", amount: cents(10000), frequency: "weekly", rollover: false },
    ];
    const r = computeFluidActuals(
      [makeTxn({ type: "debit", categoryId: "cat-groceries", amount: cents(42000) })],
      [CAT_GROCERIES],
      targets,
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense[0].projectedTarget).toBe(43333);
    expect(r.expense[0].targetFrequency).toBe("weekly");
  });

  it("fortnightly $3,500 → monthly ≈ $7,583", () => {
    const targets: CategoryTarget[] = [
      {
        categoryId: "cat-salary",
        amount: cents(350000),
        frequency: "fortnightly",
        rollover: false,
      },
    ];
    const r = computeFluidActuals(
      [makeTxn({ type: "credit", categoryId: "cat-salary", amount: cents(700000) })],
      [CAT_SALARY],
      targets,
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.income[0].projectedTarget).toBe(758333);
  });
});

describe("rollover", () => {
  it("carries forward surplus from previous period", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly", rollover: true },
    ];
    const r = computeFluidActuals(
      [
        makeTxn({
          id: "t-jan",
          date: "2024-01-15",
          type: "debit",
          categoryId: "cat-groceries",
          amount: cents(50000),
        }),
        makeTxn({
          id: "t-feb",
          date: "2024-02-10",
          type: "debit",
          categoryId: "cat-groceries",
          amount: cents(42000),
        }),
      ],
      [CAT_GROCERIES],
      targets,
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense[0].rolloverAmount).toBe(10000);
    expect(r.expense[0].effectiveProjected).toBe(70000);
    expect(r.expense[0].variance).toBe(28000);
  });
});

describe("income + expense split + sorting", () => {
  it("splits categories into income and expense arrays", () => {
    const r = computeFluidActuals(
      [
        makeTxn({ id: "t1", type: "credit", categoryId: "cat-salary", amount: cents(720000) }),
        makeTxn({ id: "t2", type: "debit", categoryId: "cat-groceries", amount: cents(42000) }),
        makeTxn({ id: "t3", type: "debit", categoryId: "cat-dining", amount: cents(18000) }),
      ],
      [CAT_SALARY, CAT_GROCERIES, CAT_DINING],
      [],
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.income).toHaveLength(1);
    expect(r.expense).toHaveLength(2);
  });

  it("targeted items sort before untargeted", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "cat-dining", amount: cents(20000), frequency: "monthly", rollover: false },
    ];
    const r = computeFluidActuals(
      [
        makeTxn({ id: "t1", type: "debit", categoryId: "cat-groceries", amount: cents(42000) }),
        makeTxn({ id: "t2", type: "debit", categoryId: "cat-dining", amount: cents(18000) }),
      ],
      [CAT_GROCERIES, CAT_DINING],
      targets,
      RANGE,
      "monthly",
      BUDGET,
    );
    expect(r.expense[0].categoryId).toBe("cat-dining");
    expect(r.expense[0].hasTarget).toBe(true);
    expect(r.expense[1].hasTarget).toBe(false);
  });
});

describe("progressColor", () => {
  it("safe below 75%", () => expect(progressColor(cents(700), cents(1000))).toBe("safe"));
  it("warning 75–99%", () => expect(progressColor(cents(800), cents(1000))).toBe("warning"));
  it("over at 100%+", () => expect(progressColor(cents(1000), cents(1000))).toBe("over"));
  it("over when projected is 0", () => expect(progressColor(cents(100), cents(0))).toBe("over"));
});
