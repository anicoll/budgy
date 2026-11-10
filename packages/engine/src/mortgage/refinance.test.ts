import { describe, expect, it } from "vitest";
import { addMonths } from "../dates";
import { cents } from "../money/cents";
import {
  benefitAfterMonths,
  compareOffers,
  compareRefinance,
  proposedLoanInput,
  type RefinanceInput,
} from "./refinance";
import { minimumRepayment, simulateLoan } from "./simulate";

const CURRENT = {
  balance: cents(50_000_000), // $500,000
  annualRate: 0.065,
  termMonths: 300,
  startDate: "2026-01-15",
  frequency: "monthly" as const,
};

const BASE: RefinanceInput = {
  current: CURRENT,
  proposed: { annualRate: 0.0599 },
  repayment: "keep",
  switchingCosts: cents(150_000), // $1,500
  cashback: cents(0),
};

describe("compareRefinance", () => {
  it("with no costs and the same loan, nothing changes", () => {
    const r = compareRefinance({
      ...BASE,
      proposed: { annualRate: CURRENT.annualRate },
      switchingCosts: cents(0),
    });
    expect(r.interestSaved).toBe(0);
    expect(r.lifetimeBenefit).toBe(0);
    expect(r.breakEvenMonths).toBe(0);
    expect(r.timeline.every((p) => p.benefit === 0)).toBe(true);
  });

  it("a lower rate breaks even once the interest saved covers the costs", () => {
    const r = compareRefinance(BASE);
    expect(r.timeline[0].benefit).toBe(-150_000);
    expect(r.breakEvenMonths).not.toBeNull();
    // About $2,500 a year less interest on $500k at 0.51% lower: $1,500 back in roughly 7 months.
    expect(r.breakEvenMonths).toBeGreaterThanOrEqual(6);
    expect(r.breakEvenMonths).toBeLessThanOrEqual(8);
    const m = r.breakEvenMonths as number;
    expect(r.timeline[m - 1].benefit).toBeLessThan(0);
    expect(r.timeline[m].benefit).toBeGreaterThanOrEqual(0);
    expect(r.breakEvenDate).toBe(addMonths(CURRENT.startDate, m));
  });

  it("keeping the same repayment finishes sooner than the current loan", () => {
    const r = compareRefinance(BASE);
    expect(r.proposed.payoffDate < r.current.payoffDate).toBe(true);
    expect(r.repaymentChange).toBe(0);
  });

  it("taking the new minimum lowers the repayment but keeps the term", () => {
    const r = compareRefinance({ ...BASE, repayment: "minimum" });
    expect(r.repaymentChange).toBeLessThan(0);
    expect(r.proposed.repayment).toBe(minimumRepayment(50_000_000, 0.0599, 300, "monthly"));
    expect(Math.abs(r.repaymentChange)).toBeGreaterThan(14_000); // about $150 a month
  });

  it("the last point of the timeline is the lifetime benefit", () => {
    for (const repayment of ["keep", "minimum"] as const) {
      const r = compareRefinance({ ...BASE, repayment, cashback: cents(200_000) });
      expect(r.timeline.at(-1)?.benefit).toBe(r.lifetimeBenefit);
      expect(r.lifetimeBenefit).toBe(r.interestSaved + 200_000 - 150_000);
    }
  });

  it("cashback above the costs breaks even on day one", () => {
    const r = compareRefinance({ ...BASE, cashback: cents(300_000) });
    expect(r.netUpfrontCost).toBe(-150_000);
    expect(r.breakEvenMonths).toBe(0);
  });

  it("a higher rate never breaks even", () => {
    const r = compareRefinance({ ...BASE, proposed: { annualRate: 0.07 } });
    expect(r.breakEvenDate).toBeNull();
    expect(r.lifetimeBenefit).toBeLessThan(0);
  });

  it("costs added to the loan grow the balance and are paid through interest", () => {
    const r = compareRefinance({ ...BASE, addCostsToLoan: true });
    expect(r.proposedInput.balance).toBe(50_150_000);
    expect(r.timeline[0].benefit).toBe(-150_000);
    const paidUpFront = compareRefinance(BASE);
    // Borrowing the costs costs interest on them, so it is a little worse.
    expect(r.lifetimeBenefit).toBeLessThan(paidUpFront.lifetimeBenefit);
    expect(r.timeline.at(-1)?.benefit).toBe(r.lifetimeBenefit);
  });

  it("a longer new term can break even early but cost more over the life", () => {
    const r = compareRefinance({
      ...BASE,
      repayment: "minimum",
      proposed: { annualRate: 0.0599, termMonths: 360 },
    });
    expect(r.breakEvenMonths).not.toBeNull();
    expect(r.lifetimeBenefit).toBeLessThan(0);
    expect(r.warnings.join(" ")).toMatch(/longer term/);
  });

  it("ongoing fees count, a twelfth a month while each loan is open", () => {
    const noFees = compareRefinance(BASE);
    const r = compareRefinance({
      ...BASE,
      currentAnnualFee: cents(39_500),
      proposedAnnualFee: cents(0),
    });
    expect(r.timeline[12].benefit - noFees.timeline[12].benefit).toBe(39_500);
    expect(r.breakEvenMonths as number).toBeLessThan(noFees.breakEvenMonths as number);
  });

  it("a honeymoon rate that reverts is modelled with rate changes", () => {
    const r = compareRefinance({
      ...BASE,
      repayment: "minimum",
      proposed: {
        annualRate: 0.0549,
        rateChanges: [{ date: addMonths(CURRENT.startDate, 24), annualRate: 0.0699 }],
      },
    });
    expect(r.breakEvenMonths).not.toBeNull();
    expect(r.lifetimeBenefit).toBeLessThan(0);
  });

  it("keep never pays less than the new minimum on a longer, bigger loan", () => {
    const input: RefinanceInput = {
      ...BASE,
      current: { ...CURRENT, termMonths: 12 },
      proposed: { annualRate: 0.0599, termMonths: 12 },
      addCostsToLoan: true,
      switchingCosts: cents(5_000_000),
    };
    const loan = proposedLoanInput(input);
    expect(loan.repayment).toBe(minimumRepayment(loan.balance, 0.0599, 12, "monthly"));
    expect(simulateLoan(loan).warnings).toEqual([]);
  });

  it("rejects bad input", () => {
    expect(() =>
      compareRefinance({ ...BASE, proposed: { annualRate: 0.5 }, cashback: -1 as never }),
    ).toThrow(/new rate.*cashback/);
  });
});

