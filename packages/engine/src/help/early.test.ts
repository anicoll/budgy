import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  compareHelpEarly,
  compulsoryRepayment,
  type HelpEarlyInput,
  helpRulesFor,
  indexationRateFor,
  validateHelpEarly,
} from "./early";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const base: HelpEarlyInput = {
  today: "2026-11-04",
  balance: c(30_000),
  income: c(90_000),
  incomeGrowth: 0.03,
  indexation: 0.03,
  lumpSum: c(10_000),
  alternative: "offset",
  rate: 0.06,
};
const run = (over: Partial<HelpEarlyInput> = {}) => compareHelpEarly({ ...base, ...over });

describe("indexation and thresholds", () => {
  it("uses the ATO's rates, then the assumption", () => {
    expect(indexationRateFor(2026, 0.05)).toEqual({ rate: 0.028, known: true });
    expect(indexationRateFor(2024, 0.05).rate).toBe(0.04);
    expect(indexationRateFor(2027, 0.05)).toEqual({ rate: 0.05, known: false });
  });

  it("uses published thresholds, then indexes them", () => {
    expect(helpRulesFor("2026-27", 0.03).scale).toBe(1);
    expect(helpRulesFor("2027-28", 0.03).scale).toBeCloseTo(1.03, 10);
    expect(helpRulesFor("2028-29", 0.03).scale).toBeCloseTo(1.03 ** 2, 10);
  });

  it("works out compulsory repayments at the marginal rates", () => {
    // 15% of income above $69,528 in 2026-27.
    expect(compulsoryRepayment(c(90_000), "2026-27", 0.03)).toBe(c(3_070.8));
    expect(compulsoryRepayment(c(69_528), "2026-27", 0.03)).toBe(0);
    // Indexed thresholds: the same real income repays the same real amount.
    expect(compulsoryRepayment(c(92_700), "2027-28", 0.03)).toBe(c(3_162.92));
  });
});

describe("compareHelpEarly", () => {
  it("indexes on 1 June, then credits the compulsory repayment", () => {
    const r = run();
    const [k0] = r.keep.years;
    expect(k0.year).toBe("2026-27");
    expect(k0.indexationDate).toBe("2027-06-01");
    expect(k0.rateKnown).toBe(false);
    expect(k0.indexation).toBe(c(900));
    expect(k0.compulsory).toBe(c(3_070.8));
    expect(k0.closing).toBe(c(27_829.2));
    const [p0] = r.payNow.years;
    expect(r.payNow.paidNow).toBe(c(10_000));
    expect(p0.opening).toBe(c(20_000));
    expect(p0.indexation).toBe(c(600));
    expect(p0.closing).toBe(c(17_529.2));
    expect(r.compulsoryThisYear).toBe(c(3_070.8));
  });

  it("compares both once the debt is gone in both", () => {
    const r = run();
    expect(r.keep.clearedIn).not.toBeNull();
    expect(r.payNow.clearedIn).not.toBeNull();
    expect(r.yearsSooner).toBeGreaterThan(0);
    expect(r.payNow.years.length).toBe(r.keep.years.length);
    expect(r.keep.years.at(-1)?.closing).toBe(0);
    expect(r.payNow.years.at(-1)?.closing).toBe(0);
    // Same compulsory repayments each year until pay now is clear.
    expect(r.payNow.years[0].compulsory).toBe(r.keep.years[0].compulsory);
  });

  it("keeps the money when it earns well above indexation", () => {
    const r = run({ rate: 0.06 });
    expect(r.advantage).toBeLessThan(0);
    expect(r.breakEvenRate).not.toBeNull();
    expect(r.breakEvenRate ?? 1).toBeLessThan(0.06);
  });

  it("pays the loan when the money would earn nothing", () => {
    const r = run({ rate: 0 });
    expect(r.advantage).toBeGreaterThan(0);
  });

  it("breaks even near the indexation rate for a tax-free offset", () => {
    const r = run({ incomeGrowth: 0 });
    expect(r.breakEvenRate).toBeGreaterThan(0.025);
    expect(r.breakEvenRate).toBeLessThan(0.035);
    const at = run({ incomeGrowth: 0, rate: r.breakEvenRate ?? 0 });
    expect(Math.abs(at.advantage)).toBeLessThan(c(50)); // break-even is rounded to 0.01%
  });

  it("taxes savings interest at the marginal rate", () => {
    const r = run({ alternative: "savings", rate: 0.05 });
    expect(r.taxRate).toBeCloseTo(0.32, 2); // 30% plus 2% Medicare at $90k
    expect(r.afterTaxRate).toBeCloseTo(0.05 * 0.68, 4);
    const own = run({ alternative: "savings", rate: 0.05, taxRate: 0.47 });
    expect(own.afterTaxRate).toBeCloseTo(0.05 * 0.53, 6);
    expect(run({ rate: 0.05 }).taxRate).toBe(0);
  });

  it("clears the loan today when the lump sum covers it", () => {
    const r = run({ lumpSum: c(40_000) });
    expect(r.payNow.paidNow).toBe(c(30_000));
    expect(r.payNow.clearedIn).toBe("2026-27");
    expect(r.payNow.years[0].compulsory).toBe(0);
    expect(r.payNow.years[0].indexation).toBe(0);
    expect(r.warnings).toContainEqual({ kind: "lump-sum-capped", balance: c(30_000) });
  });

  it("skips indexation that has already happened this year", () => {
    const r = run({ today: "2027-06-15" });
    expect(r.keep.years[0].year).toBe("2026-27");
    expect(r.keep.years[0].indexation).toBe(0);
    expect(r.keep.years[0].indexationDate).toBeNull();
    expect(r.keep.years[1].indexationDate).toBe("2028-06-01");
  });

  it("warns when income never reaches the threshold", () => {
    const r = run({ income: c(50_000), incomeGrowth: 0 });
    expect(r.compulsoryThisYear).toBe(0);
    expect(r.warnings.map((w) => w.kind)).toEqual(["never-repaid", "below-threshold"]);
    expect(r.keep.clearedIn).toBeNull();
    expect(r.keep.years.length).toBe(50);
  });

  it("checks the inputs", () => {
    expect(validateHelpEarly(base)).toEqual([]);
    expect(validateHelpEarly({ ...base, balance: -1 as Cents, rate: 0.9 })).toHaveLength(2);
    expect(() => run({ today: "soon" })).toThrow(RangeError);
  });
});
