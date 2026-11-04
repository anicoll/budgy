import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { type Debt, simulatePayoff } from "./payoff";

const debt = (id: string) =>
  fc
    .record({
      balance: fc.integer({ min: 100_00, max: 60_000_00 }),
      rateBp: fc.integer({ min: 0, max: 2999 }),
      pct: fc.boolean(),
    })
    .map(({ balance, rateBp, pct }): Debt => {
      const annualRate = rateBp / 10_000;
      // A fixed minimum that always beats the interest, so every plan ends.
      const fixed = Math.ceil((balance * annualRate) / 12) + Math.ceil(balance / 120) + 100;
      return {
        id,
        name: id,
        balance: balance as Cents,
        annualRate,
        minimum: pct
          ? { type: "percent", percent: 0.03, floor: 30_00 as Cents }
          : { type: "fixed", amount: fixed as Cents },
      };
    });

const debts = fc
  .integer({ min: 1, max: 6 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => debt(`d${i}`))));
const extra = fc.integer({ min: 0, max: 2_000_00 }).map((n) => n as Cents);
const strategy = fc.constantFrom("avalanche", "snowball", "custom", "minimums" as const);
const runs = { numRuns: 60 };

describe("simulatePayoff properties", () => {
  it("total paid = starting balances + interest, and nothing goes negative", () => {
    fc.assert(
      fc.property(debts, extra, strategy, (ds, x, s) => {
        const r = simulatePayoff({
          debts: ds,
          extraPerMonth: x,
          strategy: s,
          startDate: "2026-03-31",
        });
        expect(r.paidOff).toBe(true);
        const owed = ds.reduce((t, d) => t + d.balance, 0);
        expect(r.totalPaid).toBe(owed + r.totalInterest);
        for (const m of r.timeline) for (const b of m.balances) expect(b).toBeGreaterThanOrEqual(0);
        expect(r.timeline.at(-1)?.total).toBe(0);
      }),
      runs,
    );
  });

  it("never pays more than the budget while minimums fit in it", () => {
    fc.assert(
      fc.property(debts, extra, (ds, x) => {
        const r = simulatePayoff({
          debts: ds,
          extraPerMonth: x,
          strategy: "snowball",
          startDate: "2026-01-01",
        });
        const fixedOnly = ds.every((d) => d.minimum.type === "fixed");
        if (fixedOnly)
          for (const m of r.timeline) expect(m.paid).toBeLessThanOrEqual(r.monthlyBudget);
      }),
      runs,
    );
  });

  it("an extra never makes a plan slower or dearer", () => {
    fc.assert(
      fc.property(debts, extra, (ds, x) => {
        const input = { debts: ds, strategy: "avalanche" as const, startDate: "2026-01-01" };
        const none = simulatePayoff({ ...input, extraPerMonth: 0 as Cents });
        const some = simulatePayoff({ ...input, extraPerMonth: x });
        expect(some.months).toBeLessThanOrEqual(none.months);
        expect(some.totalInterest).toBeLessThanOrEqual(none.totalInterest);
      }),
      runs,
    );
  });

  it("avalanche pays no more interest than snowball with fixed minimums", () => {
    fc.assert(
      fc.property(debts, extra, (ds, x) => {
        const fixedDs = ds.map((d) =>
          d.minimum.type === "fixed"
            ? d
            : {
                ...d,
                minimum: {
                  type: "fixed" as const,
                  amount: (Math.ceil((d.balance * d.annualRate) / 12) + 5_000) as Cents,
                },
              },
        );
        const input = { debts: fixedDs, extraPerMonth: x, startDate: "2026-01-01" };
        const a = simulatePayoff({ ...input, strategy: "avalanche" });
        const s = simulatePayoff({ ...input, strategy: "snowball" });
        // Cent rounding each month can tip it by a few cents.
        expect(a.totalInterest).toBeLessThanOrEqual(s.totalInterest + a.months);
      }),
      runs,
    );
  });
});
