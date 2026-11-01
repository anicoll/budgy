import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import type { SplitParty } from "../types";
import { amortise } from "./amortise";
import {
  allocatePortions,
  type SplitInput,
  sharesAreValid,
  splitAmortise,
  splitYearly,
} from "./split";

function party(overrides: Partial<SplitParty> = {}): SplitParty {
  return {
    id: overrides.id ?? "p",
    name: overrides.name ?? "Party",
    sharePct: 50,
    extraRepayment: cents(0),
    offsetBalance: cents(0),
    interestRate: null,
    lumpSums: [],
    ...overrides,
  };
}

const BASE: SplitInput = {
  currentBalance: cents(100_000_000), // $1,000,000
  interestRate: 0.06,
  termYears: 30,
  repaymentFrequency: "monthly",
  startDate: "2026-01",
  parties: [party({ id: "a", name: "A" }), party({ id: "b", name: "B" })],
};

describe("allocatePortions", () => {
  it("always adds back to the full balance", () => {
    const portions = allocatePortions(cents(100_000_001), [33.33, 33.33, 33.34]);
    expect(portions.reduce((a, b) => a + b, 0)).toBe(100_000_001);
  });

  it("splits 70/30", () => {
    expect(allocatePortions(cents(1_000_000), [70, 30])).toEqual([700_000, 300_000]);
  });
});

describe("sharesAreValid", () => {
  it("needs at least two parties adding to 100%", () => {
    expect(sharesAreValid([{ sharePct: 100 }])).toBe(false);
    expect(sharesAreValid([{ sharePct: 60 }, { sharePct: 30 }])).toBe(false);
    expect(sharesAreValid([{ sharePct: 60 }, { sharePct: 40 }])).toBe(true);
    expect(sharesAreValid([{ sharePct: 33.33 }, { sharePct: 33.33 }, { sharePct: 33.34 }])).toBe(
      true,
    );
  });

  it("returns an empty, invalid result when shares do not add to 100%", () => {
    const r = splitAmortise({
      ...BASE,
      parties: [party({ sharePct: 60 }), party({ sharePct: 30 })],
    });
    expect(r.valid).toBe(false);
    expect(r.shareTotal).toBe(90);
    expect(r.rows).toHaveLength(0);
  });
});

describe("splitAmortise — equal parties, minimum repayments", () => {
  const r = splitAmortise(BASE);

  it("gives each party half the balance and half the minimum", () => {
    expect(r.parties[0].portion).toBe(50_000_000);
    expect(r.parties[1].portion).toBe(50_000_000);
    // PMT of $500k at 6% over 30 yrs monthly = $2,997.75
    expect(r.parties[0].minimumRepayment).toBe(299_775);
    expect(r.combinedMinimum).toBe(599_550);
  });

  it("matches the unsplit loan's total interest within rounding", () => {
    const whole = amortise({
      loanAmount: BASE.currentBalance,
      currentBalance: BASE.currentBalance,
      interestRate: BASE.interestRate,
      termYears: BASE.termYears,
      startDate: BASE.startDate,
      repaymentFrequency: BASE.repaymentFrequency,
      offsetBalance: cents(0),
      redrawBalance: cents(0),
      extraRepayment: cents(0),
    });
    expect(Math.abs(r.totalInterest - whole.totalInterest)).toBeLessThan(100_000); // < $1,000
    expect(r.payoffPeriods).toBe(whole.payoffPeriods);
  });

  it("charges both parties the same interest and pro-rata equals actual", () => {
    expect(r.parties[0].totalInterest).toBe(r.parties[1].totalInterest);
    for (const p of r.parties) {
      expect(Math.abs(p.proRataInterest - p.totalInterest)).toBeLessThanOrEqual(1);
    }
  });
});

