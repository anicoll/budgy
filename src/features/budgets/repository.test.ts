import { beforeEach, describe, expect, it } from "vitest";
import { isoDateAU } from "@/lib/date/au-locale";
import { resetRepositoriesForTests } from "@/lib/storage";
import { resetDBForTests } from "@/lib/storage/db";
import { createBudget, ensureMissingTargets, getActiveBudgetNormalised } from "./repository";

beforeEach(async () => {
  resetRepositoriesForTests();
  resetDBForTests();
  const { getDB } = await import("@/lib/storage/db");
  await getDB().delete();
  resetDBForTests();
});

describe("budgets repository", () => {
  it("ensureMissingTargets appends only missing category ids", async () => {
    const budget = await createBudget({
      name: "Budget",
      period: "monthly",
      startDate: isoDateAU(),
      notes: "",
      targets: [
        {
          categoryId: "cat-groceries",
          amount: 125_00,
          frequency: "monthly",
          rollover: true,
        },
      ],
    });

    await ensureMissingTargets(budget.id, [
      "cat-groceries",
      "cat-education",
      "cat-health",
      "cat-education",
    ]);

    const updated = await getActiveBudgetNormalised();
    expect(updated).not.toBeNull();
    if (!updated) throw new Error("Expected active budget");
    expect(updated.targets).toHaveLength(3);

    const groceries = updated.targets.find((t) => t.categoryId === "cat-groceries");
    expect(groceries?.amount).toBe(125_00);
    expect(groceries?.frequency).toBe("monthly");
    expect(groceries?.rollover).toBe(true);

    const education = updated.targets.find((t) => t.categoryId === "cat-education");
    const health = updated.targets.find((t) => t.categoryId === "cat-health");
    expect(education).toMatchObject({
      amount: 0,
      frequency: "monthly",
      rollover: false,
    });
    expect(health).toMatchObject({
      amount: 0,
      frequency: "monthly",
      rollover: false,
    });
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

    const updated = await getActiveBudgetNormalised();
    expect(updated).not.toBeNull();
    if (!updated) throw new Error("Expected active budget");
    const educationTargets = updated.targets.filter((t) => t.categoryId === "cat-education");
    expect(educationTargets).toHaveLength(1);
    expect(educationTargets[0]?.amount).toBe(0);
    expect(educationTargets[0]?.frequency).toBe("weekly");
    expect(educationTargets[0]?.rollover).toBe(false);
  });
});
