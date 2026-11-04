import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calculatePay } from "../tax/pay";
import {
  compareSuperOrMortgage,
  releaseAge,
  type SomPerson,
  type SuperOrMortgageInput,
  sacrificeFor,
  validateSuperOrMortgage,
} from "./vsMortgage";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

const person = (over: Partial<SomPerson> = {}): SomPerson => ({
  id: "a",
  name: "Alex",
  age: 40,
  retireAge: 67,
  pay: { salary: c(120_000) },
  ...over,
});

const input = (over: Partial<SuperOrMortgageInput> = {}): SuperOrMortgageInput => ({
  startDate: "2026-11-04",
  people: [person()],
  loan: { balance: c(600_000), annualRate: 0.06, termMonths: 300, frequency: "monthly" },
  spareMonthly: c(500),
  superReturn: 0.07,
  inflation: 0.025,
  ...over,
});

describe("sacrificeFor", () => {
  it("finds the sacrifice that costs exactly the take-home amount", () => {
    const pay = { year: "2026-27", salary: c(120_000) };
    const s = sacrificeFor(pay, c(6_000));
    const before = calculatePay(pay).net;
    const after = calculatePay({ ...pay, salarySacrifice: s.sacrifice }).net;
    expect(Math.abs(before - after - c(6_000))).toBeLessThanOrEqual(1);
    // 30% + 2% Medicare at $120k: about $8,824 sacrificed for $6,000.
    expect(s.sacrifice).toBeGreaterThan(c(8_800));
    expect(s.sacrifice).toBeLessThan(c(8_850));
    expect(s.afterTax).toBe(0);
    expect(s.contributionsTax).toBe(Math.round(s.sacrifice * 0.15));
    expect(s.intoSuper).toBe(s.sacrifice - s.contributionsTax);
    expect(s.taxSaved).toBe(s.sacrifice - c(6_000));
  });

  it("stops at the concessional cap and puts the rest in after tax", () => {
    // 12% of $200k is $24,000 employer super; the 2026-27 cap is $32,500.
    const s = sacrificeFor({ year: "2026-27", salary: c(200_000) }, c(10_000));
    expect(s.capHeadroom).toBe(c(8_500));
    expect(s.sacrifice).toBe(c(8_500));
    expect(s.afterTax).toBeGreaterThan(0);
    expect(s.intoSuper).toBe(s.sacrifice - s.contributionsTax + s.afterTax);
  });

  it("counts existing sacrifice against the cap", () => {
    const s = sacrificeFor(
      { year: "2026-27", salary: c(100_000), salarySacrifice: c(20_000) },
      c(5_000),
    );
    // $12,000 employer + $20,000 already = $32,000 of $32,500.
    expect(s.capHeadroom).toBe(c(500));
    expect(s.sacrifice).toBe(c(500));
  });

  it("refunds contributions tax through the low income super tax offset, up to $500", () => {
    // $20k: employer super of $2,400 already uses $360 of the $500 offset.
    const s = sacrificeFor({ year: "2026-27", salary: c(20_000) }, c(1_000));
    expect(s.contributionsTax).toBe(Math.round(s.sacrifice * 0.15 - c(140)));
    // Under the tax-free threshold there's no income tax to save.
    expect(s.taxSaved).toBe(0);
  });

  it("adds Division 293 tax when all concessional contributions are over $250k", () => {
    // $260k + $31,200 employer super: over $250k by more than the contributions.
    const s = sacrificeFor({ year: "2026-27", salary: c(260_000) }, c(500));
    expect(s.sacrifice).toBeGreaterThan(0);
    expect(Math.abs(s.contributionsTax - s.sacrifice * 0.3)).toBeLessThanOrEqual(1);
  });

  it("adds no Division 293 tax when the sacrifice only moves income under the line", () => {
    // $240k + $28,800: over by $18,800, less than the contributions, and a
    // sacrifice moves taxable income into contributions without changing that.
    const s = sacrificeFor({ year: "2026-27", salary: c(240_000) }, c(2_000));
    expect(s.contributionsTax).toBe(Math.round(s.sacrifice * 0.15));
  });

  it("does nothing with nothing to spare", () => {
    const s = sacrificeFor({ year: "2026-27", salary: c(90_000) }, 0 as Cents);
    expect(s.sacrifice).toBe(0);
    expect(s.intoSuper).toBe(0);
  });
});

