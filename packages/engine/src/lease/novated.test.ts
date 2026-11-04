import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  atoResidual,
  calculateNovatedLease,
  compareLeaseTerms,
  fbtTreatment,
  impliedLeaseRate,
  leaseRental,
  luxuryCarTax,
  type NovatedLeaseInput,
  validateLease,
} from "./novated";
import { CAR_RULES, carRulesFor } from "./rules";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const r2627 = carRulesFor("2026-12-01").rules;

const base: NovatedLeaseInput = {
  pay: { year: "2026-27", salary: c(120_000) },
  car: "ev",
  price: c(60_000),
  onRoadCosts: c(3_000),
  start: "2026-12-01",
  termYears: 3,
  rate: 0.075,
  managementFee: c(500),
  running: {
    energy: c(800),
    registration: c(900),
    insurance: c(1_500),
    tyres: c(300),
    maintenance: c(400),
  },
  loanRate: 0.085,
  savingsRate: 0.045,
};
const lease = (over: Partial<NovatedLeaseInput> = {}) =>
  calculateNovatedLease({ ...base, ...over });

describe("rules", () => {
  it("picks the year and carries the last one forward", () => {
    expect(carRulesFor("2026-07-01").rules.year).toBe("2026-27");
    expect(carRulesFor("2026-06-30").rules.year).toBe("2025-26");
    const later = carRulesFor("2031-01-01");
    expect(later.carriedForward).toBe(true);
    expect(later.rules.year).toBe(CAR_RULES[CAR_RULES.length - 1].year);
  });

  it("has the 2026-27 thresholds", () => {
    expect(r2627.lctFuelEfficient).toBe(c(91_661));
    expect(r2627.lctOther).toBe(c(80_809));
    expect(r2627.carLimit).toBe(c(69_883));
  });

  it("uses the ATO minimum residuals", () => {
    expect([1, 2, 3, 4, 5].map(atoResidual)).toEqual([0.6563, 0.5625, 0.4688, 0.375, 0.2813]);
  });
});

describe("fbtTreatment", () => {
  const t = (car: "ev" | "phev" | "ice", price: number, start: string) =>
    fbtTreatment(car, c(price), start, carRulesFor(start).rules);

  it("exempts an electric car under the price cap", () => {
    expect(t("ev", 60_000, "2026-12-01")).toEqual({
      treatment: "exempt",
      reason: "ev",
      proposed: false,
    });
    expect(t("ev", 91_661, "2026-12-01").treatment).toBe("exempt");
  });

  it("taxes an electric car over the cap", () => {
    expect(t("ev", 91_662, "2026-12-01").reason).toBe("ev-over-cap");
  });

  it("applies the proposed discount to dearer EVs from April 2027 and all EVs from April 2029", () => {
    expect(t("ev", 75_000, "2027-04-01").treatment).toBe("exempt");
    expect(t("ev", 75_001, "2027-04-01")).toEqual({
      treatment: "discounted",
      reason: "ev-discount-over-75k",
      proposed: true,
    });
    expect(t("ev", 80_000, "2027-03-31").treatment).toBe("exempt");
    expect(t("ev", 40_000, "2029-04-01").reason).toBe("ev-discount-all");
  });

  it("only exempts plug-in hybrids leased before April 2025", () => {
    expect(t("phev", 60_000, "2025-03-31").treatment).toBe("exempt");
    expect(t("phev", 60_000, "2025-04-01").treatment).toBe("taxed");
    expect(t("ice", 30_000, "2026-12-01").treatment).toBe("taxed");
  });
});

describe("car maths", () => {
  it("backs luxury car tax out of a GST and LCT inclusive price", () => {
    // Value V without LCT: V + 0.33 × (V − 80,809) / 1.1 = 100,000.
    const lct = luxuryCarTax(c(100_000), "ice", r2627);
    expect(lct).toBe(c(4_428.69));
    const v = 100_000 - lct / 100;
    expect((0.33 * (v - 80_809)) / 1.1).toBeCloseTo(lct / 100, 1);
    expect(luxuryCarTax(c(90_000), "ev", r2627)).toBe(0);
  });

  it("pays the lease down to the residual", () => {
    expect(leaseRental(c(36_000), 0, 0, 36)).toBe(c(1_000));
    const rental = leaseRental(c(50_000), c(20_000), 0.06, 48);
    // Balance after 48 payments at 0.5% a month equals the residual.
    let bal = 50_000_00;
    for (let i = 0; i < 48; i++) bal = bal * 1.005 - rental;
    expect(Math.abs(bal - 20_000_00)).toBeLessThan(50);
  });

  it("finds the rate a quote implies", () => {
    const rental = leaseRental(c(57_545.45), c(26_977.31), 0.075, 36);
    expect(impliedLeaseRate(c(57_545.45), c(26_977.31), 36, rental)).toBeCloseTo(0.075, 4);
    expect(impliedLeaseRate(c(57_545.45), c(26_977.31), 36, c(1_160))).toBeCloseTo(0.0861, 4);
    expect(impliedLeaseRate(c(50_000), c(20_000), 36, c(1))).toBeNull();
  });
});

