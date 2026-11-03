import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { normaliseToPeriod } from "./normalise";

// All expected values calculated with DAYS = {weekly:7, fortnightly:14, monthly:30, quarterly:91, yearly:365}
// formula: Math.round(amount × DAYS[to] / DAYS[from])

describe("normaliseToPeriod — days-based formula", () => {
  it("no-op when fromFrequency === toPeriod", () => {
    expect(normaliseToPeriod(cents(10000), "monthly", "monthly")).toBe(10000);
    expect(normaliseToPeriod(cents(5000), "weekly", "weekly")).toBe(5000);
  });

  it("fortnightly → weekly is exactly ÷2 (the key AU case)", () => {
    // $1,000/fn → $500/week: 100000 × 7/14 = 50000 (exact)
    expect(normaliseToPeriod(cents(100000), "fortnightly", "weekly")).toBe(50000);
    // $5,040/fn → $2,520/week: 504000 × 7/14 = 252000 (exact)
    expect(normaliseToPeriod(cents(504000), "fortnightly", "weekly")).toBe(252000);
  });

  it("weekly → fortnightly is exactly ×2", () => {
    // $100/week → $200/fortnight: 10000 × 14/7 = 20000 (exact)
    expect(normaliseToPeriod(cents(10000), "weekly", "fortnightly")).toBe(20000);
  });

  it("monthly → weekly (×7/30)", () => {
    // $3,400/month → $793.33/week: 340000 × 7/30 = 79333
    expect(normaliseToPeriod(cents(340000), "monthly", "weekly")).toBe(79333);
    // $1,800/month → $420/week: 180000 × 7/30 = 42000 (exact)
    expect(normaliseToPeriod(cents(180000), "monthly", "weekly")).toBe(42000);
  });

  it("weekly → monthly (×30/7)", () => {
    // $100/week → $428.57/month: 10000 × 30/7 = 42857
    expect(normaliseToPeriod(cents(10000), "weekly", "monthly")).toBe(42857);
  });

  it("fortnightly → monthly (×30/14 ≈ ×2.143)", () => {
    // $3,500/fn → $7,500/month: 350000 × 30/14 = 750000 (exact)
    expect(normaliseToPeriod(cents(350000), "fortnightly", "monthly")).toBe(750000);
  });

  it("yearly → monthly (×30/365)", () => {
    // $12,000/year → $986.30/month: 1200000 × 30/365 = 98630
    expect(normaliseToPeriod(cents(1200000), "yearly", "monthly")).toBe(98630);
  });

  it("monthly → yearly (×365/30)", () => {
    // $1,000/month → $12,166.67/year: 100000 × 365/30 = 1216667
    expect(normaliseToPeriod(cents(100000), "monthly", "yearly")).toBe(1216667);
  });

  it("quarterly → weekly (×7/91)", () => {
    // $527/quarter → $40.54/week: 52700 × 7/91 = 4054
    expect(normaliseToPeriod(cents(52700), "quarterly", "weekly")).toBe(4054);
  });

  it("weekly → quarterly (×91/7 = ×13)", () => {
    // $100/week → $1,300/quarter: 10000 × 91/7 = 130000 (exact)
    expect(normaliseToPeriod(cents(10000), "weekly", "quarterly")).toBe(130000);
  });

  it("handles zero", () => {
    expect(normaliseToPeriod(cents(0), "weekly", "monthly")).toBe(0);
    expect(normaliseToPeriod(cents(0), "fortnightly", "weekly")).toBe(0);
  });
});
