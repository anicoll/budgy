import { describe, expect, it } from "vitest";
import { cents } from "../money/cents";
import { checkRate, type RateCheckInput, validateRateCheck } from "./rateCheck";
import { averageRatesFor, RBA_HOUSING_RATES, type RbaHousingRates } from "./rbaRates";
import { simulateLoan } from "./simulate";

const BASE: RateCheckInput = {
  balance: cents(52_000_000), // $520,000
  annualRate: 0.0669,
  termMonths: 300,
  purpose: "owner-occupier",
  repayment: "principal-and-interest",
};

// Fixed averages so the tests don't move when the snapshot is updated.
const DATA: RbaHousingRates = {
  ...RBA_HOUSING_RATES,
  month: "2026-08",
  rates: {
    "owner-occupier": {
      all: { new: 0.0624, outstanding: 0.0621 },
      variable: { new: 0.0615, outstanding: 0.0619 },
      "fixed-up-to-3-years": { new: 0.0626, outstanding: 0.0561 },
      "fixed-over-3-years": { new: 0.0685, outstanding: 0.0615 },
      "principal-and-interest": { new: 0.0615, outstanding: 0.0619 },
      "interest-only": { new: 0.0704, outstanding: 0.0685 },
    },
    investor: {
      all: { new: 0.064, outstanding: 0.0644 },
      variable: { new: 0.064, outstanding: 0.0647 },
      "fixed-up-to-3-years": { new: 0.0646, outstanding: 0.0574 },
      "fixed-over-3-years": { new: 0.0758, outstanding: 0.0653 },
      "principal-and-interest": { new: 0.0632, outstanding: 0.0638 },
      "interest-only": { new: 0.0651, outstanding: 0.0657 },
    },
  },
};

