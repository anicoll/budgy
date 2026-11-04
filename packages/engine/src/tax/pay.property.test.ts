import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  calculatePay,
  type MedicareExemption,
  PAY_PERIODS_PER_YEAR,
  type PayInput,
  type PayPeriod,
  type Residency,
} from "./pay";

const money = (max: number) => fc.integer({ min: 0, max: max * 100 });

const input = fc
  .record({
    year: fc.constantFrom("2025-26", "2026-27", "2027-28"),
    salary: money(600_000),
    includesSuper: fc.boolean(),
    sacrificePct: fc.integer({ min: 0, max: 30 }),
    overtime: money(30_000),
    bonus: money(30_000),
    allowances: money(10_000),
    packaging: money(15_000),
    fringe: money(15_000),
    deductions: money(10_000),
    studyLoan: fc.boolean(),
    residency: fc.constantFrom("resident", "resident", "foreign", "whm") as fc.Arbitrary<Residency>,
    taxFreeThreshold: fc.boolean(),
    medicareExemption: fc.constantFrom(
      "none",
      "none",
      "half",
      "full",
    ) as fc.Arbitrary<MedicareExemption>,
    hospitalCover: fc.boolean(),
  })
  .map(
    (r): PayInput => ({
      year: r.year,
      salary: r.salary as Cents,
      includesSuper: r.includesSuper,
      salarySacrifice: Math.round((r.salary * r.sacrificePct) / 100) as Cents,
      overtime: r.overtime as Cents,
      bonus: r.bonus as Cents,
      allowances: r.allowances as Cents,
      otherPackaging: r.packaging as Cents,
      fringeBenefits: r.fringe as Cents,
      deductions: r.deductions as Cents,
      studyLoan: r.studyLoan,
      residency: r.residency,
      taxFreeThreshold: r.taxFreeThreshold,
      medicareExemption: r.medicareExemption,
      hospitalCover: r.hospitalCover,
    }),
  );

describe("calculatePay properties", () => {
  it("adds up: take-home plus everything taken out is gross less packaging", () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = calculatePay(i);
        expect(r.net + r.totalTax).toBe(r.gross - r.salarySacrifice - r.otherPackaging);
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
          const q = r.periods[p];
          expect(q.net + q.totalTax).toBe(q.gross - q.salarySacrifice - q.otherPackaging);
        }
      }),
    );
  });

  it("earning more never leaves you worse off, with hospital cover", () => {
    fc.assert(
      fc.property(input, fc.integer({ min: 1, max: 50_000_00 }), (i, raise) => {
        const plain = { ...i, salarySacrifice: 0 as Cents, hospitalCover: true };
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

  it("pay slips land near the tax owed for an ordinary resident employee", () => {
    const plain = fc.record({
      salary: money(400_000),
      studyLoan: fc.boolean(),
    });
    fc.assert(
      fc.property(plain, ({ salary, studyLoan }) => {
        const r = calculatePay({ year: "2026-27", salary: salary as Cents, studyLoan });
        if (!r.withholding) throw new Error("2026-27 tables missing");
        for (const slip of Object.values(r.withholding)) {
          expect(slip.net + slip.tax + slip.studyLoan + slip.packaging).toBe(slip.gross);
          // The tables over-withhold a little (most at low incomes, where
          // they don't build in the whole low income tax offset) and never
          // leave a real bill for a plain salary.
          expect(slip.atTaxTime).toBeGreaterThanOrEqual(-50_00);
          expect(slip.atTaxTime).toBeLessThanOrEqual(Math.max(700_00, r.totalTax * 0.015));
        }
      }),
    );
  });
});