describe("compareSuperOrMortgage", () => {
  it("rejects bad input", () => {
    expect(validateSuperOrMortgage(input({ people: [] }))).toContain("add at least one person");
    expect(() => compareSuperOrMortgage(input({ spareMonthly: -1 as Cents }))).toThrow(RangeError);
  });

  it("with no spare cash, every option is worth nothing extra", () => {
    const r = compareSuperOrMortgage(input({ spareMonthly: 0 as Cents }));
    for (const o of r.options) expect(o.gain).toBe(0);
    expect(r.breakEvenReturn).toBeNull();
    expect(r.interestSaved).toBe(0);
  });

  it("pays the loan off sooner and saves interest on the mortgage option", () => {
    const r = compareSuperOrMortgage(input());
    expect(r.interestSaved).toBeGreaterThan(c(100_000));
    expect(r.monthsSooner).toBeGreaterThan(48);
    expect(r.mortgage.loanPaidOff < r.baseLoan.payoffDate).toBe(true);
    // One row a year, plus today.
    expect(r.mortgage.rows).toHaveLength(r.years + 1);
    expect(r.mortgage.rows[0].gain).toBe(0);
  });

  it("favours super when its return beats the loan rate", () => {
    const r = compareSuperOrMortgage(input({ superReturn: 0.07 }));
    expect(r.best.kind).toBe("super");
  });

  it("favours the mortgage when the rate is high and super returns are low", () => {
    const r = compareSuperOrMortgage(
      input({
        superReturn: 0.03,
        loan: { balance: c(600_000), annualRate: 0.09, termMonths: 300, frequency: "monthly" },
      }),
    );
    expect(r.best.kind).toBe("mortgage");
  });

  it("finds a break-even super return below the loan rate, thanks to the tax saving", () => {
    const r = compareSuperOrMortgage(input());
    expect(r.breakEvenReturn).not.toBeNull();
    const be = r.breakEvenReturn as number;
    expect(be).toBeGreaterThan(0.02);
    expect(be).toBeLessThan(0.06);
    const at = compareSuperOrMortgage(input({ superReturn: be }));
    const bestSuper = Math.max(...at.options.filter((o) => o.kind === "super").map((o) => o.gain));
    expect(Math.abs(bestSuper - at.mortgage.gain)).toBeLessThan(c(500));
  });

  it("offers each person's super, and the mortgage sends its later money to the best one", () => {
    const r = compareSuperOrMortgage(
      input({
        people: [
          person({ id: "a", name: "Alex", pay: { salary: c(190_000) } }),
          person({ id: "b", name: "Sam", pay: { salary: c(30_000) } }),
        ],
      }),
    );
    expect(r.options.map((o) => o.label).sort()).toEqual([
      "Extra mortgage repayments",
      "Into Alex's super",
      "Into Sam's super",
    ]);
    // Sam gets the offset back, so their 15% is refunded up to $500 a year.
    const sam = r.options.find((o) => o.label === "Into Sam's super");
    const alex = r.options.find((o) => o.label === "Into Alex's super");
    expect(sam?.sacrifice?.contributionsTax).toBeLessThan(alex?.sacrifice?.contributionsTax ?? 0);
  });

  it("shows super as out of reach until it can be released", () => {
    const r = compareSuperOrMortgage(input({ years: 10 }));
    const sup = r.options.find((o) => o.kind === "super");
    expect(sup?.reachable).toBe(0);
    expect(r.mortgage.reachable).toBeGreaterThan(0);
    expect(r.warnings).toContainEqual({ kind: "locked", personId: "a", releaseAge: 65 });
  });

  it("works out when super can be reached", () => {
    expect(releaseAge({ retireAge: 55 })).toBe(60);
    expect(releaseAge({ retireAge: 62 })).toBe(62);
    expect(releaseAge({ retireAge: 70 })).toBe(65);
  });
});
