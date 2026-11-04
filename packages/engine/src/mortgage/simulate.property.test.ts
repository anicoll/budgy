import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { type LoanInput, simulateLoan } from "./simulate";

const loan = fc.record({
  balance: fc.integer({ min: 10_000_00, max: 2_000_000_00 }).map((n) => n as Cents),
  annualRate: fc.integer({ min: 100, max: 1200 }).map((bp) => bp / 10_000),
  termMonths: fc.integer({ min: 12, max: 360 }),
  startDate: fc.constantFrom("2026-01-15", "2026-02-28", "2026-05-31", "2027-12-01"),
  frequency: fc.constantFrom("weekly", "fortnightly", "monthly") as fc.Arbitrary<
    LoanInput["frequency"]
  >,
});
const amount = fc.integer({ min: 0, max: 200_000_00 }).map((n) => n as Cents);
const runs = { numRuns: 40 };

describe("simulateLoan properties", () => {
  it("minimum repayments pay the loan off, and total paid = balance + interest", () => {
    fc.assert(
      fc.property(loan, (l) => {
        const r = simulateLoan(l);
        expect(r.paidOff).toBe(true);
        expect(r.totalPaid).toBe(l.balance + r.totalInterest);
        expect(r.balances.every((b) => b.balance >= 0)).toBe(true);
      }),
      runs,
    );
  });

  it("paying extra never increases total interest or the payoff date", () => {
    fc.assert(
      fc.property(loan, fc.integer({ min: 1, max: 500_00 }), (l, extra) => {
        const base = simulateLoan(l);
        const more = simulateLoan({ ...l, extraPerPeriod: extra as Cents });
        expect(more.totalInterest).toBeLessThanOrEqual(base.totalInterest);
        expect(more.payoffDate <= base.payoffDate).toBe(true);
      }),
      runs,
    );
  });

  it("a bigger offset never increases total interest", () => {
    fc.assert(
      fc.property(loan, amount, amount, (l, a, b) => {
        const [small, big] = a <= b ? [a, b] : [b, a];
        const s = simulateLoan({ ...l, offsetBalance: small });
        const g = simulateLoan({ ...l, offsetBalance: big });
        expect(g.totalInterest).toBeLessThanOrEqual(s.totalInterest);
      }),
      runs,
    );
  });
});
