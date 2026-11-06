import type { Cents } from "../money/cents";

/**
 * Australian super rules by financial year, each with its source.
 *
 * Add a new year each July once the ATO publishes it. The ATO rules workflow
 * opens a PR when the ATO's tables change, and src/golden/ato.snapshot.test.ts
 * says which values here need updating. Years after the last one listed
 * reuse the last year's values (caps are indexed, so later years are
 * conservative), and `rulesFor` says when it has done that.
 */

export interface SuperRules {
  year: string; // financial year, e.g. "2026-27"
  sgRate: number; // super guarantee, e.g. 0.12
  concessionalCap: Cents; // employer + salary sacrifice + personal deductible
  nonConcessionalCap: Cents; // after-tax; 4 × the concessional cap
  /** Earnings above this in a year attract no super guarantee. Annual from 2026-27; 4 × quarterly before. */
  maxContributionBase: Cents;
  contributionsTax: number; // on concessional contributions, inside the fund
  division293Threshold: Cents; // income + concessional above this pays another 15%
  sources: string[];
}

const ATO_SG =
  "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee";
const ATO_CC =
  "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions/concessional-contributions-cap";

export const SUPER_RULES: SuperRules[] = [
  {
    year: "2024-25",
    sgRate: 0.115,
    concessionalCap: 3_000_000 as Cents,
    nonConcessionalCap: 12_000_000 as Cents,
    maxContributionBase: 26_028_000 as Cents, // $65,070 a quarter
    contributionsTax: 0.15,
    division293Threshold: 25_000_000 as Cents,
    sources: [ATO_SG, ATO_CC],
  },
  {
    year: "2025-26",
    sgRate: 0.12,
    concessionalCap: 3_000_000 as Cents,
    nonConcessionalCap: 12_000_000 as Cents,
    maxContributionBase: 25_000_000 as Cents, // $62,500 a quarter
    contributionsTax: 0.15,
    division293Threshold: 25_000_000 as Cents,
    sources: [ATO_SG, ATO_CC],
  },
  {
    year: "2026-27",
    sgRate: 0.12,
    concessionalCap: 3_250_000 as Cents,
    nonConcessionalCap: 13_000_000 as Cents,
    maxContributionBase: 27_083_000 as Cents, // annual from 1 July 2026 (Payday Super)
    contributionsTax: 0.15,
    division293Threshold: 25_000_000 as Cents,
    sources: [ATO_SG, ATO_CC],
  },
];

/** Age you can usually access super once retired. */
export const PRESERVATION_AGE = 60;
/** Age Pension age, a common retirement age. */
export const AGE_PENSION_AGE = 67;

/** "2026-27" for any date from 1 July 2026 to 30 June 2027. */
export function financialYear(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const start = Number(iso.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The rules for the financial year containing `iso`, and whether they were carried forward. */
export function rulesFor(iso: string): { rules: SuperRules; carriedForward: boolean } {
  const fy = financialYear(iso);
  const exact = SUPER_RULES.find((r) => r.year === fy);
  if (exact) return { rules: exact, carriedForward: false };
  const first = SUPER_RULES[0];
  if (fy < first.year) return { rules: first, carriedForward: true };
  return { rules: SUPER_RULES[SUPER_RULES.length - 1], carriedForward: true };
}
