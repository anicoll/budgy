import type { Cents } from "../money/cents";
import { financialYear } from "../super/rules";

/**
 * Australian individual tax rules by financial year, each with its source.
 *
 * Add a year each July once the ATO publishes it. The ATO rules workflow
 * (.github/workflows/ato-rules.yml) opens a PR when the ATO's tables change,
 * and src/golden/ato.snapshot.test.ts says which values here need updating.
 * Thresholds that aren't out yet reuse the year before and are listed in
 * `notes`, so the page can say so.
 * Years after the last one listed reuse the last year, and `taxRulesFor` says
 * when it has done that.
 */

/** A rate that applies to each dollar above `from`. */
export interface Bracket {
  from: Cents;
  rate: number;
}

export interface TaxRules {
  year: string; // "2026-27"
  resident: Bracket[];
  foreign: Bracket[];
  /** Working holiday makers (visa 417 or 462). */
  whm: Bracket[];
  /** Low income tax offset: `max` up to `full`, then two tapers down to nil. */
  lito: {
    max: Cents;
    full: Cents;
    taper1To: Cents;
    taper1Rate: number;
    taper2Rate: number;
  };
  medicare: {
    rate: number;
    /** No levy at or below this taxable income (single, not a senior). */
    lowSingle: Cents;
    /** Same for a family, plus `perChild` for each dependent child. */
    lowFamily: Cents;
    perChild: Cents;
    /** Above the low threshold the levy shades in at this rate until it reaches the full rate. */
    shadeIn: number;
  };
  /** Medicare levy surcharge when there's no private hospital cover. */
  mls: {
    single: [Cents, Cents, Cents]; // tier 1, 2 and 3 start above these
    family: [Cents, Cents, Cents];
    /** Family thresholds go up by this for each dependent child after the first. */
    perChildAfterFirst: Cents;
    rates: [number, number, number];
  };
  /** Study and training loan (HELP, VSL, SFSS, AASL) compulsory repayments, marginal from 2025-26. */
  help: {
    nil: Cents; // no repayment at or below this
    band1To: Cents;
    band1Rate: number; // on income above `nil`
    band2Base: Cents; // band 1 in full, as the ATO publishes it
    band2Rate: number; // on income above `band1To`, plus `band2Base`
    topFrom: Cents; // at or above this, `topRate` of the whole repayment income
    topRate: number;
  };
  /** What hasn't been published yet for this year and was carried from the year before. */
  notes: string[];
  sources: string[];
}

const d = (dollars: number) => Math.round(dollars * 100) as Cents;

const ATO_WHM = "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-working-holiday-makers";
const ATO_RATES = "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents";
const ATO_CUTS =
  "https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/personal-income-tax-new-tax-cuts-for-every-australian-taxpayer";
const ATO_HELP =
  "https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds";
const ATO_ML =
  "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners";
const ATO_MLS =
  "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates";

const brackets = (low: number): Pick<TaxRules, "resident" | "foreign" | "whm"> => ({
  resident: [
    { from: d(18_200), rate: low },
    { from: d(45_000), rate: 0.3 },
    { from: d(135_000), rate: 0.37 },
    { from: d(190_000), rate: 0.45 },
  ],
  foreign: [
    { from: d(0), rate: 0.3 },
    { from: d(135_000), rate: 0.37 },
    { from: d(190_000), rate: 0.45 },
  ],
  whm: [
    { from: d(0), rate: 0.15 },
    { from: d(45_000), rate: 0.3 },
    { from: d(135_000), rate: 0.37 },
    { from: d(190_000), rate: 0.45 },
  ],
});

const LITO: TaxRules["lito"] = {
  max: d(700),
  full: d(37_500),
  taper1To: d(45_000),
  taper1Rate: 0.05,
  taper2Rate: 0.015,
};

const MEDICARE_2025: TaxRules["medicare"] = {
  rate: 0.02,
  lowSingle: d(28_011),
  lowFamily: d(47_238),
  perChild: d(4_338),
  shadeIn: 0.1,
};

const MLS_2026: TaxRules["mls"] = {
  single: [d(105_000), d(123_000), d(164_000)],
  family: [d(210_000), d(246_000), d(328_000)],
  perChildAfterFirst: d(1_500),
  rates: [0.01, 0.0125, 0.015],
};

const HELP_2026: TaxRules["help"] = {
  nil: d(69_528),
  band1To: d(129_717),
  band1Rate: 0.15,
  band2Base: d(9_028),
  band2Rate: 0.17,
  topFrom: d(186_051),
  topRate: 0.1,
};

export const TAX_RULES: TaxRules[] = [
  {
    year: "2025-26",
    ...brackets(0.16),
    lito: LITO,
    medicare: MEDICARE_2025,
    mls: {
      single: [d(101_000), d(118_000), d(158_000)],
      family: [d(202_000), d(236_000), d(316_000)],
      perChildAfterFirst: d(1_500),
      rates: [0.01, 0.0125, 0.015],
    },
    help: {
      nil: d(67_000),
      band1To: d(125_000),
      band1Rate: 0.15,
      band2Base: d(8_700),
      band2Rate: 0.17,
      topFrom: d(179_286),
      topRate: 0.1,
    },
    notes: [],
    sources: [ATO_RATES, ATO_WHM, ATO_HELP, ATO_ML, ATO_MLS],
  },
  {
    year: "2026-27",
    ...brackets(0.15),
    lito: LITO,
    medicare: MEDICARE_2025,
    mls: MLS_2026,
    help: HELP_2026,
    notes: ["Medicare levy low-income thresholds are 2025-26's until the ATO publishes 2026-27's."],
    sources: [ATO_CUTS, ATO_WHM, ATO_HELP, ATO_ML, ATO_MLS],
  },
  {
    year: "2027-28",
    ...brackets(0.14),
    lito: LITO,
    medicare: MEDICARE_2025,
    mls: MLS_2026,
    help: HELP_2026,
    notes: [
      "The 14% rate is law. HELP, Medicare levy and surcharge thresholds are earlier years' until the ATO publishes 2027-28's.",
    ],
    sources: [ATO_CUTS, ATO_WHM, ATO_HELP, ATO_ML, ATO_MLS],
  },
];

/** Tax rules for a financial year ("2026-27"), and whether they were carried from another year. */
export function taxRulesForYear(fy: string): { rules: TaxRules; carriedForward: boolean } {
  const exact = TAX_RULES.find((r) => r.year === fy);
  if (exact) return { rules: exact, carriedForward: false };
  const first = TAX_RULES[0];
  if (fy < first.year) return { rules: first, carriedForward: true };
  return { rules: TAX_RULES[TAX_RULES.length - 1], carriedForward: true };
}

/** Tax rules for the financial year containing `iso`. */
export function taxRulesFor(iso: string): { rules: TaxRules; carriedForward: boolean } {
  return taxRulesForYear(financialYear(iso));
}
