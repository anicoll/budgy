import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  extraContributionEffect,
  projectSuper,
  retirementIncome,
  type SuperAccount,
  type SuperInput,
  type SuperPerson,
  validateSuper,
} from "./project";
import { financialYear, rulesFor } from "./rules";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

const account = (over: Partial<SuperAccount> = {}): SuperAccount => ({
  id: "a1",
  name: "Fund",
  balance: c(100_000),
  returnPct: 0,
  adminFeeFixed: 0 as Cents,
  adminFeePct: 0,
  salarySacrifice: 0 as Cents,
  afterTax: 0 as Cents,
  receivesEmployer: true,
  ...over,
});

const person = (over: Partial<SuperPerson> = {}): SuperPerson => ({
  id: "p1",
  name: "Alex",
  age: 66,
  retireAge: 67,
  salary: c(100_000),
  accounts: [account()],
  ...over,
});

// 1 July 2026: one full 2026-27 financial year to retirement.
const input = (over: Partial<SuperInput> = {}): SuperInput => ({
  people: [person()],
  startDate: "2026-07-01",
  wageGrowth: 0,
  inflation: 0,
  incomeUntilAge: 90,
  ...over,
});

describe("rules", () => {
  it("picks the financial year and carries the last one forward", () => {
    expect(financialYear("2026-06-30")).toBe("2025-26");
    expect(financialYear("2026-07-01")).toBe("2026-27");
    expect(rulesFor("2025-01-15").rules.sgRate).toBe(0.115);
    expect(rulesFor("2026-11-04").rules.concessionalCap).toBe(c(32_500));
    const later = rulesFor("2031-01-01");
    expect(later.carriedForward).toBe(true);
    expect(later.rules.year).toBe("2026-27");
  });
});

describe("projectSuper", () => {
  it("adds 12% SG less 15% contributions tax: $100k salary adds $10,200 in a year", () => {
    const r = projectSuper(input());
    const p = r.people[0];
    expect(p.employerTotal).toBe(c(12_000));
    expect(p.contributionsTax).toBe(c(1_800));
    expect(p.atRetirement).toBe(c(110_200));
    expect(p.years).toHaveLength(2);
    expect(p.retireDate).toBe("2027-07-01");
    expect(r.rulesCarriedForward).toBe(false);
    expect(r.rulesYears).toEqual(["2026-27"]);
  });

  it("stops SG at the maximum contribution base", () => {
    const p = projectSuper(input({ people: [person({ salary: c(400_000) })] })).people[0];
    // $270,830 × 12% = $32,499.60, just inside the $32,500 cap.
    expect(p.employerTotal).toBe(c(32_499.6));
    expect(p.warnings.join(" ")).not.toMatch(/cap/);
    expect(p.warnings.join(" ")).toMatch(/Division 293/);
  });

  it("warns when salary sacrifice pushes past the concessional cap", () => {
    const p = projectSuper(
      input({ people: [person({ accounts: [account({ salarySacrifice: c(25_000) })] })] }),
    ).people[0];
    expect(p.warnings.join(" ")).toMatch(/cap \(\$32,500 in 2026-27\)/);
  });

  it("indexes caps and the contribution base by wage growth after the last known year", () => {
    const p = projectSuper(
      input({
        wageGrowth: 0.1,
        people: [person({ age: 65, salary: c(500_000) })],
      }),
    ).people[0];
    // 2026-27: $270,830 base. 2027-28: carried forward and grown 10%.
    expect(p.employerTotal).toBe(c(270_830 * 0.12 + 270_830 * 1.1 * 0.12));
    expect(p.warnings.join(" ")).not.toMatch(/cap/);
  });

  it("only warns about Division 293 for this year's income", () => {
    const p = projectSuper(
      input({ wageGrowth: 0.1, people: [person({ age: 30, salary: c(150_000) })] }),
    ).people[0];
    expect(p.warnings.join(" ")).not.toMatch(/Division 293/);
  });

  it("uses a higher employer rate when given", () => {
    const p = projectSuper(input({ people: [person({ employerRate: 0.15 })] })).people[0];
    expect(p.employerTotal).toBe(c(15_000));
  });

  it("puts SG only in the account that receives it and after-tax money untaxed", () => {
    const p = projectSuper(
      input({
        people: [
          person({
            accounts: [
              account({ id: "a1", receivesEmployer: false, afterTax: c(1_200) }),
              account({ id: "a2", balance: c(5_000), receivesEmployer: true }),
            ],
          }),
        ],
      }),
    ).people[0];
    const end = p.years.at(-1);
    expect(end?.balances).toEqual([c(101_200), c(15_200)]);
    expect(p.personalTotal).toBe(c(1_200));
  });

  it("charges fees and grows at the effective monthly rate", () => {
    const p = projectSuper(
      input({
        people: [
          person({
            salary: 0 as Cents,
            accounts: [account({ returnPct: 0.07, adminFeeFixed: c(120) })],
          }),
        ],
      }),
    ).people[0];
    // 7% a year compounds to exactly 7% over 12 months, less about $120 of fees.
    expect(p.atRetirement).toBeGreaterThan(c(106_870));
    expect(p.atRetirement).toBeLessThan(c(106_890));
    expect(p.fees).toBe(c(120));
  });

  it("shows today's dollars with inflation", () => {
    const p = projectSuper(input({ inflation: 0.03, people: [person({ salary: 0 as Cents })] }))
      .people[0];
    expect(p.atRetirement).toBe(c(100_000));
    expect(p.atRetirementReal).toBe(Math.round(10_000_000 / 1.03));
  });

  it("someone already retired just gets an income", () => {
    const p = projectSuper(input({ people: [person({ age: 70, retireAge: 67 })] })).people[0];
    expect(p.atRetirement).toBe(c(100_000));
    // $100k over 20 years at 0% real return.
    expect(p.incomePerYear).toBe(c(5_000));
  });

  it("adds up a household", () => {
    const r = projectSuper(
      input({ people: [person(), person({ id: "p2", name: "Sam", salary: 0 as Cents })] }),
    );
    expect(r.householdAtRetirementReal).toBe(c(110_200 + 100_000));
    expect(r.householdIncomePerYear).toBe(r.people[0].incomePerYear + r.people[1].incomePerYear);
  });

  it("an extra $50 a week before tax adds $2,210 after contributions tax in a year", () => {
    const e = extraContributionEffect(input(), "p1", c(2_600));
    expect(e.atRetirementReal).toBe(c(2_210));
    expect(e.incomePerYear).toBeGreaterThan(0);
  });
});

describe("retirementIncome", () => {
  it("spreads a balance evenly with no real return", () => {
    expect(retirementIncome(c(900_000), 0.03, 0.03, 25)).toBe(c(36_000));
  });
  it("pays more with a positive real return", () => {
    expect(retirementIncome(c(900_000), 0.06, 0.025, 25)).toBeGreaterThan(c(50_000));
    expect(retirementIncome(0, 0.06, 0.025, 25)).toBe(0);
  });
});

describe("validateSuper", () => {
  it("rejects bad input", () => {
    expect(validateSuper(input())).toEqual([]);
    expect(validateSuper(input({ people: [] })).join()).toMatch(/at least one/);
    expect(validateSuper(input({ people: [person({ accounts: [] })] })).join()).toMatch(
      /add a super account/,
    );
    expect(validateSuper(input({ people: [person({ retireAge: 95 })] })).join()).toMatch(
      /before the income-until age/,
    );
    expect(() => projectSuper(input({ startDate: "2026-13-01" }))).toThrow(/start date/);
  });
});
