import type { BudgetBucket, BudgetFrequency } from "@budgy/engine";
import { type CategoryState, newId } from "./budgetState";

/**
 * Starter lists for the budget planner. Choosing one adds these named lines at
 * $0, with how often they're usually billed. People fill in the amounts.
 * Everything a template says lives here.
 */

type Line = [label: string, per: BudgetFrequency];
type Group = [name: string, bucket: BudgetBucket, lines: Line[]];

export interface BudgetTemplate {
  id: "rent" | "own" | "share";
  title: string;
  blurb: string;
  groups: Group[];
}

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: "rent",
    title: "Renting",
    blurb: "Rent, contents insurance, and the usual bills.",
    groups: [
      [
        "Home",
        "need",
        [
          ["Rent", "week"],
          ["Contents insurance", "year"],
        ],
      ],
      [
        "Bills",
        "need",
        [
          ["Power and gas", "quarter"],
          ["Water usage", "quarter"],
          ["Phone and internet", "month"],
        ],
      ],
      ["Groceries", "need", [["Groceries", "week"]]],
      [
        "Transport",
        "need",
        [
          ["Transport or fuel", "week"],
          ["Car rego and insurance", "year"],
        ],
      ],
      ["Health", "need", [["Health insurance", "month"]]],
      ["Lifestyle", "want", [["Subscriptions", "month"]]],
    ],
  },
  {
    id: "own",
    title: "Paying off a home",
    blurb: "Mortgage, council and water rates, building insurance.",
    groups: [
      [
        "Home",
        "need",
        [
          ["Mortgage repayment", "month"],
          ["Council rates", "quarter"],
          ["Water rates and usage", "quarter"],
          ["Home and contents insurance", "year"],
          ["Strata or body corporate", "quarter"],
          ["Repairs and upkeep", "year"],
        ],
      ],
      [
        "Bills",
        "need",
        [
          ["Power and gas", "quarter"],
          ["Phone and internet", "month"],
        ],
      ],
      ["Groceries", "need", [["Groceries", "week"]]],
      ["Transport", "need", [["Transport or fuel", "week"]]],
    ],
  },
  {
    id: "share",
    title: "Share house",
    blurb: "Your share of rent and bills, split with housemates.",
    groups: [
      [
        "Home",
        "need",
        [
          ["Your share of rent", "week"],
          ["Contents insurance", "year"],
        ],
      ],
      [
        "Bills",
        "need",
        [
          ["Your share of power", "quarter"],
          ["Your share of internet", "month"],
          ["Phone", "month"],
        ],
      ],
      ["Groceries", "need", [["Groceries", "week"]]],
      ["Transport", "need", [["Public transport", "week"]]],
      [
        "Lifestyle",
        "want",
        [
          ["Eating out", "week"],
          ["Subscriptions", "month"],
        ],
      ],
      ["Savings", "save", [["Savings", "month"]]],
    ],
  },
];

export const templateLineCount = (t: BudgetTemplate) =>
  t.groups.reduce((n, g) => n + g[2].length, 0);

/** A template's lines as budget categories, all at $0. */
export function templateCategories(t: BudgetTemplate): CategoryState[] {
  return t.groups.map(([name, bucket, lines]) => ({
    id: newId("c"),
    name,
    bucket,
    lines: lines.map(([label, per]) => ({ id: newId("l"), label, amount: 0, per })),
  }));
}

/** True when the budget has nothing in it yet: no line has an amount. */
export const budgetIsEmpty = (categories: CategoryState[]) =>
  categories.every((c) => c.lines.every((l) => l.amount === 0));
