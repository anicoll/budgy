import { describe, expect, it } from "vitest";
import { addMonths } from "../dates";
import { cents } from "../money/cents";
import {
  breakEvenVariableRate,
  compareFixedVsVariable,
  estimateBreakCost,
  type FixedVsVariableInput,
  presetPath,
  rateOn,
} from "./fixed";
import { simulateLoan } from "./simulate";

const LOAN = {
  balance: cents(60_000_000), // $600,000
  annualRate: 0.0599,
  termMonths: 300,
  startDate: "2026-11-15",
  frequency: "monthly" as const,
};

const BASE: FixedVsVariableInput = {
  loan: LOAN,
  fixedRate: 0.0569,
  fixedMonths: 36,
  fixedShare: 0.5,
};

describe("compareFixedVsVariable", () => {
  it("fixing at the variable rate with rates holding changes nothing over the fix", () => {
    const r = compareFixedVsVariable({ ...BASE, fixedRate: LOAN.annualRate, fixedShare: 1 });
    expect(r.aheadFixedPeriod).toBe(0);
    expect(r.timeline.slice(0, 37).every((p) => p.ahead === 0)).toBe(true);
    // The lender recalculates the minimum when the fix ends, which nudges the
    // repayment up by a few dollars. That's all that's left over the loan.
    expect(Math.abs(r.aheadLifetime)).toBeLessThan(r.variable.totalInterest * 0.005);
  });

  it("a split adds up to the whole loan", () => {
    const r = compareFixedVsVariable(BASE);
    expect((r.fixedInput?.balance ?? 0) + (r.floatingInput?.balance ?? 0)).toBe(LOAN.balance);
    expect(r.planBalances[0].balance).toBe(LOAN.balance);
    expect(r.planTotalInterest).toBe(
      (r.fixed?.totalInterest ?? 0) + (r.floating?.totalInterest ?? 0),
    );
  });

  it("nothing fixed is the variable loan", () => {
    const r = compareFixedVsVariable({ ...BASE, fixedShare: 0 });
    expect(r.fixed).toBeNull();
    expect(r.aheadLifetime).toBe(0);
    expect(r.timeline.every((p) => p.ahead === 0)).toBe(true);
  });

  it("a lower fixed rate is ahead over the fixed period when rates hold", () => {
    const r = compareFixedVsVariable({ ...BASE, fixedShare: 1 });
    // 0.3% on ~$590k average for 3 years: about $5,300.
    expect(r.aheadFixedPeriod).toBeGreaterThan(cents(450_000));
    expect(r.aheadFixedPeriod).toBeLessThan(cents(600_000));
    // Half fixed saves about half as much.
    const half = compareFixedVsVariable(BASE);
    expect(half.aheadFixedPeriod / r.aheadFixedPeriod).toBeCloseTo(0.5, 1);
  });

  it("fixing loses when rates fall below the fixed rate", () => {
    const loan = { ...LOAN, rateChanges: presetPath("fall-1", LOAN.startDate, LOAN.annualRate) };
    const r = compareFixedVsVariable({ ...BASE, loan, fixedShare: 1 });
    expect(r.aheadFixedPeriod).toBeLessThan(0);
  });

  it("the fixed part reverts to the path plus the margin when the fix ends", () => {
    const loan = { ...LOAN, rateChanges: presetPath("rise-1", LOAN.startDate, LOAN.annualRate) };
    const r = compareFixedVsVariable({ ...BASE, loan, revertMargin: 0.005 });
    expect(r.fixedEndDate).toBe(addMonths(LOAN.startDate, 36));
    expect(r.revertRate).toBeCloseTo(0.0599 + 0.01 + 0.005, 6);
    const revert = r.fixed?.events.find((e) => e.type === "rate-change");
    expect(revert?.date).toBe(r.fixedEndDate);
  });

  it("after the fix ends with no margin, both run at the same rate", () => {
    const r = compareFixedVsVariable({ ...BASE, fixedShare: 1 });
    // The gap stops growing (much) once the fix ends: the rest is the smaller balance.
    const atEnd = r.timeline[36].ahead;
    const later = r.timeline[48].ahead;
    expect(later - atEnd).toBeLessThan(cents(50_000));
  });

  it("extras and offset go on the variable part of a split", () => {
    const loan = { ...LOAN, extraPerPeriod: cents(50_000), offsetBalance: cents(2_000_000) };
    const r = compareFixedVsVariable({ ...BASE, loan });
    expect(r.fixedInput?.extraPerPeriod).toBeUndefined();
    expect(r.fixedInput?.offsetBalance).toBeUndefined();
    expect(r.floatingInput?.extraPerPeriod).toBe(cents(50_000));
    expect(r.floatingInput?.offsetBalance).toBe(cents(2_000_000));
    expect(r.warnings).toEqual([]);
  });

  it("warns when fully fixed with an offset or extras", () => {
    const loan = { ...LOAN, extraPerPeriod: cents(50_000), offsetBalance: cents(2_000_000) };
    const r = compareFixedVsVariable({ ...BASE, loan, fixedShare: 1 });
    expect(r.warnings).toHaveLength(2);
    expect(r.fixedInput?.extraPerPeriod).toBe(cents(50_000));
  });

  it("matches a plain simulation for the variable side", () => {
    const loan = { ...LOAN, rateChanges: presetPath("rise-2", LOAN.startDate, LOAN.annualRate) };
    const r = compareFixedVsVariable({ ...BASE, loan });
    expect(r.variable.totalInterest).toBe(simulateLoan(loan).totalInterest);
  });

  it("says when fully fixed extras go over the usual yearly cap", () => {
    const over = compareFixedVsVariable({
      ...BASE,
      fixedShare: 1,
      loan: { ...LOAN, extraPerPeriod: cents(100_000) },
    });
    expect(over.warnings.join(" ")).toMatch(/add up to \$12,000 a year/);
    const under = compareFixedVsVariable({
      ...BASE,
      fixedShare: 1,
      loan: { ...LOAN, extraPerPeriod: cents(50_000) },
    });
    expect(under.warnings.join(" ")).toMatch(/Check your lender's limit/);
  });

  it("counts a fixing fee against the plan, from day one", () => {
    const plain = compareFixedVsVariable(BASE);
    const r = compareFixedVsVariable({ ...BASE, fixingFee: cents(75_000) });
    expect(r.fixingFee).toBe(75_000);
    expect(r.aheadFixedPeriod).toBe(plain.aheadFixedPeriod - 75_000);
    expect(r.aheadLifetime).toBe(plain.aheadLifetime - 75_000);
    expect(r.timeline[0].ahead).toBe(-75_000);
    expect(breakEvenVariableRate({ ...BASE, fixingFee: cents(75_000) })).toBeGreaterThan(
      breakEvenVariableRate(BASE) as number,
    );
  });

  it("charges no fixing fee when nothing is fixed", () => {
    const r = compareFixedVsVariable({ ...BASE, fixedShare: 0, fixingFee: cents(75_000) });
    expect(r.fixingFee).toBe(0);
    expect(r.aheadLifetime).toBe(0);
  });

  it("rejects bad input", () => {
    expect(() => compareFixedVsVariable({ ...BASE, fixedShare: 1.5 })).toThrow(RangeError);
    expect(() => compareFixedVsVariable({ ...BASE, fixedMonths: 0 })).toThrow(RangeError);
    expect(() => compareFixedVsVariable({ ...BASE, fixingFee: cents(-1) })).toThrow(RangeError);
  });
});

describe("breakEvenVariableRate", () => {
  it("is about the fixed rate", () => {
    const be = breakEvenVariableRate(BASE) as number;
    // With rates flat, break-even sits right at the fixed rate.
    expect(be).toBeGreaterThanOrEqual(0.0568);
    expect(be).toBeLessThanOrEqual(0.0571);
  });

  it("is null with nothing fixed", () => {
    expect(breakEvenVariableRate({ ...BASE, fixedShare: 0 })).toBeNull();
  });
});

describe("estimateBreakCost", () => {
  it("is zero when rates have risen", () => {
    expect(estimateBreakCost(cents(50_000_000), 0.055, 0.06, 24)).toBe(0);
  });

  it("is roughly the rate gap on the balance for the time left", () => {
    // 1% on $500k for 2 years is $10,000 before discounting.
    const c = estimateBreakCost(cents(50_000_000), 0.06, 0.05, 24);
    expect(c).toBeGreaterThan(cents(900_000));
    expect(c).toBeLessThan(cents(1_000_000));
  });
});

describe("rate paths", () => {
  it("presets step off today's rate", () => {
    const path = presetPath("rise-1", "2026-11-15", 0.06);
    expect(path).toHaveLength(4);
    expect(path[3]).toEqual({ date: "2027-11-15", annualRate: 0.07 });
    expect(presetPath("fall-1", "2026-11-15", 0.005).at(-1)?.annualRate).toBe(0);
  });

  it("rateOn follows the path", () => {
    const loan = { annualRate: 0.06, rateChanges: presetPath("rise-1", "2026-11-15", 0.06) };
    expect(rateOn(loan, "2026-11-15")).toBe(0.06);
    expect(rateOn(loan, "2027-02-15")).toBe(0.0625);
    expect(rateOn(loan, "2030-01-01")).toBe(0.07);
  });
});
