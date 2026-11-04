import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { splitLoan } from "./coborrow";

const party = (id: string) =>
  fc.record({
    id: fc.constant(id),
    name: fc.constant(id),
    weight: fc.integer({ min: 1, max: 100 }),
    deposit: fc.integer({ min: 0, max: 200_000_00 }).map((n) => n as Cents),
    extraPerPeriod: fc.integer({ min: 0, max: 2_000_00 }).map((n) => n as Cents),
    offsetBalance: fc.integer({ min: 0, max: 100_000_00 }).map((n) => n as Cents),
    frequency: fc.constantFrom("weekly", "fortnightly", "monthly") as fc.Arbitrary<
      "weekly" | "fortnightly" | "monthly"
    >,
  });

const parties = fc.integer({ min: 2, max: 4 }).chain((n) =>
  fc.tuple(...Array.from({ length: n }, (_, i) => party(`p${i}`))).map((ps) => {
    // Turn weights into percentages that add to exactly 100.
    const total = ps.reduce((s, p) => s + p.weight, 0);
    let left = 100;
    return ps.map(({ weight, ...p }, i) => {
      const pct = i === ps.length - 1 ? left : Math.round((weight / total) * 10_000) / 100;
      left = Math.round((left - pct) * 100) / 100;
      return { ...p, sharePct: pct };
    });
  }),
);

describe("splitLoan properties", () => {
  it("portions add to the balance and each person ends up owning deposit + portion", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50_000_00, max: 2_000_000_00 }),
        fc.integer({ min: 100, max: 1200 }),
        parties,
        (balance, bp, ps) => {
          fc.pre(ps.every((p) => p.sharePct > 0));
          const r = splitLoan({
            balance: balance as Cents,
            annualRate: bp / 10_000,
            termMonths: 300,
            startDate: "2026-02-28",
            frequency: "monthly",
            parties: ps,
          });
          expect(r.parties.reduce((s, p) => s + p.portion, 0)).toBe(balance);
          const end = r.ownership.at(-1);
          expect(end?.balance).toBe(0);
          r.parties.forEach((p, i) => {
            expect(end?.contributed[i]).toBe((ps[i].deposit ?? 0) + p.portion);
            expect(p.result.totalPaid).toBe(p.portion + p.result.totalInterest);
          });
          expect(end?.shares.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
        },
      ),
      { numRuns: 25 },
    );
  });
});