describe("splitAmortise — one party pays faster", () => {
  const fast = party({ id: "a", name: "Fast", extraRepayment: cents(200_000) }); // +$2,000/mo
  const slow = party({ id: "b", name: "Slow" });
  const r = splitAmortise({ ...BASE, parties: [fast, slow] });
  const [a, b] = r.parties;

  it("clears the fast party's portion years earlier", () => {
    expect(a.payoffPeriods).toBeLessThan(b.payoffPeriods - 12 * 10);
    expect(a.interestSaved).toBeGreaterThan(0);
    expect(a.periodsSaved).toBeGreaterThan(0);
  });

  it("leaves the slow party exactly on their minimum schedule", () => {
    expect(b.totalInterest).toBe(b.baselineInterest);
    expect(b.interestSaved).toBe(0);
    expect(b.payoffPeriods).toBe(360);
    expect(r.payoffPeriods).toBe(360);
  });

  it("stops charging the fast party once their portion is cleared", () => {
    const after = r.rows[a.payoffPeriods]; // first period after payoff
    expect(after.parties[0].opening).toBe(0);
    expect(after.parties[0].interest).toBe(0);
    expect(after.parties[0].payment).toBe(0);
    expect(after.totalPayment).toBe(after.parties[1].payment);
  });

  it("shows a pro-rata interest split would overcharge the fast party", () => {
    expect(a.proRataInterest).toBeGreaterThan(a.totalInterest);
    expect(b.proRataInterest).toBeLessThan(b.totalInterest);
    expect(a.proRataInterest + b.proRataInterest).toBe(r.totalInterest);
  });

  it("each period's totals equal the sum of the parties", () => {
    for (const row of r.rows) {
      expect(row.totalClosing).toBe(row.parties[0].closing + row.parties[1].closing);
      for (const p of row.parties) {
        expect(p.closing).toBe(Math.max(0, p.opening + p.interest - p.payment));
      }
    }
  });
});

describe("splitAmortise — per-party offset, rate and lump sums", () => {
  it("an offset only reduces its owner's interest", () => {
    const plain = splitAmortise(BASE);
    const r = splitAmortise({
      ...BASE,
      parties: [party({ id: "a", offsetBalance: cents(10_000_000) }), party({ id: "b" })],
    });
    expect(r.parties[0].totalInterest).toBeLessThan(plain.parties[0].totalInterest);
    expect(r.parties[1].totalInterest).toBe(plain.parties[1].totalInterest);
  });

  it("uses a party's own rate when set", () => {
    const r = splitAmortise({
      ...BASE,
      parties: [party({ id: "a", interestRate: 0.05 }), party({ id: "b" })],
    });
    expect(r.parties[0].interestRate).toBe(0.05);
    expect(r.parties[1].interestRate).toBe(0.06);
    expect(r.parties[0].minimumRepayment).toBeLessThan(r.parties[1].minimumRepayment);
  });

  it("applies a lump sum in the first period on or after its month", () => {
    const r = splitAmortise({
      ...BASE,
      parties: [
        party({
          id: "a",
          lumpSums: [{ id: "l", date: "2026-06", amount: cents(5_000_000) }],
        }),
        party({ id: "b" }),
      ],
    });
    const idx = r.rows.findIndex((row) => row.date === "2026-06");
    expect(r.rows[idx].parties[0].extra).toBe(5_000_000);
    expect(r.rows[idx - 1].parties[0].extra).toBe(0);
    expect(r.parties[0].payoffPeriods).toBeLessThan(360);
  });

  it("supports three parties with uneven shares", () => {
    const r = splitAmortise({
      ...BASE,
      parties: [
        party({ id: "a", sharePct: 50 }),
        party({ id: "b", sharePct: 30 }),
        party({ id: "c", sharePct: 20 }),
      ],
    });
    expect(r.parties.map((p) => p.portion)).toEqual([50_000_000, 30_000_000, 20_000_000]);
  });
});

describe("splitYearly", () => {
  it("rolls up to one row per year with matching totals", () => {
    const r = splitAmortise({
      ...BASE,
      parties: [party({ id: "a", extraRepayment: cents(100_000) }), party({ id: "b" })],
    });
    const years = splitYearly(r, "monthly");
    expect(years).toHaveLength(30);
    const paid = years.reduce((s, y) => s + y.totalPaid, 0);
    expect(paid).toBe(r.totalPaid);
    expect(years[years.length - 1].totalClosing).toBe(0);
  });
});