describe("checkRate", () => {
  it("prices a rate above the new-loan average", () => {
    const r = checkRate(BASE, DATA);
    expect(r.verdict).toBe("above");
    expect(r.newLoans.averageRate).toBe(0.0615);
    expect(r.newLoans.gap).toBe(0.0054);
    expect(r.existingLoans.gap).toBe(0.005);
    // Textbook PMT says about $3,573 vs $3,398 a month on $520k over 25 years.
    expect(r.newLoans.monthlyRepaymentGap).toBeGreaterThan(17_000);
    expect(r.newLoans.monthlyRepaymentGap).toBeLessThan(18_000);
    // First-year interest is close to balance x gap, a bit less as the balance falls.
    expect(r.newLoans.firstYearInterestGap).toBeGreaterThan(cents(250_000));
    expect(r.newLoans.firstYearInterestGap).toBeLessThan(cents(52_000_000 * 0.0054));
    // About $52k more interest over the life of the loan.
    expect(r.newLoans.lifetimeInterestGap).toBeGreaterThan(cents(5_000_000));
    expect(r.newLoans.lifetimeInterestGap).toBeLessThan(cents(5_500_000));
    expect(r.existingLoans.lifetimeInterestGap).toBeLessThan(r.newLoans.lifetimeInterestGap ?? 0);
  });

  it("matches the mortgage simulation exactly", () => {
    const r = checkRate(BASE, DATA);
    const sim = (annualRate: number) =>
      simulateLoan({
        balance: BASE.balance,
        annualRate,
        termMonths: BASE.termMonths,
        startDate: "2026-01-01",
        frequency: "monthly",
      });
    const yours = sim(0.0669);
    const avg = sim(0.0615);
    expect(r.newLoans.monthlyRepaymentGap).toBe(yours.minimumRepayment - avg.minimumRepayment);
    expect(r.newLoans.firstYearInterestGap).toBe(yours.yearly[0].interest - avg.yearly[0].interest);
    expect(r.newLoans.lifetimeInterestGap).toBe(yours.totalInterest - avg.totalInterest);
  });

  it("shows a saving as negative gaps when you pay less", () => {
    const r = checkRate({ ...BASE, annualRate: 0.0589 }, DATA);
    expect(r.verdict).toBe("below");
    expect(r.newLoans.gap).toBe(-0.0026);
    expect(r.newLoans.monthlyRepaymentGap).toBeLessThan(0);
    expect(r.newLoans.lifetimeInterestGap).toBeLessThan(0);
  });

  it("calls a rate within 0.10% of the new-loan average about average", () => {
    expect(checkRate({ ...BASE, annualRate: 0.0625 }, DATA).verdict).toBe("about");
    expect(checkRate({ ...BASE, annualRate: 0.0605 }, DATA).verdict).toBe("about");
    expect(checkRate({ ...BASE, annualRate: 0.0626 }, DATA).verdict).toBe("above");
    expect(checkRate({ ...BASE, annualRate: 0.0604 }, DATA).verdict).toBe("below");
  });

  it("the same rate as the average costs nothing", () => {
    const r = checkRate({ ...BASE, annualRate: 0.0615 }, DATA);
    expect(r.newLoans).toMatchObject({
      gap: 0,
      monthlyRepaymentGap: 0,
      firstYearInterestGap: 0,
      lifetimeInterestGap: 0,
    });
  });

  it("uses investor and interest-only averages", () => {
    const r = checkRate(
      { ...BASE, purpose: "investor", repayment: "interest-only", annualRate: 0.0701 },
      DATA,
    );
    expect(r.newLoans.averageRate).toBe(0.0651);
    expect(r.existingLoans.averageRate).toBe(0.0657);
    // Interest only: $520,000 x 0.50% = $2,600 a year, $216.67 a month.
    expect(r.newLoans.firstYearInterestGap).toBe(cents(260_000));
    expect(r.newLoans.monthlyRepaymentGap).toBe(cents(21_667));
    expect(r.newLoans.lifetimeInterestGap).toBeNull();
  });

  it("compares fixed loans with the fixed averages for their term", () => {
    const short = checkRate({ ...BASE, rateType: "fixed-up-to-3-years" }, DATA);
    expect(short.series).toBe("fixed-up-to-3-years");
    expect(short.newLoans.averageRate).toBe(0.0626);
    expect(short.existingLoans.averageRate).toBe(0.0561);
    const long = checkRate({ ...BASE, rateType: "fixed-over-3-years" }, DATA);
    expect(long.newLoans.averageRate).toBe(0.0685);
  });

  it("compares interest-only loans with the interest-only averages, whatever the rate type", () => {
    const r = checkRate(
      { ...BASE, repayment: "interest-only", rateType: "fixed-up-to-3-years" },
      DATA,
    );
    expect(r.series).toBe("interest-only");
    expect(r.newLoans.averageRate).toBe(0.0704);
  });

  it("defaults to a variable loan and the bundled RBA snapshot", () => {
    const r = checkRate(BASE);
    expect(r.month).toBe(RBA_HOUSING_RATES.month);
    expect(r.series).toBe("variable");
    expect(r.newLoans.averageRate).toBe(averageRatesFor("owner-occupier", "variable").new);
  });

  it("rejects bad input", () => {
    expect(validateRateCheck({ ...BASE, balance: cents(0) })).toHaveLength(1);
    expect(validateRateCheck({ ...BASE, annualRate: 0.25 })).toHaveLength(1);
    expect(validateRateCheck({ ...BASE, termMonths: 0 })).toHaveLength(1);
    // @ts-expect-error not a rate type
    expect(validateRateCheck({ ...BASE, rateType: "split" })).toHaveLength(1);
    expect(() => checkRate({ ...BASE, annualRate: -0.01 })).toThrow(RangeError);
  });
});

describe("RBA snapshot", () => {
  it("has a sensible rate for every loan type", () => {
    expect(RBA_HOUSING_RATES.month).toMatch(/^\d{4}-\d{2}$/);
    for (const purpose of Object.values(RBA_HOUSING_RATES.rates))
      for (const pair of Object.values(purpose))
        for (const rate of [pair.new, pair.outstanding]) {
          expect(rate).toBeGreaterThan(0.02);
          expect(rate).toBeLessThan(0.12);
        }
  });
});
