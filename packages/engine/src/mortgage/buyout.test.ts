import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calculateBuyOut, validateBuyOut } from "./buyout";
import { pmt } from "./simulate";

const c = (d: number) => Math.round(d * 100) as Cents;
const base = {
  value: c(820_000),
  loanOwing: c(480_000),
  leaverSharePct: 45,
  annualRate: 0.06,
  termMonths: 300,
};

describe("calculateBuyOut", () => {
  it("pays the leaver their share of the equity", () => {
    const r = calculateBuyOut(base);
    expect(r.equity).toBe(c(340_000));
    expect(r.payout).toBe(c(153_000));
    expect(r.newLoan).toBe(c(633_000));
    expect(r.repayment).toBe(pmt(c(633_000), 0.005, 300));
    expect(r.frequency).toBe("monthly");
    expect(r.underwater).toBe(false);
  });
  it("floors equity at zero when the loan is bigger than the home", () => {
    const r = calculateBuyOut({ ...base, value: c(400_000) });
    expect(r.equity).toBe(0);
    expect(r.payout).toBe(0);
    expect(r.newLoan).toBe(c(480_000));
    expect(r.underwater).toBe(true);
  });
  it("handles 0% and 100% shares", () => {
    expect(calculateBuyOut({ ...base, leaverSharePct: 0 }).payout).toBe(0);
    expect(calculateBuyOut({ ...base, leaverSharePct: 100 }).payout).toBe(c(340_000));
  });
  it("repays per period at the tool's frequency", () => {
    const m = calculateBuyOut(base).repayment;
    const f = calculateBuyOut({ ...base, frequency: "fortnightly" }).repayment;
    expect(f).toBe(Math.ceil(m / 2));
  });
  it("has only the payout to borrow with no loan owing", () => {
    const r = calculateBuyOut({ ...base, loanOwing: 0 as Cents });
    expect(r.newLoan).toBe(r.payout);
  });
  it("rejects bad inputs", () => {
    expect(validateBuyOut({ ...base, leaverSharePct: 101 })).toHaveLength(1);
    expect(validateBuyOut({ ...base, value: 0 as Cents })).toHaveLength(1);
    expect(validateBuyOut({ ...base, termMonths: 0 })).toHaveLength(1);
    expect(() => calculateBuyOut({ ...base, annualRate: 0.5 })).toThrow(RangeError);
    expect(validateBuyOut(base)).toEqual([]);
  });
});
