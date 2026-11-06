import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  bracketTax,
  calculatePay,
  keepFromRaise,
  lowIncomeOffset,
  medicareLevy,
  type PayInput,
  splitPackage,
  studyLoanRepayment,
  surchargeRate,
  validatePay,
} from "./pay";
import { TAX_RULES, taxRulesFor, taxRulesForYear } from "./rules";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const r2627 = taxRulesForYear("2026-27").rules;
const r2526 = taxRulesForYear("2025-26").rules;
const pay = (over: Partial<PayInput> = {}) =>
  calculatePay({ year: "2026-27", salary: c(100_000), ...over });

describe("rules", () => {
  it("picks the year and carries the last one forward", () => {
    expect(taxRulesFor("2026-11-04").rules.year).toBe("2026-27");
    expect(taxRulesFor("2026-06-30").rules.year).toBe("2025-26");
    const later = taxRulesForYear("2031-32");
    expect(later.carriedForward).toBe(true);
    expect(later.rules.year).toBe(TAX_RULES[TAX_RULES.length - 1].year);
    expect(taxRulesForYear("2019-20").rules.year).toBe("2025-26");
  });

  it("has the legislated rate cuts", () => {
    expect(r2526.resident[0].rate).toBe(0.16);
    expect(r2627.resident[0].rate).toBe(0.15);
    expect(taxRulesForYear("2027-28").rules.resident[0].rate).toBe(0.14);
  });
});

describe("income tax", () => {
  it("matches the ATO brackets", () => {
    expect(bracketTax(c(18_200), r2627.resident)).toBe(0);
    expect(bracketTax(c(45_000), r2627.resident)).toBe(c(4_020));
    expect(bracketTax(c(100_000), r2627.resident)).toBe(c(20_520));
    expect(bracketTax(c(100_000), r2526.resident)).toBe(c(20_788));
    // 4,020 + 27,000 + 20,350 + 4,500
    expect(bracketTax(c(200_000), r2627.resident)).toBe(c(55_870));
    expect(bracketTax(c(100_000), r2627.foreign)).toBe(c(30_000));
  });

  it("tapers the low income tax offset", () => {
    expect(lowIncomeOffset(c(30_000), r2627.lito)).toBe(c(700));
    expect(lowIncomeOffset(c(40_000), r2627.lito)).toBe(c(575));
    expect(lowIncomeOffset(c(45_000), r2627.lito)).toBe(c(325));
    expect(lowIncomeOffset(c(55_000), r2627.lito)).toBe(c(175));
    expect(lowIncomeOffset(c(66_667), r2627.lito)).toBe(0);
    expect(lowIncomeOffset(c(90_000), r2627.lito)).toBe(0);
  });
});

describe("Medicare levy", () => {
  it("is nil, then shades in, then 2%", () => {
    expect(medicareLevy(c(28_011), r2627.medicare)).toBe(0);
    expect(medicareLevy(c(30_000), r2627.medicare)).toBe(c(198.9));
    expect(medicareLevy(c(40_000), r2627.medicare)).toBe(c(800));
  });

  it("uses family income for a family", () => {
    const fam = { partnerIncome: c(10_000), children: 1 };
    // Family income 45,000 is under 47,238 + 4,338.
    expect(medicareLevy(c(35_000), r2627.medicare, fam)).toBe(0);
    // Plenty of family income: full 2%.
    expect(medicareLevy(c(80_000), r2627.medicare, { partnerIncome: c(80_000), children: 0 })).toBe(
      c(1_600),
    );
  });

  it("surcharge tiers on income for surcharge purposes", () => {
    expect(surchargeRate(c(105_000), r2627.mls)).toBe(0);
    expect(surchargeRate(c(110_000), r2627.mls)).toBe(0.01);
    expect(surchargeRate(c(130_000), r2627.mls)).toBe(0.0125);
    expect(surchargeRate(c(200_000), r2627.mls)).toBe(0.015);
    const fam = { partnerIncome: c(100_000), children: 3 };
    // 213,000 is under 210,000 + 2 × 1,500.
    expect(surchargeRate(c(113_000), r2627.mls, fam)).toBe(0);
    expect(surchargeRate(c(114_000), r2627.mls, fam)).toBe(0.01);
  });
});

describe("study loans", () => {
  it("repays marginally, then 10% of everything", () => {
    expect(studyLoanRepayment(c(69_528), r2627.help)).toBe(0);
    expect(studyLoanRepayment(c(100_000), r2627.help)).toBe(c(4_570.8));
    expect(studyLoanRepayment(c(150_000), r2627.help)).toBe(c(9_028 + 20_283 * 0.17));
    expect(studyLoanRepayment(c(200_000), r2627.help)).toBe(c(20_000));
    expect(studyLoanRepayment(c(100_000), r2526.help)).toBe(c(4_950));
  });
});

describe("super", () => {
  it("splits a package that includes super", () => {
    const max = c(270_830);
    expect(splitPackage(c(112_000), true, 0.12, max)).toEqual({
      salary: c(100_000),
      employerSuper: c(12_000),
    });
    expect(splitPackage(c(100_000), false, 0.12, max)).toEqual({
      salary: c(100_000),
      employerSuper: c(12_000),
    });
    // Above the maximum contribution base, super is capped.
    const big = splitPackage(c(400_000), true, 0.12, max);
    expect(big.employerSuper).toBe(c(32_499.6));
    expect(big.salary + big.employerSuper).toBe(c(400_000));
  });
});

