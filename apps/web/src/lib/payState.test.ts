import { calculatePay } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  annualise,
  decodePayState,
  defaultPayState,
  encodePayState,
  fromAnnual,
  hasAdvanced,
  overtimeAnnual,
  type PayState,
  toPayInput,
} from "./payState";

const FULL: PayState = {
  ...defaultPayState("2026-11-04"),
  amount: 42.5,
  per: "hour",
  hoursPerWeek: 30,
  includesSuper: true,
  superPct: 14,
  year: "2027-28",
  studyLoan: true,
  hospitalCover: false,
  residency: "whm",
  taxFreeThreshold: false,
  medicareExemption: "half",
  family: true,
  partnerIncome: 65_000,
  children: 2,
  overtimeHours: 4,
  overtimeRate: 2,
  bonus: 3_000,
  allowances: 1_200,
  sacrifice: 5_000,
  packaging: 8_000,
  fringe: 9_500,
  deductions: 1_750,
  show: "monthly",
  raise: 7_500,
  compareAmount: 50,
  view: "compare",
};

describe("pay state", () => {
  it("defaults to this financial year", () => {
    expect(defaultPayState("2026-11-04").year).toBe("2026-27");
    expect(defaultPayState("2026-03-01").year).toBe("2025-26");
    expect(defaultPayState("2031-01-01").year).toBe("2026-27");
    expect(hasAdvanced(defaultPayState())).toBe(false);
    expect(hasAdvanced(FULL)).toBe(true);
  });

  it("round-trips every field through the URL", () => {
    expect(decodePayState(encodePayState(FULL))).toEqual(FULL);
    const d = defaultPayState("2026-11-04");
    expect(decodePayState(encodePayState(d), d)).toEqual(d);
  });

  it("falls back on bad or old links", () => {
    const d = defaultPayState("2026-11-04");
    expect(decodePayState("", d)).toBe(d);
    expect(decodePayState("v=9&p=abc", d)).toBe(d);
    expect(decodePayState("v=1&p=!!!", d)).toBe(d);
    const weird = new URLSearchParams({
      v: "1",
      p: Buffer.from(JSON.stringify({ a: [-5, 99, 0], y: "1999-00", x: [500, 9] })).toString(
        "base64url",
      ),
    }).toString();
    const s = decodePayState(weird, d);
    expect(s.amount).toBe(0);
    expect(s.per).toBe("year");
    expect(s.hoursPerWeek).toBe(1);
    expect(s.year).toBe("2026-27");
    expect(s.overtimeHours).toBe(80);
    expect(s.overtimeRate).toBe(3);
  });

  it("annualises what was typed", () => {
    expect(annualise(2_000, "fortnight", 38)).toBe(52_000);
    expect(annualise(50, "hour", 38)).toBe(98_800);
    expect(fromAnnual(98_800, "hour", 38)).toBe(50);
    expect(fromAnnual(100_000, "month", 38)).toBe(8_333.33);
  });

  it("prices overtime at the ordinary hourly rate", () => {
    const s = { ...defaultPayState(), amount: 98_800, overtimeHours: 2, overtimeRate: 1.5 };
    // $50 an hour × 1.5 × 2 hours × 52 weeks
    expect(overtimeAnnual(s)).toBeCloseTo(7_800, 6);
  });

  it("feeds the engine", () => {
    const r = calculatePay(toPayInput(FULL));
    expect(r.salary).toBeGreaterThan(0);
    expect(r.otherPackaging).toBe(800_000);
    const compare = calculatePay(toPayInput(FULL, FULL.compareAmount));
    expect(compare.gross).toBeGreaterThan(r.gross);
  });
});
