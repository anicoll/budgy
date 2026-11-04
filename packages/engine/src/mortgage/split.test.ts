import { describe, expect, it } from "vitest";
import { cents } from "../money/cents";
import { amortise } from "./amortise";
import {
  allocatePortions,
  evenShares,
  removeParty,
  type SplitInput,
  setShare,
  sharesAreValid,
  splitAmortise,
  splitYearly,
} from "./split";
import type { SplitParty } from "./types";

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
    expect(r.parties).toHaveLength(0);
  });
});

describe("splitAmortise — equal parties, minimum repayments", () => {
  const r = splitAmortise(BASE);

  it("gives each party half the balance and half the minimum", () => {
    expect(r.parties[0].portion).toBe(50_000_000);
    expect(r.parties[1].portion).toBe(50_000_000);
    // PMT of $500k at 6% over 30 yrs monthly = $2,997.75
    expect(r.parties[0].minimumRepayment).toBe(299_775);
    expect(r.monthlyMinimum).toBe(599_550);
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
    expect(r.parties[0].payoffPeriods).toBe(whole.payoffPeriods);
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
    expect(r.payoffDate).toBe(b.payoffDate);
  });

  it("stops charging the fast party once their portion is cleared", () => {
    expect(a.periods).toHaveLength(a.payoffPeriods);
    expect(a.periods[a.periods.length - 1].closing).toBe(0);
    const years = splitYearly(r, BASE.startDate);
    const afterYear = years[Math.ceil(a.payoffPeriods / 12)];
    expect(afterYear.parties[0]).toEqual({ paid: 0, interest: 0, closing: 0 });
    expect(afterYear.totalPaid).toBe(afterYear.parties[1].paid);
  });

  it("shows a pro-rata interest split would overcharge the fast party", () => {
    expect(a.proRataInterest).toBeGreaterThan(a.totalInterest);
    expect(b.proRataInterest).toBeLessThan(b.totalInterest);
    expect(a.proRataInterest + b.proRataInterest).toBe(r.totalInterest);
  });

  it("every period balances: closing = opening + interest - payment", () => {
    for (const party of r.parties) {
      for (const p of party.periods) {
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
    const periods = r.parties[0].periods;
    const idx = periods.findIndex((row) => row.date === "2026-06");
    expect(periods[idx].extra).toBe(5_000_000);
    expect(periods[idx - 1].extra).toBe(0);
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
    const years = splitYearly(r, BASE.startDate);
    expect(years).toHaveLength(30);
    const paid = years.reduce((s, y) => s + y.totalPaid, 0);
    expect(paid).toBe(r.totalPaid);
    expect(years[years.length - 1].totalClosing).toBe(0);
  });
});

describe("splitAmortise — different repayment cadences", () => {
  const r = splitAmortise({
    ...BASE,
    parties: [
      party({ id: "a", repaymentFrequency: "fortnightly" }),
      party({ id: "b", repaymentFrequency: null }),
    ],
  });
  const [a, b] = r.parties;

  it("runs each share on its own frequency", () => {
    expect(a.repaymentFrequency).toBe("fortnightly");
    expect(b.repaymentFrequency).toBe("monthly");
    expect(a.payoffPeriods).toBe(30 * 26);
    expect(b.payoffPeriods).toBe(30 * 12);
    expect(a.minimumRepayment).toBeLessThan(b.minimumRepayment);
  });

  it("fortnightly minimums cost slightly less interest than monthly", () => {
    expect(a.totalInterest).toBeLessThan(b.totalInterest);
    expect(a.totalInterest).toBeGreaterThan(b.totalInterest * 0.98);
  });

  it("expresses the combined minimum per month", () => {
    const expected = Math.round((a.minimumRepayment * 26) / 12 + b.minimumRepayment);
    expect(r.monthlyMinimum).toBe(expected);
  });

  it("rolls both cadences into the same projection years", () => {
    const years = splitYearly(r, BASE.startDate);
    expect(years).toHaveLength(30);
    expect(years[0].parties[0].paid).toBe(a.minimumRepayment * 26);
    expect(years[0].parties[1].paid).toBe(b.minimumRepayment * 12);
    expect(years[29].totalClosing).toBe(0);
    expect(years.reduce((s, y) => s + y.totalPaid, 0)).toBe(r.totalPaid);
  });
});

describe("share editing", () => {
  const two = [
    { id: "a", sharePct: 50 },
    { id: "b", sharePct: 50 },
  ];
  const three = [
    { id: "a", sharePct: 50 },
    { id: "b", sharePct: 30 },
    { id: "c", sharePct: 20 },
  ];

  it("setting one of two shares sets the other to the remainder", () => {
    expect(setShare(two, "a", 65).map((p) => p.sharePct)).toEqual([65, 35]);
    expect(setShare(two, "b", 100).map((p) => p.sharePct)).toEqual([0, 100]);
  });

  it("clamps out-of-range values", () => {
    expect(setShare(two, "a", 140).map((p) => p.sharePct)).toEqual([100, 0]);
    expect(setShare(two, "a", -5).map((p) => p.sharePct)).toEqual([0, 100]);
  });

  it("spreads the remainder over other shares in proportion", () => {
    // Others were 30:20, so the remaining 40% splits 24:16.
    expect(setShare(three, "a", 60).map((p) => p.sharePct)).toEqual([60, 24, 16]);
  });

  it("spreads evenly when the others are all zero", () => {
    const zeros = [
      { id: "a", sharePct: 100 },
      { id: "b", sharePct: 0 },
      { id: "c", sharePct: 0 },
    ];
    expect(setShare(zeros, "a", 40).map((p) => p.sharePct)).toEqual([40, 30, 30]);
  });

  it("always totals exactly 100", () => {
    for (const pct of [0, 12.34, 33.33, 66.67, 99.99]) {
      const total = setShare(three, "b", pct).reduce((s, p) => s + p.sharePct, 0);
      expect(Math.round(total * 100)).toBe(10_000);
    }
  });

  it("rounds to the nearest hundredth without drifting", () => {
    const after = setShare(
      [
        { id: "a", sharePct: 70 },
        { id: "b", sharePct: 30 },
        { id: "c", sharePct: 0 },
      ],
      "c",
      33.33,
    );
    expect(after.map((p) => p.sharePct)).toEqual([46.67, 20, 33.33]);
  });

  it("removing a party hands its share to the rest", () => {
    expect(removeParty(three, "c").map((p) => p.sharePct)).toEqual([62.5, 37.5]);
  });

  it("evenShares totals 100", () => {
    expect(evenShares(3)).toEqual([33.33, 33.33, 33.34]);
  });
});
