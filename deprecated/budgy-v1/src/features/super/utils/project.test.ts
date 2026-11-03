import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import { computeDrawdown, computeMaxSustainableWithdrawal, projectSuper } from "./project";

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

  it("non-concessional cap breach flagged when after-tax voluntary exceeds $120k/yr (no concessional breach)", () => {
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

  // ── Real / nominal precision ──────────────────────────────────────────────

  it("real value matches exact inflation-factor formula (zero return isolates discounting)", () => {
    // With 0% return and no contributions, the nominal balance stays flat.
    // real = Math.round(nominal / (1 + inflationPct/12)^months)
    const months = 120; // 10 years
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0,
      inflationPct: 0.025,
      feesPct: 0,
      currentAge: 55,
      retirementAge: 65,
    });
    expect(result.retirementNominal).toBe(10_000_000); // unchanged (no return, no contributions)
    const inflationFactor = (1 + 0.025 / 12) ** months;
    const expectedReal = Math.round(10_000_000 / inflationFactor);
    expect(result.retirementReal).toBe(expectedReal);
    // Sanity: 2.5% inflation over 10 years ≈ 28% cumulative — real should be ~78% of nominal
    expect(result.retirementReal).toBeGreaterThan(7_500_000);
    expect(result.retirementReal).toBeLessThan(8_500_000);
  });

  it("intermediate years real values are each discounted by their own inflation factor", () => {
    // Pure growth, no contributions — lets us check per-year real discounting
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0,
      currentAge: 60,
      retirementAge: 65,
    });
    for (let i = 1; i < result.years.length; i++) {
      const months = i * 12;
      const inflationFactor = (1 + 0.025 / 12) ** months;
      const expectedReal = Math.round(result.years[i].nominal / inflationFactor);
      // Allow ±1 cent: `years[i].nominal` is already rounded, so dividing by inflationFactor
      // and re-rounding can differ by 1 cent from computing real on the raw float balance.
      expect(Math.abs(result.years[i].real - expectedReal)).toBeLessThanOrEqual(1);
    }
  });

  it("real / nominal ratio at retirement ≈ cumulative inflation factor (30-year horizon)", () => {
    // No contributions — isolates the return vs inflation relationship.
    // Over 30 years, nominal grows at 7% net; real = nominal / inflation_factor.
    // The ratio nominal/real should be ≈ (1 + 0.025/12)^360.
    const result = projectSuper({
      ...base,
      currentBalance: cents(10_000_000),
      annualSalary: cents(0),
      employerContributionPct: 0,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0,
      currentAge: 35,
      retirementAge: 65,
    });
    const inflationFactor = (1 + 0.025 / 12) ** 360;
    const ratio = result.retirementNominal / result.retirementReal;
    // Ratio should match inflation factor within 0.5% (rounding only)
    expect(ratio).toBeCloseTo(inflationFactor, 1);
    // 7% net over 30 years — nominal should be materially more than real
    expect(result.retirementNominal).toBeGreaterThan(result.retirementReal * 2);
  });

  it("realistic scenario — regression pin for default fund parameters", () => {
    // $85k balance, $120k salary, 12% SG, 7% return, 2.5% inflation, 0.5% fees, 32 years
    // This pins the exact output so any formula change is immediately detected.
    const result = projectSuper({
      ...base,
      currentBalance: cents(8_500_000), // $85,000
      annualSalary: cents(12_000_000), // $120,000
      employerContributionPct: 0.12,
      expectedReturnPct: 0.07,
      inflationPct: 0.025,
      feesPct: 0.005,
      currentAge: 35,
      retirementAge: 67,
    });
    // Monthly employer SG = $120,000 × 12% / 12 = $1,200/mo
    // Net monthly rate = (7% - 0.5%) / 12 = 0.5417%/mo
    // Both nominal and real should be well above current balance after 32 years
    expect(result.retirementNominal).toBeGreaterThan(result.retirementReal);
    expect(result.retirementReal).toBeGreaterThan(result.years[0].nominal); // real > initial
    // Pinned values — update intentionally if formula changes
    expect(result.retirementNominal).toMatchInlineSnapshot(`221840503`);
    expect(result.retirementReal).toMatchInlineSnapshot(`99762349`);
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

// ── computeMaxSustainableWithdrawal ──────────────────────────────────────────

describe("computeMaxSustainableWithdrawal", () => {
  const drawdownBase = {
    expectedReturnPct: 0.07,
    inflationPct: 0.025,
    retirementAge: 67,
    yearsToRetirement: 32,
  };

  it("returns 0 for zero balance", () => {
    expect(computeMaxSustainableWithdrawal({ ...drawdownBase, retirementNominal: cents(0) })).toBe(
      0,
    );
  });

  it("result plugged back into computeDrawdown produces depletionAge === null", () => {
    // A comfortable $2M balance should yield a sustainable income — verify the
    // binary-search result is self-consistent with the drawdown simulation.
    const retirementNominal = cents(200_000_000); // $2,000,000
    const monthly = computeMaxSustainableWithdrawal({ ...drawdownBase, retirementNominal });
    expect(monthly).toBeGreaterThan(0);

    const { depletionAge } = computeDrawdown({
      retirementNominal,
      expectedReturnPct: drawdownBase.expectedReturnPct,
      inflationPct: drawdownBase.inflationPct,
      retirementAge: drawdownBase.retirementAge,
      monthlyDrawdownTarget: monthly,
      yearsToRetirement: drawdownBase.yearsToRetirement,
    });
    expect(depletionAge).toBeNull();
  });

  it("result + $1 more tips into depletion", () => {
    // The result should be the highest sustainable value — adding 1 cent should deplete.
    const retirementNominal = cents(200_000_000);
    const monthly = computeMaxSustainableWithdrawal({ ...drawdownBase, retirementNominal });

    const { depletionAge } = computeDrawdown({
      retirementNominal,
      expectedReturnPct: drawdownBase.expectedReturnPct,
      inflationPct: drawdownBase.inflationPct,
      retirementAge: drawdownBase.retirementAge,
      monthlyDrawdownTarget: (monthly + 100) as typeof monthly, // $1 more
      yearsToRetirement: drawdownBase.yearsToRetirement,
    });
    expect(depletionAge).not.toBeNull();
  });

  it("higher return rate → higher sustainable withdrawal", () => {
    const retirementNominal = cents(200_000_000);
    const low = computeMaxSustainableWithdrawal({
      ...drawdownBase,
      retirementNominal,
      expectedReturnPct: 0.04,
    });
    const high = computeMaxSustainableWithdrawal({
      ...drawdownBase,
      retirementNominal,
      expectedReturnPct: 0.09,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("larger balance → proportionally larger sustainable withdrawal", () => {
    const small = computeMaxSustainableWithdrawal({
      ...drawdownBase,
      retirementNominal: cents(100_000_000),
    });
    const large = computeMaxSustainableWithdrawal({
      ...drawdownBase,
      retirementNominal: cents(200_000_000),
    });
    // Doubling the balance should roughly double the sustainable income
    expect(large).toBeGreaterThan(small * 1.9);
    expect(large).toBeLessThan(small * 2.1);
  });
});
