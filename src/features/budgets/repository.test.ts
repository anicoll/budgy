import { beforeEach, describe, expect, it } from "vitest";
import { isoDateAU } from "@/lib/date/au-locale";
import { resetRepositoriesForTests } from "@/lib/storage";
import { resetDBForTests } from "@/lib/storage/db";
import { createBudget, ensureMissingTargets, getActiveBudget, setTarget } from "./repository";

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
