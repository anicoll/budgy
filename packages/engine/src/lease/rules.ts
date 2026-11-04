import type { Cents } from "../money/cents";
import { financialYear } from "../super/rules";

/**
 * Car and fringe benefits tax rules for novated leases.
 *
 * The car thresholds change each July: add a row once the ATO publishes the
 * year. Years after the last row reuse it, and `carRulesFor` says so.
 */

export interface CarRules {
  year: string; // "2026-27"
  /** Luxury car tax threshold for fuel-efficient cars. Also the price cap for the EV exemption. */
  lctFuelEfficient: Cents;
  /** Luxury car tax threshold for other cars. */
  lctOther: Cents;
  /** Car limit: the most GST an employer can claim back is a 1/11th of this. */
  carLimit: Cents;
  sources: string[];
}

const d = (dollars: number) => Math.round(dollars * 100) as Cents;

const ATO_LCT = "https://www.ato.gov.au/tax-rates-and-codes/luxury-car-tax-rate-and-thresholds";
const ATO_CAR_LIMIT =
  "https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/car-thresholds-from-1-july";

export const CAR_RULES: CarRules[] = [
  {
    year: "2024-25",
    lctFuelEfficient: d(91_387),
    lctOther: d(80_567),
    carLimit: d(69_674),
    sources: [ATO_LCT, ATO_CAR_LIMIT],
  },
  {
    year: "2025-26",
    lctFuelEfficient: d(91_387),
    lctOther: d(80_567),
    carLimit: d(69_674),
    sources: [ATO_LCT, ATO_CAR_LIMIT],
  },
  {
    year: "2026-27",
    lctFuelEfficient: d(91_661),
    lctOther: d(80_809),
    carLimit: d(69_883),
    sources: [ATO_LCT, ATO_CAR_LIMIT],
  },
];

/** Car rules for the financial year containing `iso`, and whether they came from another year. */
export function carRulesFor(iso: string): { rules: CarRules; carriedForward: boolean } {
  const fy = financialYear(iso);
  const exact = CAR_RULES.find((r) => r.year === fy);
  if (exact) return { rules: exact, carriedForward: false };
  if (fy < CAR_RULES[0].year) return { rules: CAR_RULES[0], carriedForward: true };
  return { rules: CAR_RULES[CAR_RULES.length - 1], carriedForward: true };
}

/** Fringe benefits tax, unchanged since the 2017-18 FBT year. */
export const FBT = {
  rate: 0.47,
  /** Gross-up when the employer can claim GST credits, which it can on a car lease. */
  grossUpType1: 2.0802,
  /** Gross-up for reportable fringe benefits on an income statement. */
  grossUpType2: 1.8868,
  /** Statutory formula: taxable value is this share of the car's base value each FBT year. */
  statutoryRate: 0.2,
  /** Reportable on the income statement only when the year's taxable value is over this. */
  reportableOver: d(2_000),
  source:
    "https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/fringe-benefits-tax/types-of-fringe-benefits/fbt-on-cars-other-vehicles-parking-and-tolls/car-fringe-benefits/calculating-car-fringe-benefits/statutory-formula-method",
} as const;

export const LCT_RATE = 0.33;

/** ATO minimum residual values (share of the car's cost) by lease term in years. */
export const ATO_RESIDUALS: Record<number, number> = {
  1: 0.6563,
  2: 0.5625,
  3: 0.4688,
  4: 0.375,
  5: 0.2813,
};
export const ATO_RESIDUALS_SOURCE =
  "https://www.ato.gov.au/law/view/document?docid=TXD/TD93142/NAT/ATO/00001";

/**
 * The electric car FBT exemption and how it is changing.
 *
 * Plug-in hybrids lost the exemption from 1 April 2025, except under
 * commitments made before then. The 2026-27 Budget (12 May 2026) proposed a
 * 25% FBT discount in place of the full exemption: from 1 April 2027 for cars
 * over $75,000, and from 1 April 2029 for every car. An arrangement keeps the
 * rules it started under. This is not law yet (draft legislation September 2026).
 */
export const EV_FBT = {
  phevEndsFrom: "2025-04-01",
  /** From this date, a new lease of an EV over `fullUpTo` gets the discount, not the exemption. */
  phase2From: "2027-04-01",
  fullUpTo: d(75_000),
  /** From this date, every new EV lease gets the discount. */
  phase3From: "2029-04-01",
  /** Under the discount, this share of the taxable value is taxed. */
  discountedShare: 0.75,
  proposed: true,
  sources: [
    "https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/fringe-benefits-tax/types-of-fringe-benefits/fbt-on-cars-other-vehicles-parking-and-tolls/electric-cars-exemption",
    "https://budget.gov.au",
  ],
} as const;
