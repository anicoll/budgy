import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { minimumRepayment } from "../mortgage/simulate";
import { LOAN_600K_6PC_30Y } from "./cases";
import { CBA_REPAYMENTS, MONEYSMART_MORTGAGE } from "./sources";

/**
 * Lender worked examples. Calculators agree on the monthly repayment but
 * round it differently, and they disagree on fortnightly and weekly:
 *
 * - Moneysmart shows a true fortnightly or weekly annuity (the loan's rate
 *   over 26 or 52 periods a year), to the nearest dollar.
 * - CommBank shows the monthly repayment × 12 ÷ 26 (or ÷ 52), rounded up to
 *   the dollar, and rounds the monthly up too.
 * - Many lenders also offer "half the monthly", which the engine defaults to
 *   for fortnightly because it's what most people are put on.
 *
 * The engine works in cents, so these check that its figure rounds to what
 * each calculator shows.
 */

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;
const up = (cents: number) => Math.ceil(cents / 100);

const LOANS = [
  // amount, rate, years, Moneysmart [monthly, fortnightly, weekly], CommBank [monthly, fortnightly, weekly]
  {
    amount: 600_000,
    rate: 0.06,
    years: 30,
    moneysmart: [3_597, 1_659, 830],
    cba: [3_598, 1_661, 831],
  },
  { amount: 450_000, rate: 0.0549, years: 25, moneysmart: null, cba: [2_761, 1_275, 638] },
] as const;

describe("monthly repayment, to the cent", () => {
  it(`${LOAN_600K_6PC_30Y.name} is $3,597.31`, () => {
    const { amount, rate, years } = LOAN_600K_6PC_30Y.input;
    const m = minimumRepayment(c(amount), rate, years * 12, "monthly");
    expect(d(m)).toBe(LOAN_600K_6PC_30Y.expected.monthly);
  });
});

describe(`Moneysmart: ${MONEYSMART_MORTGAGE.name}`, () => {
  for (const loan of LOANS) {
    if (!loan.moneysmart) continue;
    const { amount, rate, years } = loan;
    const [monthly, fortnightly, weekly] = loan.moneysmart;
    const pay = (f: "monthly" | "fortnightly" | "weekly") =>
      minimumRepayment(c(amount), rate, years * 12, f, "true");

    // Moneysmart rounds the exact figure to the dollar; the engine rounds it up
    // to the cent first ($1,659.498 becomes $1,659.50), so allow that half dollar.
    it(`$${amount} at ${rate * 100}% over ${years} years`, () => {
      expect(Math.abs(d(pay("monthly")) - monthly)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(d(pay("fortnightly")) - fortnightly)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(d(pay("weekly")) - weekly)).toBeLessThanOrEqual(0.5);
    });
  }

  it("total repayments over the term match Moneysmart's $1,295,029 a month", () => {
    // Moneysmart multiplies the unrounded repayment by the number of payments.
    const exact = (600_000 * 0.005) / (1 - 1.005 ** -360);
    expect(Math.round(exact * 360)).toBe(1_295_029);
    expect(d(minimumRepayment(c(600_000), 0.06, 360, "monthly")) - exact).toBeLessThan(0.01);
  });
});

describe(`CommBank: ${CBA_REPAYMENTS.name}`, () => {
  for (const loan of LOANS) {
    const { amount, rate, years } = loan;
    const [monthly, fortnightly, weekly] = loan.cba;
    const m = minimumRepayment(c(amount), rate, years * 12, "monthly");

    it(`$${amount} at ${(rate * 100).toFixed(2)}% over ${years} years`, () => {
      expect(up(m)).toBe(monthly);
      expect(up((m * 12) / 26)).toBe(fortnightly);
      expect(up((m * 12) / 52)).toBe(weekly);
    });
  }
});

describe("half-monthly fortnightly repayments", () => {
  it("are half the monthly, rounded up to the cent", () => {
    const m = minimumRepayment(c(600_000), 0.06, 360, "monthly");
    const f = minimumRepayment(c(600_000), 0.06, 360, "fortnightly");
    expect(d(f)).toBe(1_798.66);
    expect(f).toBe(Math.ceil(m / 2));
    // 26 half-repayments a year is 13 monthly ones: an extra month a year.
    expect(d(f * 26 - m * 12)).toBeCloseTo(d(m), 0);
  });
});
