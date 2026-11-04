import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { type CoBorrowInput, splitLoan, splitPortions, validateCoBorrow } from "./coborrow";
import { simulateLoan } from "./simulate";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

const base = (over: Partial<CoBorrowInput> = {}): CoBorrowInput => ({
  balance: c(600_000),
  annualRate: 0.06,
  termMonths: 360,
  startDate: "2026-11-04",
  frequency: "monthly",
  parties: [
    { id: "a", name: "Alex", sharePct: 50 },
    { id: "b", name: "Sam", sharePct: 50 },
  ],
  ...over,
});

describe("splitPortions", () => {
  it("adds up to the balance exactly", () => {
    expect(splitPortions(100, [33.33, 33.33, 33.34])).toEqual([33, 33, 34]);
    const p = splitPortions(c(600_000.01), [60, 40]);
    expect(p[0] + p[1]).toBe(c(600_000.01));
    expect(splitPortions(10, [0, 0])).toEqual([0, 0]);
  });
});

describe("splitLoan", () => {
  it("50/50 on minimums: each half is the mortgage tool's $300k loan", () => {
    const r = splitLoan(base());
    const half = simulateLoan({ ...base(), balance: c(300_000) });
    for (const p of r.parties) {
      expect(p.portion).toBe(c(300_000));
      expect(p.result.minimumRepayment).toBe(half.minimumRepayment);
      expect(p.result.totalInterest).toBe(half.totalInterest);
      expect(p.interestSaved).toBe(0);
    }
    // Two half-minimums are within a cent of the whole loan's minimum ($3,597.31).
    expect(Math.abs(r.monthlyMinimum - 359_731)).toBeLessThanOrEqual(1);
    expect(r.debtFreeDate).toBe(half.payoffDate);
  });

  it("extra from one person only shortens their own portion", () => {
    const r = splitLoan(
      base({
        parties: [
          { id: "a", name: "Alex", sharePct: 50, extraPerPeriod: c(500) },
          { id: "b", name: "Sam", sharePct: 50 },
        ],
      }),
    );
    const [alex, sam] = r.parties;
    expect(alex.result.payoffDate < sam.result.payoffDate).toBe(true);
    expect(alex.interestSaved).toBeGreaterThan(0);
    expect(sam.interestSaved).toBe(0);
    expect(sam.daysSaved).toBe(0);
    // A plain 50/50 split of the interest would overcharge Alex.
    expect(alex.proRataInterest).toBeGreaterThan(alex.result.totalInterest);
    expect(sam.proRataInterest).toBeLessThan(sam.result.totalInterest);
    expect(r.debtFreeDate).toBe(sam.result.payoffDate);
    expect(r.monthlyRepayment).toBe(r.monthlyMinimum + c(500));
  });

  it("an offset only counts against its owner's portion", () => {
    const r = splitLoan(
      base({
        parties: [
          { id: "a", name: "Alex", sharePct: 70, offsetBalance: c(50_000) },
          { id: "b", name: "Sam", sharePct: 30 },
        ],
      }),
    );
    expect(r.parties[0].portion).toBe(c(420_000));
    expect(r.parties[0].interestSaved).toBeGreaterThan(0);
    expect(r.parties[1].interestSaved).toBe(0);
  });

  it("lets each person repay on their own cadence", () => {
    const r = splitLoan(
      base({
        parties: [
          { id: "a", name: "Alex", sharePct: 50, frequency: "fortnightly" },
          { id: "b", name: "Sam", sharePct: 50 },
        ],
      }),
    );
    expect(r.parties[0].frequency).toBe("fortnightly");
    // Half-monthly fortnightly finishes years earlier than paying monthly.
    expect(r.parties[0].daysSaved).toBeGreaterThan(365 * 3);
  });

  it("tracks ownership by deposit plus principal repaid", () => {
    const r = splitLoan(
      base({
        propertyValue: c(800_000),
        parties: [
          { id: "a", name: "Alex", sharePct: 50, deposit: c(150_000) },
          { id: "b", name: "Sam", sharePct: 50, deposit: c(50_000) },
        ],
      }),
    );
    const today = r.ownership[0];
    expect(today.year).toBe(0);
    expect(today.date).toBe("2026-11-04");
    expect(today.shares[0]).toBeCloseTo(0.75);
    expect(today.balance).toBe(c(600_000));
    expect(today.equity).toEqual([c(150_000), c(50_000)]);
    // Equal repayments pull ownership towards 50/50 over time.
    const end = r.ownership.at(-1);
    expect(end?.balance).toBe(0);
    expect(end?.contributed).toEqual([c(450_000), c(350_000)]);
    expect(end?.shares[0]).toBeCloseTo(450 / 800);
    expect(end?.date).toBe(r.debtFreeDate);
  });

  it("splits ownership evenly when nobody has contributed yet", () => {
    expect(splitLoan(base()).ownership[0].shares).toEqual([0.5, 0.5]);
  });

  it("rejects shares that don't add to 100% and bad input", () => {
    const bad = base({
      parties: [
        { id: "a", name: "Alex", sharePct: 60 },
        { id: "b", name: "Sam", sharePct: 30 },
      ],
    });
    expect(validateCoBorrow(bad).join()).toMatch(/90%, not 100%/);
    expect(() => splitLoan(bad)).toThrow(/100%/);
    expect(validateCoBorrow(base({ parties: [base().parties[0]] })).join()).toMatch(/two/);
    expect(
      validateCoBorrow(
        base({
          parties: [
            { id: "a", name: "Alex", sharePct: 50, extraPerPeriod: -1 as Cents },
            { id: "b", name: "Sam", sharePct: 50 },
          ],
        }),
      ).join(),
    ).toMatch(/Alex: extraPerPeriod/);
    expect(validateCoBorrow(base())).toEqual([]);
  });
});
