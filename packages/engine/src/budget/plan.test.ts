import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calculatePay } from "../tax/pay";
import {
  annualise,
  apportion,
  type BudgetInput,
  budgetForView,
  perView,
  planBudget,
  validateBudget,
} from "./plan";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

// The household in the mockups: two salaries and nine categories.
const household = (): BudgetInput => ({
  income: [
    { id: "sam", label: "Sam", kind: "salary", pay: { year: "2026-27", salary: c(95_000) } },
    { id: "alex", label: "Alex", kind: "salary", pay: { year: "2026-27", salary: c(72_000) } },
  ],
  categories: [
    {
      id: "home",
      name: "Home",
      bucket: "need",
      lines: [
        { id: "mortgage", label: "Mortgage repayments", amount: c(3_450), frequency: "month" },
        { id: "rates", label: "Council rates", amount: c(2_100), frequency: "year" },
        { id: "insurance", label: "Home and contents", amount: c(1_800), frequency: "year" },
      ],
    },
    {
      id: "bills",
      name: "Bills",
      bucket: "need",
      lines: [
        { id: "power", label: "Electricity and gas", amount: c(540), frequency: "quarter" },
        { id: "water", label: "Water", amount: c(285), frequency: "quarter" },
        { id: "internet", label: "Internet", amount: c(85), frequency: "month" },
        { id: "phones", label: "Phones", amount: c(90), frequency: "month" },
      ],
    },
    {
      id: "food",
      name: "Groceries",
      bucket: "need",
      lines: [{ id: "shop", label: "Supermarket", amount: c(300), frequency: "week" }],
    },
    {
      id: "transport",
      name: "Transport",
      bucket: "need",
      lines: [
        { id: "fuel", label: "Fuel", amount: c(60), frequency: "week" },
        { id: "rego", label: "Rego and car insurance", amount: c(2_280), frequency: "year" },
      ],
    },
    {
      id: "kids",
      name: "Kids",
      bucket: "need",
      lines: [
        { id: "care", label: "Childcare", amount: c(900), frequency: "month" },
        { id: "school", label: "School and activities", amount: c(1_800), frequency: "year" },
      ],
    },
    {
      id: "health",
      name: "Health",
      bucket: "need",
      lines: [{ id: "phi", label: "Private health", amount: c(340), frequency: "month" }],
    },
    {
      id: "debts",
      name: "Debts",
      bucket: "need",
      lines: [
        { id: "card", label: "Credit card", amount: c(200), frequency: "month" },
        { id: "car", label: "Car loan", amount: c(240), frequency: "fortnight" },
      ],
    },
    {
      id: "life",
      name: "Lifestyle",
      bucket: "want",
      lines: [
        { id: "eat", label: "Eating out", amount: c(350), frequency: "month" },
        { id: "subs", label: "Subscriptions", amount: c(65), frequency: "month" },
        { id: "hols", label: "Holidays", amount: c(4_800), frequency: "year" },
        { id: "gifts", label: "Gifts", amount: c(1_200), frequency: "year" },
      ],
    },
    {
      id: "save",
      name: "Savings",
      bucket: "save",
      lines: [{ id: "emergency", label: "Emergency fund", amount: c(500), frequency: "month" }],
    },
  ],
});

describe("annualise and perView", () => {
  it("turns each frequency into a year exactly", () => {
    expect(annualise(c(300), "week")).toBe(c(15_600));
    expect(annualise(c(240), "fortnight")).toBe(c(6_240));
    expect(annualise(c(85), "month")).toBe(c(1_020));
    expect(annualise(c(540), "quarter")).toBe(c(2_160));
    expect(annualise(c(2_100), "year")).toBe(c(2_100));
  });

  it("spreads a year over a period to the nearest cent", () => {
    expect(perView(c(15_600), "month")).toBe(c(1_300));
    expect(perView(c(1_000), "week")).toBe(1923 as Cents); // $19.2307…
    expect(perView(c(1_000), "fortnight")).toBe(3846 as Cents);
    expect(perView(c(1_000), "year")).toBe(c(1_000));
  });
});