describe("calculateNovatedLease", () => {
  it("packages an exempt EV entirely before tax", () => {
    const r = lease();
    expect(r.gstCredit).toBe(c(5_454.55));
    expect(r.financed).toBe(c(57_545.45));
    expect(r.residualRate).toBe(0.4688);
    expect(r.residual).toBe(c(26_977.31));
    expect(r.residualWithGst).toBe(c(29_675.04));
    // Running costs lose their GST, except registration.
    expect(r.runningPackaged).toBe(c((800 + 1_500 + 300 + 400) / 1.1 + 900));
    const y = r.years[0];
    expect(y.packageCost).toBe(r.monthlyRental * 12 + r.runningPackaged + r.managementFeePackaged);
    expect(y.postTax).toBe(0);
    expect(y.preTax).toBe(y.packageCost);
    // 30% tax and 2% Medicare at $120,000.
    expect(y.taxSaved / y.preTax).toBeCloseTo(0.32, 3);
    expect(y.cost).toBe(y.preTax - y.taxSaved);
    // Exempt, but still reportable: 20% of the price, grossed up at 1.8868.
    expect(y.reportable).toBe(c(22_641.6));
    expect(r.warnings).toEqual([]);
  });

  it("covers FBT from after-tax pay on a petrol car", () => {
    const r = lease({ car: "ice" });
    const y = r.years[0];
    expect(r.fbt.treatment).toBe("taxed");
    expect(y.postTax).toBe(c(12_000));
    // The contribution includes GST, so it covers 10/11ths of its amount.
    expect(y.preTax).toBe(y.packageCost - c(12_000 / 1.1));
    expect(y.reportable).toBe(0);
    expect(y.cost).toBe(y.preTax + y.postTax - y.taxSaved);
    expect(r.fbt.fbtWithoutContribution).toBe(c(12_000 * 2.0802 * 0.47));
  });

  it("takes a quarter off the taxable value under the proposed discount", () => {
    const r = lease({ price: c(80_000), start: "2027-06-01" });
    expect(r.fbt.treatment).toBe("discounted");
    const y = r.years[0];
    expect(y.postTax).toBe(c(16_000 * 0.75));
    expect(y.reportable).toBe(c(16_000 * 0.25 * 1.8868));
    expect(r.warnings).toContainEqual({ kind: "proposed-ev-rules" });
  });

  it("caps the GST credit at the car limit", () => {
    const r = lease({ price: c(90_000) });
    expect(r.gstCredit).toBe(c(6_353));
  });

  it("drops the base value by a third in year five", () => {
    const r = lease({ car: "ice", termYears: 5 });
    expect(r.years.map((y) => y.postTax)).toEqual([
      c(12_000),
      c(12_000),
      c(12_000),
      c(12_000),
      c(8_000),
    ]);
    expect(r.warnings).toContainEqual({ kind: "base-value-reduced" });
  });

  it("counts reportable benefits for the Medicare levy surcharge", () => {
    const pay = { year: "2026-27", salary: c(100_000), hospitalCover: false };
    const r = lease({ pay });
    const y = r.years[0];
    expect(y.payBefore.surcharge).toBe(0);
    // Taxable income falls, but taxable income plus $22,641.60 of benefits is over $105,000.
    expect(y.payAfter.surcharge).toBeGreaterThan(0);
  });

  it("adds up the term and compares with cash and a loan", () => {
    const r = lease();
    expect(r.totals.cost).toBe(r.years.reduce((a, y) => a + y.cost, 0));
    expect(r.lease.total).toBe(r.totals.cost + r.residualWithGst);
    const running = 800 + 900 + 1_500 + 300 + 400;
    expect(r.cash.upfront).toBe(c(63_000));
    expect(r.cash.lostInterest).toBe(c(63_000 * ((1 + 0.045 * (1 - 0.32)) ** 3 - 1)));
    expect(r.cash.total).toBe(r.cash.upfront + c(running * 3) + r.cash.lostInterest);
    expect(r.loan).not.toBeNull();
    expect(r.loan?.total).toBe((r.loan?.repayment ?? 0) * 36 + c(running * 3));
    expect(lease({ loanRate: undefined }).loan).toBeNull();
    expect(lease({ savingsRate: undefined }).cash.lostInterest).toBe(0);
  });

  it("splits the first year into pay periods", () => {
    const r = lease();
    expect(r.perPay.fortnightly.cost).toBe(Math.round(r.years[0].cost / 26));
    expect(r.perPay.monthly.preTax).toBe(Math.round(r.years[0].preTax / 12));
  });

  it("warns about a residual below the ATO minimum", () => {
    expect(lease({ residualRate: 0.3 }).warnings).toContainEqual({
      kind: "residual-below-ato",
      minimum: 0.4688,
    });
  });

  it("compares every term at its own minimum residual", () => {
    const rows = compareLeaseTerms({ ...base, residualRate: 0.6 });
    expect(rows.map((r) => r.termYears)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((r) => r.residualRate)).toEqual([0.6563, 0.5625, 0.4688, 0.375, 0.2813]);
  });
});

