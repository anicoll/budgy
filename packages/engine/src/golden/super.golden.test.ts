import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { SUPER_RULES } from "../super/rules";
import { calculatePay } from "../tax/pay";
import { ATO_CONTRIBUTION_CAPS, ATO_SUPER_GUARANTEE } from "./sources";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;
const rules = (year: string) => {
  const r = SUPER_RULES.find((x) => x.year === year);
  if (!r) throw new Error(`no super rules for ${year}`);
  return r;
};

describe(`super guarantee: ${ATO_SUPER_GUARANTEE.name}`, () => {
  it.each([
    ["2024-25", 0.115],
    ["2025-26", 0.12],
    ["2026-27", 0.12],
  ] as const)("%s rate is %d", (year, rate) => {
    expect(rules(year).sgRate).toBe(rate);
  });

  it("2025-26: $62,500 a quarter, so at most $7,500 a quarter ($30,000 a year)", () => {
    expect(d(rules("2025-26").maxContributionBase)).toBe(62_500 * 4);
    const r = calculatePay({ year: "2025-26", salary: c(300_000) });
    expect(d(r.employerSuper)).toBe(7_500 * 4);
  });

  it("2024-25: $65,070 a quarter, at most $7,483.05 a quarter", () => {
    expect(d(rules("2024-25").maxContributionBase)).toBe(65_070 * 4);
  });

  it("2026-27: an annual base of $270,830 under Payday Super", () => {
    expect(d(rules("2026-27").maxContributionBase)).toBe(270_830);
    const r = calculatePay({ year: "2026-27", salary: c(300_000) });
    expect(d(r.employerSuper)).toBe(32_499.6);
    // Below the base, it's 12% of the lot.
    expect(d(calculatePay({ year: "2026-27", salary: c(100_000) }).employerSuper)).toBe(12_000);
  });

  it("the base follows the ATO's formula: cap × 100 ÷ SG rate, down to the $10", () => {
    const r = rules("2026-27");
    const base = Math.floor(d(r.concessionalCap) / r.sgRate / 10) * 10;
    expect(base).toBe(270_830);
  });
});

describe(`caps: ${ATO_CONTRIBUTION_CAPS.name}`, () => {
  it.each([
    ["2024-25", 30_000],
    ["2025-26", 30_000],
    ["2026-27", 32_500],
  ] as const)("%s concessional cap is $%d", (year, cap) => {
    expect(d(rules(year).concessionalCap)).toBe(cap);
    // The non-concessional cap is four times the concessional cap.
    expect(d(rules(year).nonConcessionalCap)).toBe(cap * 4);
  });
});
