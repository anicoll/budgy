import { planBudget } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import { defaultBudgetState, toBudgetInput } from "./budgetState";
import {
  BUDGET_TEMPLATES,
  budgetIsEmpty,
  templateCategories,
  templateLineCount,
} from "./budgetTemplates";

describe("budget templates", () => {
  it("offers renting, owning and a share house", () => {
    expect(BUDGET_TEMPLATES.map((t) => t.title)).toEqual([
      "Renting",
      "Paying off a home",
      "Share house",
    ]);
  });

  it("builds named lines at $0 that plan cleanly", () => {
    for (const t of BUDGET_TEMPLATES) {
      const cats = templateCategories(t);
      const lines = cats.flatMap((c) => c.lines);
      expect(lines).toHaveLength(templateLineCount(t));
      expect(lines.every((l) => l.amount === 0 && l.label)).toBe(true);
      expect(budgetIsEmpty(cats)).toBe(true);
      const s = { ...defaultBudgetState("2026-11-04"), categories: cats };
      expect(planBudget(toBudgetInput(s)).spendYear).toBe(0);
    }
  });

  it("keeps the stated frequencies", () => {
    const rent = templateCategories(BUDGET_TEMPLATES[0]).flatMap((c) => c.lines);
    expect(rent.find((l) => l.label === "Power and gas")?.per).toBe("quarter");
    expect(rent.find((l) => l.label === "Contents insurance")?.per).toBe("year");
  });

  it("is not empty once an amount is entered", () => {
    const cats = templateCategories(BUDGET_TEMPLATES[1]);
    cats[0].lines[0].amount = 2_000;
    expect(budgetIsEmpty(cats)).toBe(false);
  });
});
