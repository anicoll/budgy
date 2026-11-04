/**
 * Average Australian home loan rates from the Reserve Bank, Table F6
 * (Housing Lending Rates). The RBA compiles them each month from what every
 * lender reports to APRA, so they are what borrowers actually pay, not the
 * advertised rates.
 *
 * "New" is the average rate on loans written that month (what a lender offers
 * to win a borrower today). "Outstanding" is the average across every
 * existing loan. Both mix variable and fixed loans and every loan size and
 * deposit.
 *
 * Rates are decimals: 0.0615 is 6.15% a year. Update monthly from
 * https://www.rba.gov.au/statistics/tables/#interest-rates
 */

export type LoanPurpose = "owner-occupier" | "investor";
export type RepaymentType = "principal-and-interest" | "interest-only";

export interface AverageRatePair {
  /** Average rate on new loans funded in the month. */
  new: number;
  /** Average rate on all outstanding loans at the end of the month. */
  outstanding: number;
}

export interface RbaHousingRates {
  /** The month the averages cover, YYYY-MM. */
  month: string;
  source: string;
  url: string;
  rates: Record<LoanPurpose, Record<RepaymentType | "all", AverageRatePair>>;
}

export const RBA_HOUSING_RATES: RbaHousingRates = {
  month: "2026-08",
  source: "Reserve Bank of Australia, Statistical Table F6 Housing Lending Rates",
  url: "https://www.rba.gov.au/statistics/interest-rates/",
  rates: {
    "owner-occupier": {
      all: { new: 0.0624, outstanding: 0.0621 },
      "principal-and-interest": { new: 0.0615, outstanding: 0.0619 },
      "interest-only": { new: 0.0704, outstanding: 0.0685 },
    },
    investor: {
      all: { new: 0.064, outstanding: 0.0644 },
      "principal-and-interest": { new: 0.0632, outstanding: 0.0638 },
      "interest-only": { new: 0.0651, outstanding: 0.0657 },
    },
  },
};

/** The averages for a loan like this one. */
export function averageRatesFor(
  purpose: LoanPurpose,
  repayment: RepaymentType,
  data: RbaHousingRates = RBA_HOUSING_RATES,
): AverageRatePair {
  return data.rates[purpose][repayment];
}
