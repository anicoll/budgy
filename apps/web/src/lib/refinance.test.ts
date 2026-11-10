import { compareRefinance } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  decodeRefinance,
  defaultRefinance,
  encodeRefinance,
  type RefinanceForm,
  toRefinanceInput,
} from "./refinance";

const FULL: RefinanceForm = {
  ...defaultRefinance("2026-11-04"),
  frequency: "fortnightly",
  fortnightlyMethod: "true",
  repayment: 2_100.5,
  currentFee: 395,
  offset: 12_000,
  homeValue: 720_000,
  newTermYears: 30,
  introRatePct: 5.49,
  introYears: 2,
  newFee: 0,
  cashback: 2_000,
  addCostsToLoan: true,
  repaymentChoice: "minimum",
};

describe("refinance URL state", () => {
  it("round-trips every field", () => {
    expect(decodeRefinance(encodeRefinance(FULL))).toEqual(FULL);
  });

  it("round-trips the defaults, with blank optional fields", () => {
    const d = defaultRefinance("2026-11-04");
    expect(decodeRefinance(encodeRefinance(d), defaultRefinance("2020-01-01"))).toEqual(d);
  });

  it("falls back on a missing or unknown version", () => {
    const fb = defaultRefinance("2026-11-04");
    expect(decodeRefinance("", fb)).toBe(fb);
    expect(decodeRefinance("v=99&b=1", fb)).toBe(fb);
  });

  it("ignores junk values", () => {
    const fb = defaultRefinance("2026-11-04");
    const f = decodeRefinance("v=1&b=abc&r=-3&f=zz&d=tomorrow", fb);
    expect(f.balance).toBe(fb.balance);
    expect(f.ratePct).toBe(fb.ratePct);
    expect(f.frequency).toBe(fb.frequency);
    expect(f.startDate).toBe(fb.startDate);
  });
});

describe("toRefinanceInput", () => {
  it("converts dollars and percent to cents and rates", () => {
    const i = toRefinanceInput(FULL);
    expect(i.current.balance).toBe(60_000_000);
    expect(i.current.repayment).toBe(210_050);
    expect(i.switchingCosts).toBe(95_000);
    expect(i.cashback).toBe(200_000);
    expect(i.currentAnnualFee).toBe(39_500);
    expect(i.proposed.termMonths).toBe(360);
  });

  it("an intro rate starts the loan and reverts to the ongoing rate", () => {
    const i = toRefinanceInput(FULL);
    expect(i.proposed.annualRate).toBeCloseTo(0.0549);
    expect(i.proposed.rateChanges).toEqual([{ date: "2028-11-04", annualRate: 0.0579 }]);
  });

  it("the defaults run and break even", () => {
    const r = compareRefinance(toRefinanceInput(defaultRefinance("2026-11-04")));
    expect(r.breakEvenMonths).toBeGreaterThan(0);
    expect(r.breakEvenMonths).toBeLessThan(6);
    expect(r.lifetimeBenefit).toBeGreaterThan(0);
  });
});
