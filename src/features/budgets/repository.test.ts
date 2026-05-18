import { beforeEach, describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import { listTransactions } from "@/features/transactions/repository";
import { isoDateAU } from "@/lib/date/au-locale";
import type { Cents } from "@/lib/money/cents";
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

  describe("coverOverspending", () => {
    const FROM_CAT_ID = "cat-insurance";
    const TO_CAT_ID = "cat-rates";
    const OPEN_DATE = "2024-01-01";
    const NOW = "2024-01-31"; // 30 days → fundedBetween = 100_00 for monthly/100_00 target

    async function seedCategoriesAndBudget() {
      const repo = getRepositories();
      const fromCat: Category = {
        id: FROM_CAT_ID,
        name: "Insurance",
        type: "expense",
        parentId: null,
        sortOrder: 0,
        color: "#aaa",
        archived: false,
      };
      const toCat: Category = {
        id: TO_CAT_ID,
        name: "Rates",
        type: "expense",
        parentId: null,
        sortOrder: 1,
        color: "#bbb",
        archived: false,
      };
      await repo.categories.upsert(fromCat);
      await repo.categories.upsert(toCat);

      const budget = await createBudget({
        name: "Budget",
        period: "monthly",
        startDate: OPEN_DATE,
        notes: "",
        targets: [
          {
            categoryId: FROM_CAT_ID,
            amount: 100_00,
            frequency: "monthly",
            mode: "envelope",
            openedAt: OPEN_DATE,
          },
          {
            categoryId: TO_CAT_ID,
            amount: 100_00,
            frequency: "monthly",
            mode: "envelope",
            openedAt: OPEN_DATE,
          },
        ],
      });

      // Add a spend on the to-category so it's overspent (150 spent vs 100 funded).
      await repo.transactions.upsert({
        id: "txn-spend",
        accountId: "acct-1",
        date: "2024-01-15",
        amount: 150_00 as Cents,
        type: "debit",
        categoryId: TO_CAT_ID,
        tags: [],
        cleared: true,
        createdAt: OPEN_DATE,
        updatedAt: OPEN_DATE,
      });

      return budget;
    }

    it("creates two linked transactions with matching transferGroupId", async () => {
      const budget = await seedCategoriesAndBudget();

      await coverOverspending({
        budgetId: budget.id,
        fromCategoryId: FROM_CAT_ID,
        toCategoryId: TO_CAT_ID,
        amount: 50_00 as Cents,
        dateISO: "2024-01-20",
      });

      const txns = await listTransactions();
      const covers = txns.filter((t) => t.payee === "Envelope cover");
      expect(covers).toHaveLength(2);

      const out = covers.find((t) => t.transferDirection === "out");
      const inp = covers.find((t) => t.transferDirection === "in");
      if (!out || !inp) throw new Error("Expected cover transactions");
      expect(out.transferGroupId).toBeTruthy();
      expect(out.transferGroupId).toBe(inp.transferGroupId);
      expect(out.categoryId).toBe(FROM_CAT_ID);
      expect(inp.categoryId).toBe(TO_CAT_ID);
      expect(out.amount).toBe(50_00);
      expect(inp.amount).toBe(50_00);
    });

    it("from envelope balance decreases and to envelope balance increases", async () => {
      const budget = await seedCategoriesAndBudget();
      const repo = getRepositories();
      const categories = await repo.categories.list();
      const viewRange = { from: OPEN_DATE, to: NOW };

      const txnsBefore = await listTransactions();
      const beforeBundle = computeEnvelopeStates({
        budget,
        transactions: txnsBefore,
        categories,
        nowISO: NOW,
        viewRange,
        viewPeriod: "monthly",
      });
      const fromBefore = [...beforeBundle.income, ...beforeBundle.expense].find(
        (s) => s.categoryId === FROM_CAT_ID,
      );
      const toBefore = [...beforeBundle.income, ...beforeBundle.expense].find(
        (s) => s.categoryId === TO_CAT_ID,
      );
      expect(fromBefore?.balance).toBe(100_00); // fully funded, unspent
      expect(toBefore?.balance).toBe(-50_00); // overspent by 50

      await coverOverspending({
        budgetId: budget.id,
        fromCategoryId: FROM_CAT_ID,
        toCategoryId: TO_CAT_ID,
        amount: 50_00 as Cents,
        dateISO: "2024-01-20",
      });

      const txnsAfter = await listTransactions();
      const afterBundle = computeEnvelopeStates({
        budget,
        transactions: txnsAfter,
        categories,
        nowISO: NOW,
        viewRange,
        viewPeriod: "monthly",
      });
      const fromAfter = [...afterBundle.income, ...afterBundle.expense].find(
        (s) => s.categoryId === FROM_CAT_ID,
      );
      const toAfter = [...afterBundle.income, ...afterBundle.expense].find(
        (s) => s.categoryId === TO_CAT_ID,
      );
      expect(fromAfter?.balance).toBe(50_00); // decreased by 50
      expect(toAfter?.balance).toBe(0); // increased by 50 → no longer overspent
    });

    it("throws when amount is zero or negative", async () => {
      const budget = await seedCategoriesAndBudget();
      await expect(
        coverOverspending({
          budgetId: budget.id,
          fromCategoryId: FROM_CAT_ID,
          toCategoryId: TO_CAT_ID,
          amount: 0 as Cents,
          dateISO: "2024-01-20",
        }),
      ).rejects.toThrow("Amount must be positive");

      await expect(
        coverOverspending({
          budgetId: budget.id,
          fromCategoryId: FROM_CAT_ID,
          toCategoryId: TO_CAT_ID,
          amount: -10 as Cents,
          dateISO: "2024-01-20",
        }),
      ).rejects.toThrow("Amount must be positive");
    });

    it("throws when fromCategoryId is not a budget target", async () => {
      const budget = await seedCategoriesAndBudget();
      await expect(
        coverOverspending({
          budgetId: budget.id,
          fromCategoryId: "cat-nonexistent",
          toCategoryId: TO_CAT_ID,
          amount: 50_00 as Cents,
          dateISO: "2024-01-20",
        }),
      ).rejects.toThrow();
    });

    it("throws when toCategoryId is not a budget target", async () => {
      const budget = await seedCategoriesAndBudget();
      await expect(
        coverOverspending({
          budgetId: budget.id,
          fromCategoryId: FROM_CAT_ID,
          toCategoryId: "cat-nonexistent",
          amount: 50_00 as Cents,
          dateISO: "2024-01-20",
        }),
      ).rejects.toThrow();
    });
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
