import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calculatePay, PAY_PERIODS_PER_YEAR, type PayInput, type PayPeriod } from "./pay";

const input = fc
  .record({
    year: fc.constantFrom("2025-26", "2026-27", "2027-28"),
    salary: fc.integer({ min: 0, max: 600_000_00 }),
    includesSuper: fc.boolean(),
    sacrificePct: fc.integer({ min: 0, max: 30 }),
    studyLoan: fc.boolean(),
    foreign: fc.boolean(),
  })
  .map(
    (r): PayInput => ({
      year: r.year,
      salary: r.salary as Cents,
      includesSuper: r.includesSuper,
      salarySacrifice: Math.round((r.salary * r.sacrificePct) / 100) as Cents,
      studyLoan: r.studyLoan,
      residency: r.foreign ? "foreign" : "resident",
    }),
  );

describe("calculatePay properties", () => {
  it("adds up: take-home plus everything taken out is taxable income", () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = calculatePay(i);
        expect(r.net + r.totalTax).toBe(r.taxableIncome);
        expect(r.incomeTax + r.medicare + r.surcharge + r.studyLoan).toBe(r.totalTax);
        expect(r.net).toBeGreaterThanOrEqual(0);
        expect(r.totalTax).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("each pay period is a share of the year, to within a few cents a period", () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = calculatePay(i);
        for (const p of Object.keys(PAY_PERIODS_PER_YEAR) as PayPeriod[]) {
          const n = PAY_PERIODS_PER_YEAR[p];
          expect(Math.abs(r.periods[p].net * n - r.net)).toBeLessThanOrEqual(n * 3);
          expect(r.periods[p].net + r.periods[p].totalTax).toBe(r.periods[p].taxableIncome);
        }
      }),
    );
  });

  it("earning more never leaves you worse off, with hospital cover", () => {
    fc.assert(
      fc.property(input, fc.integer({ min: 1, max: 50_000_00 }), (i, raise) => {
        const plain = { ...i, salarySacrifice: 0 as Cents };
        const a = calculatePay(plain);
        const b = calculatePay({ ...plain, salary: (i.salary + raise) as Cents });
        expect(b.net).toBeGreaterThanOrEqual(a.net);
        expect(a.marginalRate).toBeGreaterThanOrEqual(0);
        expect(a.marginalRate).toBeLessThan(1);
      }),
    );
  });

  it("salary sacrifice never raises the tax bill", () => {
    fc.assert(
      fc.property(input, (i) => {
        const without = calculatePay({ ...i, salarySacrifice: 0 as Cents, studyLoan: false });
        const withIt = calculatePay({ ...i, studyLoan: false });
        expect(withIt.totalTax).toBeLessThanOrEqual(without.totalTax);
      }),
    );
  });
});
