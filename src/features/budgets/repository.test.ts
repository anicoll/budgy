import { beforeEach, describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { isoDateAU } from "@/lib/date/au-locale";
import { type Cents, cents } from "@/lib/money/cents";
import { getRepositories, resetRepositoriesForTests } from "@/lib/storage";
import { resetDBForTests } from "@/lib/storage/db";
import {
  coverOverspending,
  createBudget,
  ensureMissingTargets,
  getActiveBudget,
  setTarget,
} from "./repository";
import { computeEnvelopeStates } from "./utils/envelope";

beforeEach(async () => {
  resetRepositoriesForTests();
  resetDBForTests();
  const { getDB } = await import("@/lib/storage/db");
  await getDB().delete();
  resetDBForTests();
});

describe("budgets repository", () => {
  it("createBudget defaults mode (envelope for quarterly, period for monthly)", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [
        { categoryId: "cat-groceries", amount: 60_00, frequency: "monthly" },
        { categoryId: "cat-rates", amount: 1200_00, frequency: "quarterly" },
      ],
    });
    const groceries = budget.targets.find((t) => t.categoryId === "cat-groceries");
    const rates = budget.targets.find((t) => t.categoryId === "cat-rates");
    expect(groceries?.mode).toBe("period");
    expect(rates?.mode).toBe("envelope");
    // openedAt defaults to budget startDate
    expect(groceries?.openedAt).toBe("2024-01-01");
    expect(rates?.openedAt).toBe("2024-01-01");
  });

  it("ensureMissingTargets appends only missing category ids", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: isoDateAU(),
      notes: "",
      targets: [{ categoryId: "cat-groceries", amount: 125_00, frequency: "monthly" }],
    });

    await ensureMissingTargets(budget.id, [
      "cat-groceries",
      "cat-education",
      "cat-health",
      "cat-education",
    ]);

    const updated = await getActiveBudget();
    expect(updated).not.toBeNull();
    if (!updated) throw new Error("Expected active budget");
    expect(updated.targets).toHaveLength(3);

    const groceries = updated.targets.find((t) => t.categoryId === "cat-groceries");
    expect(groceries?.amount).toBe(125_00);
    expect(groceries?.frequency).toBe("monthly");
    expect(groceries?.mode).toBe("period");

    const education = updated.targets.find((t) => t.categoryId === "cat-education");
    const health = updated.targets.find((t) => t.categoryId === "cat-health");
    expect(education).toMatchObject({ amount: 0, frequency: "monthly", mode: "period" });
    expect(health).toMatchObject({ amount: 0, frequency: "monthly", mode: "period" });
  });

  it("ensureMissingTargets is idempotent", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "weekly",
      startDate: isoDateAU(),
      notes: "",
      targets: [],
    });

    await ensureMissingTargets(budget.id, ["cat-education"]);
    await ensureMissingTargets(budget.id, ["cat-education"]);

    const updated = await getActiveBudget();
    expect(updated).not.toBeNull();
    if (!updated) throw new Error("Expected active budget");
    const educationTargets = updated.targets.filter((t) => t.categoryId === "cat-education");
    expect(educationTargets).toHaveLength(1);
    expect(educationTargets[0]?.amount).toBe(0);
    expect(educationTargets[0]?.frequency).toBe("weekly");
    expect(educationTargets[0]?.mode).toBe("period");
  });

  it("coverOverspending creates two linked transactions with matching transferGroupId", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [
        { categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly" },
        { categoryId: "cat-rates", amount: cents(120000), frequency: "quarterly" },
      ],
    });

    await coverOverspending({
      budgetId: budget.id,
      fromCategoryId: "cat-rates",
      toCategoryId: "cat-groceries",
      amount: cents(2000) as Cents,
      dateISO: "2024-02-15",
    });

    const allTxns = await getRepositories().transactions.list();
    expect(allTxns).toHaveLength(2);

    const outTxn = allTxns.find((t) => t.transferDirection === "out");
    const inTxn = allTxns.find((t) => t.transferDirection === "in");

    expect(outTxn).toBeDefined();
    expect(inTxn).toBeDefined();
    expect(outTxn?.categoryId).toBe("cat-rates");
    expect(inTxn?.categoryId).toBe("cat-groceries");
    expect(outTxn?.amount).toBe(2000);
    expect(inTxn?.amount).toBe(2000);
    expect(outTxn?.transferGroupId).toBeTruthy();
    expect(outTxn?.transferGroupId).toBe(inTxn?.transferGroupId);
    expect(outTxn?.transferPairId).toBe(inTxn?.id);
    expect(inTxn?.transferPairId).toBe(outTxn?.id);
  });

  it("coverOverspending shifts envelope balances correctly via computeEnvelopeStates", async () => {
    const catGroceries: Category = {
      id: "cat-groceries",
      name: "Groceries",
      type: "expense",
      parentId: null,
      color: "#f00",
      archived: false,
      sortOrder: 0,
    };
    const catRates: Category = {
      id: "cat-rates",
      name: "Rates",
      type: "expense",
      parentId: null,
      color: "#0f0",
      archived: false,
      sortOrder: 1,
    };

    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [
        {
          categoryId: "cat-groceries",
          amount: cents(60000), // $600/mo
          frequency: "monthly",
          mode: "envelope",
          openedAt: "2024-01-01",
        },
        {
          categoryId: "cat-rates",
          amount: cents(120000), // $1200/quarter
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2024-01-01",
        },
      ],
    });

    const computeArgs = {
      budget,
      transactions: [] as Transaction[],
      categories: [catGroceries, catRates],
      nowISO: "2024-01-31",
      viewRange: { from: "2024-01-01", to: "2024-01-31" },
      viewPeriod: "monthly" as const,
    };

    const before = computeEnvelopeStates(computeArgs);
    const beforeGroceries = before.expense.find((s) => s.categoryId === "cat-groceries");
    const beforeRates = before.expense.find((s) => s.categoryId === "cat-rates");
    if (!beforeGroceries || !beforeRates) throw new Error("Expected both envelope states");

    const coverAmount = cents(10000) as Cents; // $100
    await coverOverspending({
      budgetId: budget.id,
      fromCategoryId: "cat-rates",
      toCategoryId: "cat-groceries",
      amount: coverAmount,
      dateISO: "2024-01-31",
    });

    const txns = await getRepositories().transactions.list();
    const after = computeEnvelopeStates({ ...computeArgs, transactions: txns });
    const afterGroceries = after.expense.find((s) => s.categoryId === "cat-groceries");
    const afterRates = after.expense.find((s) => s.categoryId === "cat-rates");
    if (!afterGroceries || !afterRates)
      throw new Error("Expected both envelope states after cover");

    expect(afterRates.balance).toBe((beforeRates.balance - coverAmount) as Cents);
    expect(afterGroceries.balance).toBe((beforeGroceries.balance + coverAmount) as Cents);
  });

  it("coverOverspending throws if amount is zero or negative", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [
        { categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly" },
        { categoryId: "cat-rates", amount: cents(120000), frequency: "quarterly" },
      ],
    });

    await expect(
      coverOverspending({
        budgetId: budget.id,
        fromCategoryId: "cat-rates",
        toCategoryId: "cat-groceries",
        amount: 0 as Cents,
        dateISO: "2024-01-15",
      }),
    ).rejects.toThrow("Amount must be positive");

    await expect(
      coverOverspending({
        budgetId: budget.id,
        fromCategoryId: "cat-rates",
        toCategoryId: "cat-groceries",
        amount: -500 as Cents,
        dateISO: "2024-01-15",
      }),
    ).rejects.toThrow("Amount must be positive");
  });

  it("coverOverspending throws if category is not in budget", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [{ categoryId: "cat-groceries", amount: cents(60000), frequency: "monthly" }],
    });

    await expect(
      coverOverspending({
        budgetId: budget.id,
        fromCategoryId: "nonexistent",
        toCategoryId: "cat-groceries",
        amount: cents(1000) as Cents,
        dateISO: "2024-01-15",
      }),
    ).rejects.toThrow("not found in budget");

    await expect(
      coverOverspending({
        budgetId: budget.id,
        fromCategoryId: "cat-groceries",
        toCategoryId: "nonexistent",
        amount: cents(1000) as Cents,
        dateISO: "2024-01-15",
      }),
    ).rejects.toThrow("not found in budget");
  });

  it("setTarget preserves existing mode and openedAt when not provided", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: "2024-01-01",
      notes: "",
      targets: [
        {
          categoryId: "cat-rates",
          amount: 1200_00,
          frequency: "quarterly",
          mode: "envelope",
          openedAt: "2023-06-01",
        },
      ],
    });
    await setTarget({
      budgetId: budget.id,
      categoryId: "cat-rates",
      amount: 1500,
      frequency: "quarterly",
    });
    const updated = await getActiveBudget();
    const rates = updated?.targets.find((t) => t.categoryId === "cat-rates");
    expect(rates?.mode).toBe("envelope");
    expect(rates?.openedAt).toBe("2023-06-01");
    expect(rates?.amount).toBe(1500);
  });
});
