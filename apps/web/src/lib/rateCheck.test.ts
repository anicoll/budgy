import { describe, expect, it } from "vitest";
import {
  decodeRateCheck,
  defaultRateCheck,
  encodeRateCheck,
  type RateCheckForm,
  toRateCheckInput,
} from "./rateCheck";

describe("rate check URL state", () => {
  it("round-trips every field", () => {
    const f: RateCheckForm = {
      balance: 452_000,
      ratePct: 6.84,
      termYears: 22,
      purpose: "investor",
      repayment: "interest-only",
      rateType: "fixed-over-3-years",
    };
    expect(decodeRateCheck(encodeRateCheck(f))).toEqual(f);
  });

  it("falls back on a missing version or broken values", () => {
    expect(decodeRateCheck("b=1")).toEqual(defaultRateCheck());
    const f = decodeRateCheck("v=1&b=abc&r=99&t=0&p=x&k=io&rt=f3");
    expect(f.balance).toBe(600_000);
    expect(f.ratePct).toBe(6.49);
    expect(f.termYears).toBe(25);
    expect(f.purpose).toBe("owner-occupier");
    expect(f.repayment).toBe("interest-only");
    expect(f.rateType).toBe("fixed-up-to-3-years");
  });

  it("converts to the engine's cents and months", () => {
    const i = toRateCheckInput({ ...defaultRateCheck(), balance: 520_000.5, termYears: 24.5 });
    expect(i.balance).toBe(52_000_050);
    expect(i.annualRate).toBeCloseTo(0.0649, 10);
    expect(i.termMonths).toBe(294);
  });
});