describe("planBudget", () => {
  it("takes salaries through the pay calculator", () => {
    const r = planBudget(household());
    const sam = calculatePay({ year: "2026-27", salary: c(95_000) }).net;
    const alex = calculatePay({ year: "2026-27", salary: c(72_000) }).net;
    expect(r.income.map((s) => s.year)).toEqual([sam, alex]);
    expect(r.incomeYear).toBe(sam + alex);
    expect(r.income[0].pay?.net).toBe(sam);
  });

  it("adds up the mockup household to the cent", () => {
    const r = planBudget(household());
    expect(r.incomeYear).toBe(c(132_520));
    expect(r.spendYear).toBe(c(114_000));
    expect(r.leftYear).toBe(c(18_520));
    expect(r.categories.find((x) => x.id === "home")?.year).toBe(c(45_300));
    expect(r.buckets).toEqual({ need: c(97_020), want: c(10_980), save: c(6_000) });
    expect(budgetForView(r, "month")).toEqual({
      income: c(11_043.34), // $6,173.34 + $4,870.00, as the pay calculator shows them
      spend: c(9_500),
      left: c(1_543.34),
    });
    expect(budgetForView(r, "year")).toEqual({
      income: c(132_520),
      spend: c(114_000),
      left: c(18_520),
    });
  });

  it("finds the lumpy bills and what to set aside for them", () => {
    const r = planBudget(household());
    expect(r.lumpyBills.map((l) => l.id)).toEqual([
      "hols",
      "rego",
      "power",
      "rates",
      "insurance",
      "school",
      "gifts",
      "water",
    ]);
    // 4,800 + 2,280 + 2,160 + 2,100 + 1,800 + 1,800 + 1,200 + 1,140 = 17,280 a year
    expect(r.lumpyPerMonth).toBe(c(1_440));
  });

  it("splits each $100 into whole dollars that add to 100", () => {
    const r = planBudget(household());
    const d = r.perHundred;
    expect(d).not.toBeNull();
    expect(d?.reduce((t, x) => t + x.dollars, 0)).toBe(100);
    expect(d?.find((x) => x.id === "home")?.dollars).toBe(34);
    expect(d?.find((x) => x.id === "left")?.dollars).toBe(14);
  });

  it("uses take-home and other income as entered", () => {
    const r = planBudget({
      income: [
        { id: "a", label: "Take-home", kind: "amount", amount: c(2_500), frequency: "fortnight" },
        {
          id: "b",
          label: "Rent from the granny flat",
          kind: "amount",
          amount: c(350),
          frequency: "week",
        },
      ],
      categories: [],
    });
    expect(r.incomeYear).toBe(c(65_000 + 18_200));
    expect(r.leftYear).toBe(r.incomeYear);
    expect(r.perHundred).toEqual([{ id: "left", dollars: 100 }]);
  });

  it("shows a shortfall as negative left over, with no $100 split", () => {
    const r = planBudget({
      income: [{ id: "a", label: "Pay", kind: "amount", amount: c(1_000), frequency: "week" }],
      categories: [
        {
          id: "home",
          name: "Home",
          bucket: "need",
          lines: [{ id: "rent", label: "Rent", amount: c(1_200), frequency: "week" }],
        },
      ],
    });
    expect(r.leftYear).toBe(c(-10_400));
    expect(r.categories[0].share).toBeCloseTo(1.2);
    expect(r.perHundred).toBeNull();
    expect(budgetForView(r, "week").left).toBe(c(-200));
  });

  it("copes with nothing entered", () => {
    const r = planBudget({ income: [], categories: [] });
    expect(r.incomeYear).toBe(0);
    expect(r.leftYear).toBe(0);
    expect(r.perHundred).toBeNull();
    expect(r.lumpyPerMonth).toBe(0);
  });
});

describe("validateBudget", () => {
  it("rejects bad amounts and frequencies", () => {
    const bad = household();
    bad.categories[0].lines[0].amount = -1 as Cents;
    bad.categories[1].lines[0].frequency = "daily" as never;
    bad.income[0] = {
      id: "x",
      label: "Sam",
      kind: "salary",
      pay: { year: "2026-27", salary: -5 as Cents },
    };
    const errors = validateBudget(bad);
    expect(errors).toHaveLength(3);
    expect(() => planBudget(bad)).toThrow(RangeError);
  });

  it("accepts the household", () => {
    expect(validateBudget(household())).toEqual([]);
  });
});

describe("apportion", () => {
  it("adds to the total and breaks ties by order", () => {
    expect(apportion([1, 1, 1], 100)).toEqual([34, 33, 33]);
    expect(apportion([0, 0], 100)).toEqual([0, 0]);
    expect(apportion([2, 1], 3)).toEqual([2, 1]);
  });
});
