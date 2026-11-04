/**
 * Average Australian home loan rates from the Reserve Bank, Table F6
 * (Housing Lending Rates). The RBA compiles them each month from what every
 * lender reports to APRA, so they are what borrowers actually pay, not
 * advertised rates.
 *
 * "New" is the average rate on loans funded that month (what a lender offers
 * to win a borrower today). "Outstanding" is the average across every
 * existing loan. Each series covers all institutions.
 *
 * F6 splits loans one way at a time: by rate type, or by repayment type, but
 * not both. So the variable series mixes principal-and-interest and
 * interest-only loans, and the interest-only series mixes variable and fixed.
 * For fixed loans the outstanding series is by fixed term left; the new series
 * is by the term fixed at the start.
 *
 * Rates are decimals: 0.0615 is 6.15% a year. To update, take the latest row
 * of https://www.rba.gov.au/statistics/tables/xls/f06hist.xlsx (the CSV is
 * rounded to one decimal place) and copy the series IDs listed below.
 */

export type LoanPurpose = "owner-occupier" | "investor";
export type RepaymentType = "principal-and-interest" | "interest-only";
export type RateType = "variable" | "fixed-up-to-3-years" | "fixed-over-3-years";

export type RateSeries = "all" | RepaymentType | RateType;

export interface AverageRatePair {
  /** Average rate on new loans funded in the month. */
  new: number;
  /** Average rate on all outstanding loans at the end of the month. */
  outstanding: number;
}

export interface RbaHousingRates {
  /** The month the averages cover, YYYY-MM. */
  month: string;
  /** When the RBA published them, YYYY-MM-DD. */
  published: string;
  source: string;
  url: string;
  rates: Record<LoanPurpose, Record<RateSeries, AverageRatePair>>;
}

export const RBA_HOUSING_RATES: RbaHousingRates = {
  month: "2026-08",
  published: "2026-10-08",
  source: "Reserve Bank of Australia, Statistical Table F6 Housing Lending Rates",
  url: "https://www.rba.gov.au/statistics/tables/#interest-rates",
  rates: {
    "owner-occupier": {
      all: { new: 0.0624, outstanding: 0.0621 }, // FLRHOFTA, FLRHOOTA
      variable: { new: 0.0623, outstanding: 0.0624 }, // FLRHOFVA, FLRHOOVA
      "fixed-up-to-3-years": { new: 0.0626, outstanding: 0.0561 }, // FLRHOFFA, FLRHOOFA
      "fixed-over-3-years": { new: 0.0685, outstanding: 0.0615 }, // FLRHOFFB, FLRHOOFB
      "principal-and-interest": { new: 0.0615, outstanding: 0.0619 }, // FLRHOFP, FLRHOOP
      "interest-only": { new: 0.0704, outstanding: 0.0685 }, // FLRHOFI, FLRHOOI
    },
    investor: {
      all: { new: 0.064, outstanding: 0.0644 }, // FLRHIFTA, FLRHIOTA
      variable: { new: 0.064, outstanding: 0.0647 }, // FLRHIFVA, FLRHIOVA
      "fixed-up-to-3-years": { new: 0.0646, outstanding: 0.0574 }, // FLRHIFFA, FLRHIOFA
      "fixed-over-3-years": { new: 0.0758, outstanding: 0.0653 }, // FLRHIFFB, FLRHIOFB
      "principal-and-interest": { new: 0.0632, outstanding: 0.0638 }, // FLRHIFP, FLRHIOP
      "interest-only": { new: 0.0651, outstanding: 0.0657 }, // FLRHIFI, FLRHIOI
    },
  },
};

/**
 * The series to compare a loan with. Interest-only loans carry a premium, so
 * they compare with the interest-only averages; everything else compares
 * with the averages for its rate type.
 */
export function benchmarkSeries(repayment: RepaymentType, rateType: RateType): RateSeries {
  return repayment === "interest-only" ? "interest-only" : rateType;
}

/** The averages for a loan like this one. */
export function averageRatesFor(
  purpose: LoanPurpose,
  series: RateSeries,
  data: RbaHousingRates = RBA_HOUSING_RATES,
): AverageRatePair {
  return data.rates[purpose][series];
}
