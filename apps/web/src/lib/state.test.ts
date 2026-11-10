import { describe, expect, it } from "vitest";
import { duration, money, monthYear } from "./format";
import {
  type CalculatorState,
  decodeState,
  defaultState,
  encodeState,
  parseMoney,
  toChanges,
  toLoanInput,
} from "./state";

const FULL: CalculatorState = {
  base: {
    balance: 612_345.67,
    ratePct: 6.04,
    termYears: 27,
    frequency: "fortnightly",
    fortnightlyMethod: "true",
    offset: 25_000,
    startDate: "2026-03-31",
  },
  scenarios: [
    { name: "Extra $200", extra: 200 },
    {
      name: "Bonus each July",
      offset: 40_000,
      offsetDeposit: 500,
      lumpSum: { amount: 10_000, date: "2026-07-01", yearly: true },
    },
    {
      name: "Rates up",
      rateChange: { date: "2027-01-01", ratePct: 6.54, followMinimum: true },
      frequency: "monthly",
    },
  ],
};

describe("URL state", () => {
  it("round-trips every field exactly", () => {
    expect(decodeState(encodeState(FULL))).toEqual(FULL);
  });

  it("round-trips non-ASCII scenario names", () => {
    const s = { ...FULL, scenarios: [{ name: "Café ☕ plan", extra: 1 }] };
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it("falls back to defaults for junk, a missing version or a future version", () => {
    const fb = defaultState("2026-01-01");
    expect(decodeState("s=not-base64!!", fb)).toEqual(fb);
    expect(decodeState("", fb)).toEqual(fb);
    const q = new URLSearchParams(encodeState(FULL));
    q.set("v", "99");
    expect(decodeState(q.toString(), fb)).toEqual(fb);
  });

  it("keeps at most three scenarios", () => {
    const many = { ...FULL, scenarios: [...FULL.scenarios, { name: "D", extra: 5 }] };
    expect(decodeState(encodeState(many)).scenarios).toHaveLength(3);
  });
});

describe("conversion to engine input", () => {
  it("converts dollars to cents and percent to a rate", () => {
    const l = toLoanInput(FULL.base);
    expect(l.balance).toBe(61_234_567);
    expect(l.annualRate).toBeCloseTo(0.0604);
    expect(l.termMonths).toBe(324);
    expect(l.offsetBalance).toBe(2_500_000);
  });

  it("only sets the fields a scenario changes", () => {
    expect(toChanges({ name: "x", extra: 200 })).toEqual({ extraPerPeriod: 20_000 });
    expect(toChanges(FULL.scenarios[1]).lumpSums).toEqual([
      { date: "2026-07-01", amount: 1_000_000, repeatYearly: true },
    ]);
  });
});

describe("parseMoney", () => {
  it.each([
    ["600k", 600_000],
    ["$600,000", 600_000],
    ["1.2m", 1_200_000],
    ["2997.75", 2997.75],
    [" 50 ", 50],
  ])("%s → %d", (text, n) => expect(parseMoney(text)).toBe(n));

  it("rejects non-numbers", () => {
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("format", () => {
  it("formats money, dates and durations", () => {
    expect(money(18_742_049)).toBe("$187,420");
    expect(monthYear("2049-03-15")).toBe("March 2049");
    expect(duration(2_314)).toBe("6 years 4 months");
    expect(duration(31)).toBe("1 month");
    expect(duration(365)).toBe("1 year");
  });
});