describe("a provider-style quote", () => {
  // Laid out the way a provider's quote is: a $76,700 EV over the car limit,
  // SA on-roads, a PPSR fee financed, monthly budgets without GST, an
  // establishment fee spread over the term and a luxury car charge.
  const m = (monthly: number) => c(monthly * 12);
  const quote: NovatedLeaseInput = {
    ...base,
    pay: { year: "2026-27", salary: c(150_000) },
    price: c(76_700.01),
    onRoadCosts: c(4_003.01),
    financedFees: c(29.95),
    rate: 0.0926,
    managementFee: m(19),
    establishmentFee: c(195.12),
    otherCharges: m(28.44),
    amountsExGst: true,
    running: {
      energy: m(68.38),
      registration: m(39.82),
      insurance: m(200),
      tyres: m(69.11),
      maintenance: m(38.11),
    },
  };

  it("finances the drive-away price less the capped GST credit, plus fees", () => {
    const r = calculateNovatedLease(quote);
    expect(r.gstCredit).toBe(c(6_353));
    expect(Math.abs(r.financed - c(74_379.96))).toBeLessThanOrEqual(1);
    expect(r.residual).toBe(c(34_869.33));
    expect(r.residualWithGst).toBe(c(38_356.26));
  });

  it("adds up to the quote's monthly total at the rate it implies", () => {
    const r0 = calculateNovatedLease(quote);
    const rate = impliedLeaseRate(r0.financed, r0.residual, 36, c(1_530.29));
    expect(rate).not.toBeNull();
    const r = calculateNovatedLease({ ...quote, rate: rate ?? 0 });
    expect(r.monthlyRental).toBe(c(1_530.29));
    expect(r.runningPackaged).toBe(m(415.42));
    expect(r.otherPackaged).toBe(c(195.12 / 3 + 28.44 * 12));
    expect(Math.abs(r.years[0].packageCost / 12 - c(1_998.57))).toBeLessThanOrEqual(1);
    // Exempt EV: all of it before tax.
    expect(r.years[0].postTax).toBe(0);
  });

  it("charges less a month in advance at the same rate", () => {
    const arrears = calculateNovatedLease(quote).monthlyRental;
    const advance = calculateNovatedLease({ ...quote, inAdvance: true }).monthlyRental;
    expect(advance).toBe(Math.round(arrears / (1 + 0.0926 / 12)));
    const r = calculateNovatedLease(quote);
    expect(impliedLeaseRate(r.financed, r.residual, 36, advance, true)).toBeCloseTo(0.0926, 4);
  });
});

describe("validateLease", () => {
  it("accepts the example and rejects bad input", () => {
    expect(validateLease(base)).toEqual([]);
    expect(validateLease({ ...base, price: c(0) })).toHaveLength(1);
    expect(validateLease({ ...base, termYears: 6 })).toHaveLength(1);
    expect(validateLease({ ...base, start: "2026-02-30" })).toHaveLength(1);
    expect(validateLease({ ...base, rate: -0.01 })).toHaveLength(1);
    expect(validateLease({ ...base, running: { ...base.running, energy: c(-1) } })).toHaveLength(1);
    expect(() => calculateNovatedLease({ ...base, price: c(-5) })).toThrow(RangeError);
  });
});