describe("compareOffers", () => {
  const a = compareRefinance(BASE);
  const worse = compareRefinance({ ...BASE, proposed: { annualRate: 0.0625 } });
  const better = compareRefinance({ ...BASE, proposed: { annualRate: 0.0575 } });

  it("picks the offer that leaves you further ahead", () => {
    const c = compareOffers(a, better, 5);
    expect(c.winner).toBe("b");
    expect(c.difference).toBe(c.benefitB - c.benefitA);
    expect(c.difference).toBeGreaterThan(0);
    expect(compareOffers(a, worse, 5).winner).toBe("a");
    expect(compareOffers(worse, a, 5).winner).toBe("b");
  });

  it("calls identical offers a tie", () => {
    const c = compareOffers(a, compareRefinance(BASE));
    expect(c).toMatchObject({ winner: "tie", difference: 0 });
  });

  it("counts cashback and switching costs", () => {
    const cheaperRate = compareRefinance({ ...BASE, proposed: { annualRate: 0.0589 } });
    const cashback = compareRefinance({ ...BASE, cashback: cents(400_000) });
    expect(compareOffers(cheaperRate, cashback, 1).winner).toBe("b");
    expect(compareOffers(cheaperRate, cashback, 30).winner).toBe("a");
  });

  it("treats a gap within the tolerance as a tie", () => {
    const near = compareRefinance({ ...BASE, cashback: cents(50) });
    expect(compareOffers(a, near, 5).winner).toBe("tie");
    expect(compareOffers(a, near, 5, cents(10)).winner).toBe("b");
  });

  it("reads years past the end of the loan from the last point", () => {
    expect(benefitAfterMonths(a, 10_000)).toBe(a.lifetimeBenefit);
  });
});
