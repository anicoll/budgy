import type { Cents } from "../money/cents";

/**
 * Age Pension estimate: the normal rate, under the income and assets tests,
 * for a single person or a couple who both get it. Figures are per
 * fortnight, as Services Australia publishes them. Not covered: the Work
 * Bonus, Rent Assistance, transitional rates, couples apart due to ill
 * health, or one partner under Age Pension age.
 *
 * Update every 20 March and 20 September, when the rates and thresholds are
 * indexed (the assets limits also move in July).
 */

export interface AgePensionRules {
  from: string; // YYYY-MM-DD the figures apply from
  age: number;
  /** Maximum normal rate a fortnight, with pension and energy supplements. */
  maxRate: { single: Cents; coupleEach: Cents };
  /** Income free area a fortnight; couples combined. */
  incomeFreeArea: { single: Cents; couple: Cents };
  /** Cents off the pension per dollar of income over the free area (single; couple combined). */
  incomeTaper: number;
  /** Assets free area (full pension limit); couples combined. */
  assetsLimit: {
    single: { homeowner: Cents; nonHomeowner: Cents };
    couple: { homeowner: Cents; nonHomeowner: Cents };
  };
  /** Dollars off the pension a fortnight per $1,000 of assets over the limit (single; couple combined). */
  assetsTaperPer1000: Cents;
  deeming: {
    lowerRate: number;
    upperRate: number;
    threshold: { single: Cents; couple: Cents };
  };
  sources: string[];
}

const SA = "https://www.servicesaustralia.gov.au";

export const AGE_PENSION_RULES: AgePensionRules = {
  from: "2026-09-20",
  age: 67,
  maxRate: { single: 123_770 as Cents, coupleEach: 93_300 as Cents },
  incomeFreeArea: { single: 22_600 as Cents, couple: 39_600 as Cents },
  incomeTaper: 0.5,
  assetsLimit: {
    single: { homeowner: 33_300_000 as Cents, nonHomeowner: 60_000_000 as Cents },
    couple: { homeowner: 49_900_000 as Cents, nonHomeowner: 76_600_000 as Cents },
  },
  assetsTaperPer1000: 300 as Cents,
  deeming: {
    lowerRate: 0.0175,
    upperRate: 0.0375,
    threshold: { single: 6_680_000 as Cents, couple: 11_060_000 as Cents },
  },
  sources: [
    `${SA}/how-much-age-pension-you-can-get`,
    `${SA}/income-test-for-age-pension`,
    `${SA}/assets-test-for-age-pension`,
    `${SA}/deeming?context=22526`,
    `${SA}/who-can-get-age-pension`,
  ],
};

export interface AgePensionInput {
  couple: boolean;
  homeowner: boolean;
  /**
   * Assessable assets, couples combined: super once you're over Age Pension
   * age, savings, shares, investment property, cars, contents. Not the home.
   */
  assets: Cents;
  /** The part of `assets` that is financial (super, savings, shares): it is deemed. */
  financialAssets: Cents;
  /** Other assessable income a fortnight, couples combined (rent, work, overseas pensions). */
  otherIncomeFortnight?: Cents;
}

export interface AgePensionResult {
  /** A fortnight, for each person who gets it. */
  each: Cents;
  /** A fortnight, the household total. */
  fortnight: Cents;
  /** A year, the household total (26 fortnights). */
  year: Cents;
  byIncomeTest: Cents; // household, a fortnight
  byAssetsTest: Cents; // household, a fortnight
  /** Which test set the rate: "full" when neither reduced it. */
  limitedBy: "full" | "income" | "assets";
  deemedIncomeFortnight: Cents;
  rules: AgePensionRules;
}

/** Deemed income a year on financial assets. */
export function deemedIncomeYear(financial: Cents, couple: boolean, r = AGE_PENSION_RULES): Cents {
  const t = couple ? r.deeming.threshold.couple : r.deeming.threshold.single;
  const low = Math.min(financial, t);
  const high = Math.max(0, financial - t);
  return Math.round(low * r.deeming.lowerRate + high * r.deeming.upperRate) as Cents;
}

export function validateAgePension(input: AgePensionInput): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.assets) || input.assets < 0) errors.push("assets can't be negative");
  if (!Number.isInteger(input.financialAssets) || input.financialAssets < 0)
    errors.push("financial assets can't be negative");
  if (input.financialAssets > input.assets)
    errors.push("financial assets are part of your assets, so can't be more than them");
  const other = input.otherIncomeFortnight ?? 0;
  if (!Number.isInteger(other) || other < 0) errors.push("other income can't be negative");
  return errors;
}

export function agePension(input: AgePensionInput, r = AGE_PENSION_RULES): AgePensionResult {
  const errors = validateAgePension(input);
  if (errors.length) throw new RangeError(errors.join("; "));
  const people = input.couple ? 2 : 1;
  const max = (input.couple ? r.maxRate.coupleEach : r.maxRate.single) * people;

  const deemedYear = deemedIncomeYear(input.financialAssets, input.couple, r);
  const deemedFortnight = Math.round(deemedYear / 26) as Cents;
  const income = deemedFortnight + (input.otherIncomeFortnight ?? 0);
  const freeArea = input.couple ? r.incomeFreeArea.couple : r.incomeFreeArea.single;
  const byIncome = Math.max(0, max - Math.max(0, income - freeArea) * r.incomeTaper);

  const limits = input.couple ? r.assetsLimit.couple : r.assetsLimit.single;
  const limit = input.homeowner ? limits.homeowner : limits.nonHomeowner;
  // The taper counts each whole $1,000 over the limit.
  const over = Math.floor(Math.max(0, input.assets - limit) / 100_000);
  const byAssets = Math.max(0, max - over * r.assetsTaperPer1000);

  const household = Math.round(Math.min(byIncome, byAssets));
  // Paid in whole cents to each person.
  const each = Math.round(household / people) as Cents;
  const fortnight = (each * people) as Cents;
  const limitedBy =
    household >= max ? "full" : byIncome <= byAssets ? ("income" as const) : ("assets" as const);
  return {
    each,
    fortnight,
    year: (fortnight * 26) as Cents,
    byIncomeTest: Math.round(byIncome) as Cents,
    byAssetsTest: Math.round(byAssets) as Cents,
    limitedBy,
    deemedIncomeFortnight: deemedFortnight,
    rules: r,
  };
}