describe("calculatePay", () => {
  it("takes home $77,480 on $100,000 in 2026-27", () => {
    const r = pay();
    expect(r.incomeTax).toBe(c(20_520));
    expect(r.medicare).toBe(c(2_000));
    expect(r.net).toBe(c(77_480));
    expect(r.employerSuper).toBe(c(12_000));
    expect(r.marginalRate).toBeCloseTo(0.32, 6);
    expect(r.averageRate).toBeCloseTo(0.2252, 4);
    expect(r.periods.fortnightly.net).toBe(c(2_980));
    expect(r.periods.weekly.gross).toBe(c(1_923.08));
  });

  it("applies the offset and low-income levy", () => {
    const r = pay({ salary: c(40_000) });
    expect(r.taxBeforeOffsets).toBe(c(3_270));
    expect(r.lito).toBe(c(575));
    expect(r.incomeTax).toBe(c(2_695));
    expect(r.medicare).toBe(c(800));
    expect(r.net).toBe(c(36_505));
  });

  it("owes nothing under the tax-free threshold and offset", () => {
    const r = pay({ salary: c(20_000) });
    expect(r.totalTax).toBe(0);
    expect(r.lito).toBe(c(270)); // only what was needed
  });

  it("salary sacrifice cuts tax but counts for loans and surcharge", () => {
    const r = pay({
      salary: c(110_000),
      salarySacrifice: c(10_000),
      studyLoan: true,
      hospitalCover: false,
    });
    expect(r.taxableIncome).toBe(c(100_000));
    expect(r.incomeTax).toBe(c(20_520));
    expect(r.studyLoan).toBe(c((110_000 - 69_528) * 0.15));
    expect(r.surcharge).toBe(c(1_000)); // 1% of taxable income, tier from 110,000
    expect(r.employerSuper).toBe(c(13_200 + 10_000));
  });

  it("foreign residents pay no Medicare levy and get no offset", () => {
    const r = pay({ residency: "foreign", salary: c(50_000) });
    expect(r.incomeTax).toBe(c(15_000));
    expect(r.medicare).toBe(0);
    expect(r.lito).toBe(0);
  });

  it("warns about the cap and Division 293", () => {
    const r = pay({ salary: c(260_000), salarySacrifice: c(10_000) });
    const kinds = r.warnings.map((w) => w.kind);
    expect(kinds).toContain("concessional-cap");
    expect(kinds).toContain("division-293");
    expect(pay().warnings).toEqual([]);
  });

  it("uses an employer rate if given", () => {
    expect(pay({ superRate: 0.15 }).employerSuper).toBe(c(15_000));
  });

  it("works out how much of a raise you keep", () => {
    expect(keepFromRaise({ year: "2026-27", salary: c(100_000) }, c(10_000))).toBe(c(6_800));
  });

  it("rejects bad input", () => {
    expect(validatePay({ year: "2026-27", salary: -1 as Cents })).not.toEqual([]);
    expect(() => calculatePay({ year: "2026-27", salary: Number.NaN as Cents })).toThrow();
  });

  it("pays super on bonuses but not overtime", () => {
    const r = pay({ overtime: c(10_000), bonus: c(5_000), allowances: c(1_000) });
    expect(r.gross).toBe(c(116_000));
    expect(r.employerSuper).toBe(c(12_600)); // 12% of 105,000
    expect(r.taxableIncome).toBe(c(116_000));
  });

  it("packaging cuts taxable income and take-home; fringe benefits count for loans", () => {
    const r = pay({ otherPackaging: c(10_000), fringeBenefits: c(15_000), studyLoan: true });
    expect(r.taxableIncome).toBe(c(90_000));
    expect(r.incomeTax).toBe(c(17_520));
    expect(r.repaymentIncome).toBe(c(105_000));
    expect(r.studyLoan).toBe(c((105_000 - 69_528) * 0.15));
    expect(r.net).toBe(c(90_000 - 17_520 - 1_800 - (105_000 - 69_528) * 0.15));
  });

  it("after-tax deductions come off take-home but not tax", () => {
    const base = pay();
    const r = pay({ afterTax: c(2_600) });
    expect(r.totalTax).toBe(base.totalTax);
    expect(r.afterTax).toBe(c(2_600));
    expect(r.net).toBe(base.net - c(2_600));
    expect(r.periods.fortnightly.afterTax).toBe(c(100));
    expect(r.periods.fortnightly.net).toBe(base.periods.fortnightly.net - c(100));
    const slip = r.withholding?.fortnightly;
    expect(slip?.afterTax).toBe(c(100));
    expect(slip?.net).toBe((base.withholding?.fortnightly.net ?? 0) - c(100));
    // Never more than what's left after tax.
    expect(pay({ salary: c(1_000), afterTax: c(5_000) }).net).toBe(0);
  });

  it("deductions lower tax but not take-home cash", () => {
    const r = pay({ deductions: c(5_000) });
    expect(r.taxableIncome).toBe(c(95_000));
    expect(r.totalTax).toBe(c(20_520 - 1_500 + 1_900));
    expect(r.net).toBe(c(100_000) - r.totalTax);
  });

  it("working holiday makers pay 15% from the first dollar, no levy", () => {
    const r = pay({ residency: "whm", salary: c(40_000) });
    expect(r.incomeTax).toBe(c(6_000));
    expect(r.medicare).toBe(0);
    expect(r.lito).toBe(0);
  });

  it("Medicare exemptions", () => {
    expect(pay({ medicareExemption: "half" }).medicare).toBe(c(1_000));
    const full = pay({ medicareExemption: "full", hospitalCover: false, salary: c(150_000) });
    expect(full.medicare).toBe(0);
    expect(full.surcharge).toBe(0);
  });

  it("warns when packaging or deductions exceed pay", () => {
    const r = pay({ salary: c(10_000), salarySacrifice: c(8_000), otherPackaging: c(5_000) });
    expect(r.warnings.map((w) => w.kind)).toContain("packaging-too-big");
    expect(r.otherPackaging).toBe(c(2_000));
  });
});
