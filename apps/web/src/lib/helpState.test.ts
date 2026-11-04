import { compareHelpEarly } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import { decodeHelp, defaultHelp, encodeHelp, type HelpForm, toHelpInput } from "./helpState";

const FULL: HelpForm = {
  balance: 42_500.5,
  income: 120_000,
  lumpSum: 15_000,
  alternative: "savings",
  ratePct: 4.75,
  taxRatePct: 39,
  indexationPct: 2.5,
  incomeGrowthPct: -1,
};

describe("HELP URL state", () => {
  it("round-trips every field", () => {
    expect(decodeHelp(encodeHelp(FULL))).toEqual(FULL);
    const d = defaultHelp();
    expect(decodeHelp(encodeHelp(d))).toEqual({ ...d, taxRatePct: undefined });
  });

  it("falls back on old or broken links", () => {
    expect(decodeHelp("v=0&b=1")).toEqual(defaultHelp());
    const f = decodeHelp("v=1&b=abc&l=-5&a=zzz");
    expect(f.balance).toBe(defaultHelp().balance);
    expect(f.lumpSum).toBe(defaultHelp().lumpSum);
    expect(f.alternative).toBe("offset");
  });
});

describe("toHelpInput", () => {
  it("turns dollars and percent into the engine's input", () => {
    const i = toHelpInput(FULL, "2026-11-04");
    expect(i.balance).toBe(4_250_050);
    expect(i.rate).toBeCloseTo(0.0475, 10);
    expect(i.taxRate).toBeCloseTo(0.39, 10);
    expect(i.incomeGrowth).toBeCloseTo(-0.01, 10);
    expect(() => compareHelpEarly(i)).not.toThrow();
    expect(toHelpInput(defaultHelp(), "2026-11-04").taxRate).toBeUndefined();
  });
});
