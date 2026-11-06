import {
  ATO_HELP,
  ATO_RESIDENT_RATES,
  type GoldenSource,
  MONEYSMART_MORTGAGE,
  NSW_TRANSFER_DUTY,
  QLD_HOME_CONCESSION,
} from "./sources";

/**
 * Headline golden cases, in dollars. The engine tests check these to the cent,
 * and the browser smoke tests type the same scenario into each page and check
 * the figure it shows, so a published number is pinned end to end.
 */
export interface GoldenCase<I, E> {
  name: string;
  source: GoldenSource;
  input: I;
  expected: E;
}

/** $100,000 salary, 2025-26: the ATO's "$4,288 plus 30c for each $1 over $45,000", plus the 2% Medicare levy. */
export const PAY_100K_2025_26: GoldenCase<
  { salary: number; year: string },
  { incomeTax: number; medicare: number; net: number }
> = {
  name: "$100,000 salary in 2025-26",
  source: ATO_RESIDENT_RATES,
  input: { salary: 100_000, year: "2025-26" },
  expected: { incomeTax: 20_788, medicare: 2_000, net: 77_212 },
};

/** Barry, the ATO's second 2026-27 HELP example: repayment income $137,064. */
export const HELP_BARRY_2026_27: GoldenCase<
  { taxableIncome: number; reportableSuper: number; year: string },
  { repayment: number }
> = {
  name: "ATO example 2 (Barry), 2026-27",
  source: ATO_HELP,
  input: { taxableIncome: 118_450, reportableSuper: 18_614, year: "2026-27" },
  expected: { repayment: 10_276.99 },
};

/** $600,000 at 6.00% over 30 years, monthly. Moneysmart shows $3,597; CommBank rounds up to $3,598. */
export const LOAN_600K_6PC_30Y: GoldenCase<
  { amount: number; rate: number; years: number },
  { monthly: number; moneysmartMonthly: number; cbaMonthly: number }
> = {
  name: "$600,000 at 6.00% over 30 years",
  source: MONEYSMART_MORTGAGE,
  input: { amount: 600_000, rate: 0.06, years: 30 },
  // The engine rounds the exact $3,597.3032 up to the cent, as lenders do.
  expected: { monthly: 3_597.31, moneysmartMonthly: 3_597, cbaMonthly: 3_598 },
};

/** Revenue NSW's auction example: $1,350,000 home, no concession. */
export const NSW_DUTY_1_35M: GoldenCase<{ price: number }, { duty: number }> = {
  name: "Revenue NSW auction example (Yamba)",
  source: NSW_TRANSFER_DUTY,
  input: { price: 1_350_000 },
  expected: { duty: 55_537 },
};

/** QRO's home concession example: $950,000 home for someone who has owned before. */
export const QLD_HOME_950K: GoldenCase<{ price: number }, { duty: number }> = {
  name: "QRO home concession example",
  source: QLD_HOME_CONCESSION,
  input: { price: 950_000 },
  expected: { duty: 28_600 },
};
