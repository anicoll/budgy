import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  type ConsolidationLoan,
  compareConsolidation,
  loanRepayment,
  validateConsolidation,
  withConsolidationLoan,
} from "./consolidate";
import type { Debt, PayoffInput } from "./payoff";

const c = (d: number) => Math.round(d * 100) as Cents;
const card: Debt = {
  id: "card",
  name: "Card",
  balance: c(5_000),
  annualRate: 0.2099,
  minimum: { type: "percent", percent: 0.02, floor: c(25) },
};
const store: Debt = {
  id: "store",
  name: "Store card",
  balance: c(3_000),
  annualRate: 0.2499,
  minimum: { type: "percent", percent: 0.03, floor: c(30) },
};
const car: Debt = {
  id: "car",
  name: "Car",
  balance: c(10_000),
  annualRate: 0.08,
  minimum: { type: "fixed", amount: c(300) },
};
const input: PayoffInput = {
  debts: [card, store, car],
  extraPerMonth: c(0),
  strategy: "avalanche",
  startDate: "2026-11-04",
};
const loan: ConsolidationLoan = {
  from: ["card", "store"],
  name: "Personal loan",
  annualRate: 0.099,
  termMonths: 36,
  upfrontFee: c(300),
};

describe("loanRepayment", () => {
  it("matches the standard repayment formula, rounded up", () => {
    expect(loanRepayment(c(10_000), 0.12, 12)).toBe(88_849);
    expect(loanRepayment(c(1_200), 0, 12)).toBe(c(100));
  });
});

describe("consolidation", () => {
  it("replaces the chosen debts with one loan holding balance plus fee", () => {
    const next = withConsolidationLoan(input, loan);
    expect(next.debts.map((d) => d.id)).toEqual(["cl-card", "car"]);
    expect(next.debts[0].balance).toBe(c(8_300));
  });

  it("clears the loan in about its term and reports cost with the fee", () => {
    const r = compareConsolidation(input, loan);
    expect(r.rolledBalance).toBe(c(8_000));
    expect(r.loanRepayment).toBe(loanRepayment(c(8_300), 0.099, 36));
    expect(r.costWithLoan).toBe(r.withLoan.totalInterest + c(300));
    expect(r.saving).toBe(r.costNow - r.costWithLoan);
    expect(r.withLoan.debts[0].months).toBe(36);
    expect(r.currentMinimums).toBe(c(100) + c(90));
    expect(r.saving).toBeGreaterThan(0);
  });

  it("shows a loss when the loan rate is higher, longer and has a fee", () => {
    const r = compareConsolidation(input, {
      ...loan,
      annualRate: 0.25,
      termMonths: 120,
      upfrontFee: c(500),
    });
    expect(r.saving).toBeLessThan(0);
  });

  it("validates", () => {
    expect(validateConsolidation(input, { ...loan, from: [] })).not.toEqual([]);
    expect(validateConsolidation(input, { ...loan, termMonths: 0 })).not.toEqual([]);
    const bnpl: Debt = {
      ...card,
      id: "b",
      annualRate: 0,
      schedule: { instalment: c(50), everyDays: 14 },
    };
    expect(
      validateConsolidation({ ...input, debts: [bnpl] }, { ...loan, from: ["b"] }),
    ).not.toEqual([]);
    expect(() => compareConsolidation(input, { ...loan, from: [] })).toThrow(RangeError);
  });
});
