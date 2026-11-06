import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { bracketTax, calculatePay, medicareLevy, studyLoanRepayment } from "../tax/pay";
import { taxRulesForYear } from "../tax/rules";
import { HELP_BARRY_2026_27, PAY_100K_2025_26 } from "./cases";
import { ATO_HELP, ATO_MEDICARE_LOW_INCOME, ATO_RESIDENT_RATES } from "./sources";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;

describe(`income tax: ${ATO_RESIDENT_RATES.name}`, () => {
  // The "$X plus" figure at the start of each band is tax on the band's lower edge.
  it.each([
    ["2025-26", 18_200, 0],
    ["2025-26", 45_000, 4_288],
    ["2025-26", 135_000, 31_288],
    ["2025-26", 190_000, 51_638],
    ["2026-27", 18_200, 0],
    ["2026-27", 45_000, 4_020],
    ["2026-27", 135_000, 31_020],
    ["2026-27", 190_000, 51_370],
  ] as const)("%s: tax on $%d is $%d", (year, income, tax) => {
    expect(d(bracketTax(c(income), taxRulesForYear(year).rules.resident))).toBe(tax);
  });

  it("$100,000 in 2025-26: $20,788 tax plus $2,000 Medicare levy", () => {
    const { input, expected } = PAY_100K_2025_26;
    const r = calculatePay({ year: input.year, salary: c(input.salary) });
    expect(d(r.incomeTax)).toBe(expected.incomeTax);
    expect(d(r.medicare)).toBe(expected.medicare);
    expect(d(r.net)).toBe(expected.net);
  });
});

describe(`Medicare levy: ${ATO_MEDICARE_LOW_INCOME.name}`, () => {
  const r = taxRulesForYear("2025-26").rules.medicare;

  it("uses the 2025-26 lower threshold of $28,011", () => {
    expect(d(medicareLevy(c(28_011), r))).toBe(0);
  });

  it("Angie, on $29,000, pays a reduced levy of $98.90", () => {
    expect(d(medicareLevy(c(29_000), r))).toBe(98.9);
  });

  it("still reduces the levy at the upper threshold of $35,013, and not above it", () => {
    // "Equal to or less than the upper threshold" qualifies: 10% of the excess, $700.20.
    expect(d(medicareLevy(c(35_013), r))).toBe(700.2);
    // A dollar more and the full 2% is the smaller.
    expect(d(medicareLevy(c(35_014), r))).toBe(700.28);
  });
});

describe(`HELP repayments: ${ATO_HELP.name}`, () => {
  const help = (year: string) => taxRulesForYear(year).rules.help;

  it.each([
    // Example 1 (Christina): $60,470 taxable + $5,400 fringe benefits + $1,330 net
    // investment loss + $16,500 reportable super + $2,680 exempt foreign income.
    ["Christina", 86_380, 2_527.8],
    ["Barry", 137_064, 10_276.99],
    ["Priya", 254_780, 25_478],
  ] as const)("2026-27 example (%s): repayment income $%d repays $%d", (_, income, repayment) => {
    expect(d(studyLoanRepayment(c(income), help("2026-27")))).toBe(repayment);
  });

  // Band edges as the tables print them. The ATO rounds the "$9,028 plus" base
  // down, so the top of the 15% band (15% of $60,189 = $9,028.35) repays a few
  // cents more than the first dollar of the 17% band.
  it.each([
    ["2026-27", 69_528, 0],
    ["2026-27", 129_717, 9_028.35],
    ["2026-27", 129_718, 9_028.17],
    ["2026-27", 186_051, 18_605.1],
    ["2025-26", 67_000, 0],
    ["2025-26", 125_000, 8_700],
    ["2025-26", 179_286, 17_928.6],
  ] as const)("%s: repayment income $%d repays $%d", (year, income, repayment) => {
    expect(d(studyLoanRepayment(c(income), help(year)))).toBe(repayment);
  });

  it("Barry through the pay calculator: super sacrifice counts as repayment income", () => {
    const { input, expected } = HELP_BARRY_2026_27;
    const r = calculatePay({
      year: input.year,
      salary: c(input.taxableIncome + input.reportableSuper),
      salarySacrifice: c(input.reportableSuper),
      studyLoan: true,
    });
    expect(d(r.taxableIncome)).toBe(input.taxableIncome);
    expect(d(r.repaymentIncome)).toBe(137_064);
    expect(d(r.studyLoan)).toBe(expected.repayment);
  });

  it("Priya through the pay calculator: 10% of the whole repayment income", () => {
    const r = calculatePay({
      year: "2026-27",
      salary: c(227_123 + 27_657),
      salarySacrifice: c(27_657),
      studyLoan: true,
    });
    expect(d(r.studyLoan)).toBe(25_478);
  });
});
