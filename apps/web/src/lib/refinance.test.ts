import { compareRefinance } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  decodeRefinance,
  defaultRefinance,
  encodeRefinance,
  type RefinanceForm,
  toRefinanceInput,
  toRefinanceInputB,
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

describe("Offer B", () => {
  const withB: RefinanceForm = {
    ...FULL,
    offerB: { ratePct: 5.59, annualFee: 250, setupCosts: 300, cashback: 3_000 },
  };

  it("round-trips through the URL", () => {
    expect(decodeRefinance(encodeRefinance(withB))).toEqual(withB);
  });

  it("is absent from links made without it, and old links still decode", () => {
    expect(encodeRefinance(FULL)).not.toContain("br=");
    expect(decodeRefinance(encodeRefinance(FULL)).offerB).toBeUndefined();
    const old = "v=1&b=500000&r=6.5&t=25&nr=5.8&f=m&k=keep&d=2026-11-04";
    const f = decodeRefinance(old);
    expect(f.balance).toBe(500_000);
    expect(f.offerB).toBeUndefined();
  });

  it("falls back for missing or junk Offer B fields", () => {
    const f = decodeRefinance("v=1&br=5.5&bc=abc");
    expect(f.offerB).toMatchObject({ ratePct: 5.5, cashback: 0, annualFee: 0 });
    expect(decodeRefinance("v=1&br=abc").offerB).toBeUndefined();
  });

  it("builds its own engine input from the shared loan", () => {
    expect(toRefinanceInputB(FULL)).toBeUndefined();
    const i = toRefinanceInputB(withB);
    const a = toRefinanceInput(withB);
    expect(i?.current).toEqual(a.current);
    expect(i?.proposed).toEqual({ annualRate: 0.0559, termMonths: 360 });
    expect(i?.switchingCosts).toBe(65_000); // exit $350 + B setup $300
    expect(i?.cashback).toBe(300_000);
    expect(i?.proposedAnnualFee).toBe(25_000);
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
