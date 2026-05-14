import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { projectSuper } from "./project";

const base = {
  voluntaryContribution: cents(0),
  voluntaryFrequency: "monthly" as const,
  voluntaryType: "concessional" as const,
};

describe("projectSuper", () => {
  it("equal ages → no growth, returns initial balance in years[0]", () => {
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(10_000_000),
      employerContributionPct: 0.12,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0.005,
      currentAge: 60,
      retirementAge: 60,
    });
    expect(result.retirementNominal).toBe(10_000_000);
    expect(result.retirementReal).toBe(10_000_000);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].age).toBe(60);
  });

  it("zero return + zero fees — balance grows by employer contributions only", () => {
    // $100,000 balance, $100,000 salary, 12% SG, 0% return, 0% fees, 0% inflation
    // 12 months: each month adds salary × 0.12 / 12 = 100,000 × 0.01 = 1,000/mo = 100,000 cents
    // After 12 months: 10,000,000 + 12 × 100,000 = 11,200,000
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(10_000_000),
      employerContributionPct: 0.12,
      expectedReturnPct: 0,
      inflationPct: 0,
      feesPct: 0,
      currentAge: 65,
      retirementAge: 66,
    });
    expect(result.retirementNominal).toBe(11_200_000);
    expect(result.retirementReal).toBe(11_200_000);
    expect(result.years).toHaveLength(2); // age 65 (start) + age 66 (end)
  });

  it("pure return, no contributions (12%/yr = 1%/mo)", () => {
    // balance = 10,000,000 × (1.01)^12 = 10,000,000 × 1.12682503... = 11,268,250
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.12,
      inflationPct: 0,
      feesPct: 0,
      currentAge: 64,
      retirementAge: 65,
    });
    expect(result.retirementNominal).toBe(11_268_250);
    expect(result.retirementReal).toBe(11_268_250);
  });

  it("fees reduce balance compared to zero-fee scenario", () => {
    const withFees = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.07,
      inflationPct: 0,
      feesPct: 0.01,
      currentAge: 64,
      retirementAge: 65,
    });
    const noFees = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.07,
      inflationPct: 0,
      feesPct: 0,
      currentAge: 64,
      retirementAge: 65,
    });
    expect(withFees.retirementNominal).toBeLessThan(noFees.retirementNominal);
  });

  it("real value is less than nominal when inflation > 0", () => {
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0,
      currentAge: 55,
      retirementAge: 65,
    });
    expect(result.retirementReal).toBeLessThan(result.retirementNominal);
  });

  it("return ≈ inflation → real balance ≈ initial balance (within rounding)", () => {
    // With 2.5% return, 0% fees, 2.5% inflation over 1 year, real ≈ initial
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.025,
      inflationPct: 0.025,
      feesPct: 0,
      currentAge: 64,
      retirementAge: 65,
    });
    expect(Math.abs(result.retirementReal - 10_000_000)).toBeLessThan(5);
  });

  it("concessional cap breach flagged when employer + salary sacrifice exceeds $30k/yr", () => {
    // Salary $200,000 × 12% SG = $24,000/yr + $10,000 voluntary concessional = $34,000 > $30,000 cap
    const result = projectSuper({
      ...base,
      currentBalance: cents(0),
      annualSalary: cents(20_000_000), // $200,000
      employerContributionPct: 0.12,
      voluntaryContribution: cents(1_000_000), // $10,000/yr
      voluntaryFrequency: "yearly",
      voluntaryType: "concessional",
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0.005,
      currentAge: 55,
      retirementAge: 60,
    });
    expect(result.concessionalCapBreached).toBe(true);
  });

  it("non-concessional cap breach flagged when after-tax voluntary exceeds $120k/yr", () => {
    const result = projectSuper({
      ...base,
      currentBalance: cents(0),
      annualSalary: cents(10_000_000),
      employerContributionPct: 0.12,
      voluntaryContribution: cents(1_500_000), // $15,000/mo = $180,000/yr > $120k cap
      voluntaryFrequency: "monthly",
      voluntaryType: "non-concessional",
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0.005,
      currentAge: 55,
      retirementAge: 60,
    });
    expect(result.nonConcessionalCapBreached).toBe(true);
    expect(result.concessionalCapBreached).toBe(false); // voluntary is non-concessional
  });

  it("fortnightly voluntary contribution normalises correctly to monthly", () => {
    // $1,000/fn → monthly: 1,000 × 30/14 ≈ 2,142.86 → 2,143 monthly
    // annual ≈ 2,143 × 12 = 25,716
    const result = projectSuper({
      ...base,
      currentBalance: cents(0),
      annualSalary: cents(0),
      employerContributionPct: 0,
      voluntaryContribution: cents(100_000), // $1,000
      voluntaryFrequency: "fortnightly",
      voluntaryType: "concessional",
      expectedReturnPct: 0,
      inflationPct: 0,
      feesPct: 0,
      currentAge: 64,
      retirementAge: 65,
    });
    // 12 months × (100,000 × 30/14) = 12 × 214,286 = 2,571,432 cents
    const expected = Math.round(12 * ((100_000 * 30) / 14));
    expect(result.retirementNominal).toBe(expected);
  });

  it("years array has correct length and monotonically increasing balances with positive return", () => {
    const result = projectSuper({
      ...base,
      currentBalance: cents(5_000_000),
      annualSalary: cents(10_000_000),
      employerContributionPct: 0.12,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0.005,
      currentAge: 30,
      retirementAge: 40,
    });
    // 11 points: age 30 (start) + ages 31–40
    expect(result.years).toHaveLength(11);
    for (let i = 1; i < result.years.length; i++) {
      expect(result.years[i].nominal).toBeGreaterThan(result.years[i - 1].nominal);
    }
  });
});
