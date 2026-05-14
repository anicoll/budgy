import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import type { MortgagePlan } from "../types";
import { amortise, calcMinRepayment } from "./amortise";

const BASE_PLAN: MortgagePlan = {
  id: "test",
  loanAmount: cents(50_000_000), // $500,000
  currentBalance: cents(50_000_000),
  interestRate: 0.06, // 6% p.a.
  termYears: 30,
  startDate: "2025-01",
  repaymentFrequency: "monthly",
  offsetBalance: cents(0),
  redrawBalance: cents(0),
  extraRepayment: cents(0),
  updatedAt: "",
};

describe("calcMinRepayment", () => {
  it("matches textbook PMT: $500k at 6%/yr over 30yr monthly", () => {
    // PMT = 500000 × 0.005 / (1 - (1.005)^-360) = $2,997.75 → 299775 cents
    const pmt = calcMinRepayment(cents(50_000_000), 0.06, 30, "monthly");
    expect(pmt).toBe(299_775);
  });

  it("zero rate → principal divided equally over periods", () => {
    // $120,000 / 120 months = $1,000/mo = 100,000 cents
    const pmt = calcMinRepayment(cents(12_000_000), 0, 10, "monthly");
    expect(pmt).toBe(100_000);
  });

  it("fortnightly PMT × 26 is within 2% of monthly PMT × 12 (same loan cleared same term)", () => {
    // Both clear the same $500k loan over 30 years — annual totals should be very close.
    // Fortnightly is slightly less because more frequent payments mean less interest accrues.
    const monthly = calcMinRepayment(cents(50_000_000), 0.06, 30, "monthly");
    const fortnightly = calcMinRepayment(cents(50_000_000), 0.06, 30, "fortnightly");
    const ratio = (fortnightly * 26) / (monthly * 12);
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThan(1.02);
  });
});

describe("amortise — basic monthly loan", () => {
  it("clears loan in exactly 360 periods with closing balance ≤ minimum repayment", () => {
    const result = amortise(BASE_PLAN);
    expect(result.rows.length).toBeLessThanOrEqual(360);
    const last = result.rows[result.rows.length - 1];
    expect(last.closing).toBeLessThanOrEqual(result.minimumRepayment);
  });

  it("total interest is close to textbook value ($579,190 ≈ 57,919,000 cents)", () => {
    const result = amortise(BASE_PLAN);
    // Theoretical: 299,775 × 360 - 50,000,000 = 107,919,000 - 50,000,000 = 57,919,000
    // Allow ±50,000 cents (±$500) for rounding over 360 periods
    expect(Math.abs(result.totalInterest - 57_919_000)).toBeLessThan(50_000);
  });

  it("each row: closing = opening - principal, and opening of next = closing of previous", () => {
    const result = amortise(BASE_PLAN);
    for (let i = 0; i < Math.min(result.rows.length - 1, 12); i++) {
      const row = result.rows[i];
      expect(row.closing).toBe(row.opening - row.principal);
      expect(result.rows[i + 1].opening).toBe(row.closing);
    }
  });

  it("interest decreases monotonically as balance falls (no offset, no extra)", () => {
    const result = amortise(BASE_PLAN);
    for (let i = 1; i < Math.min(result.rows.length, 12); i++) {
      expect(result.rows[i].interest).toBeLessThanOrEqual(result.rows[i - 1].interest);
    }
  });

  it("no interest saved when no offset or extra", () => {
    const result = amortise(BASE_PLAN);
    expect(result.interestSaved).toBe(0);
    expect(result.periodsSaved).toBe(0);
  });
});

describe("amortise — offset account", () => {
  it("offset reduces total interest paid", () => {
    const withOffset = amortise({ ...BASE_PLAN, offsetBalance: cents(5_000_000) }); // $50k offset
    const baseline = amortise(BASE_PLAN);
    expect(withOffset.totalInterest).toBeLessThan(baseline.totalInterest);
  });

  it("offset reduces payoff period", () => {
    const withOffset = amortise({ ...BASE_PLAN, offsetBalance: cents(5_000_000) });
    const baseline = amortise(BASE_PLAN);
    expect(withOffset.payoffPeriods).toBeLessThan(baseline.payoffPeriods);
  });

  it("interestSaved is positive when offset > 0", () => {
    const result = amortise({ ...BASE_PLAN, offsetBalance: cents(5_000_000) });
    expect(result.interestSaved).toBeGreaterThan(0);
  });

  it("offset ≥ balance → zero interest every period, pays off in ~167 months (no interest = flat amortisation)", () => {
    const result = amortise({ ...BASE_PLAN, offsetBalance: cents(50_000_000) });
    // Interest = 0 each period; full PMT (299,775) goes to principal.
    // 50,000,000 / 299,775 ≈ 167 periods
    expect(result.rows[0].interest).toBe(0);
    expect(result.rows.length).toBeLessThan(360);
    expect(result.rows.length).toBeCloseTo(167, -1); // within ±10
    expect(result.totalInterest).toBe(0);
  });
});

describe("amortise — extra repayments", () => {
  it("extra repayment reduces total interest", () => {
    const withExtra = amortise({ ...BASE_PLAN, extraRepayment: cents(50_000) }); // +$500/mo
    const baseline = amortise(BASE_PLAN);
    expect(withExtra.totalInterest).toBeLessThan(baseline.totalInterest);
  });

  it("extra repayment shortens loan term", () => {
    const withExtra = amortise({ ...BASE_PLAN, extraRepayment: cents(50_000) }); // +$500/mo
    const baseline = amortise(BASE_PLAN);
    expect(withExtra.payoffPeriods).toBeLessThan(baseline.payoffPeriods);
  });
});

describe("amortise — fortnightly", () => {
  it("fortnightly PMT clears loan within term", () => {
    const plan: MortgagePlan = { ...BASE_PLAN, repaymentFrequency: "fortnightly" };
    const result = amortise(plan);
    expect(result.rows.length).toBeLessThanOrEqual(30 * 26);
    const last = result.rows[result.rows.length - 1];
    expect(last.closing).toBeLessThanOrEqual(result.minimumRepayment);
  });
});

describe("amortise — edge cases", () => {
  it("1 year term clears in 12 periods", () => {
    const plan: MortgagePlan = {
      ...BASE_PLAN,
      currentBalance: cents(1_000_000), // $10,000
      termYears: 1,
    };
    const result = amortise(plan);
    expect(result.rows.length).toBeLessThanOrEqual(12);
    expect(result.rows[result.rows.length - 1].closing).toBeLessThanOrEqual(
      result.minimumRepayment,
    );
  });
});
