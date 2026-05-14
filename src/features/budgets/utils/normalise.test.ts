import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { normaliseToPeriod } from "./normalise";

describe("normaliseToPeriod", () => {
  it("no-op when fromFrequency === toPeriod", () => {
    expect(normaliseToPeriod(cents(10000), "monthly", "monthly")).toBe(10000);
    expect(normaliseToPeriod(cents(5000), "weekly", "weekly")).toBe(5000);
  });

  it("weekly → monthly (×52/12 ≈ 4.333)", () => {
    // $100/week → $433/month (Math.round(100 × 52 / 12) = round(433.33) = 433)
    expect(normaliseToPeriod(cents(10000), "weekly", "monthly")).toBe(43333);
  });

  it("fortnightly → monthly (×26/12 ≈ 2.167)", () => {
    // $3,500/fn → $7,583/month (Math.round(3500 × 26 / 12) = round(7583.33) = 7583)
    expect(normaliseToPeriod(cents(350000), "fortnightly", "monthly")).toBe(758333);
  });

  it("monthly → weekly (×12/52 ≈ 0.2308)", () => {
    // $1,800/month → $415/week (Math.round(1800 × 12 / 52) = round(415.38) = 415)
    expect(normaliseToPeriod(cents(180000), "monthly", "weekly")).toBe(41538);
  });

  it("yearly → monthly (÷12)", () => {
    // $12,000/year → $1,000/month
    expect(normaliseToPeriod(cents(1200000), "yearly", "monthly")).toBe(100000);
  });

  it("monthly → yearly (×12)", () => {
    // $1,000/month → $12,000/year
    expect(normaliseToPeriod(cents(100000), "monthly", "yearly")).toBe(1200000);
  });

  it("weekly → fortnightly (×52/26 = ×2)", () => {
    // $100/week → $200/fortnight
    expect(normaliseToPeriod(cents(10000), "weekly", "fortnightly")).toBe(20000);
  });

  it("yearly → weekly (÷52)", () => {
    // $52,000/year → $1,000/week
    expect(normaliseToPeriod(cents(5200000), "yearly", "weekly")).toBe(100000);
  });

  it("handles zero", () => {
    expect(normaliseToPeriod(cents(0), "weekly", "monthly")).toBe(0);
  });
});
