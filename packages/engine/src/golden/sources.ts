/**
 * Where each golden value comes from, and when it was last checked by hand.
 *
 * Golden tests compare the engine with figures published by someone else: the
 * ATO's own worked examples and sample data, revenue offices' worked examples,
 * and what Moneysmart's and a big-four lender's calculators show. When a
 * source changes (each July, or at a state budget), check the page again,
 * update the case and move `checked` on.
 */
export interface GoldenSource {
  name: string;
  url: string;
  /** The page's own "last updated" or "published" date, if it shows one. */
  updated?: string;
  /** When someone last compared the page with these tests. */
  checked: string;
}

export const ATO_RESIDENT_RATES: GoldenSource = {
  name: "ATO: Tax rates – Australian resident",
  url: "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents",
  updated: "2026-08-13",
  checked: "2026-11-05",
};

export const ATO_MEDICARE_LOW_INCOME: GoldenSource = {
  name: "ATO: Medicare levy reduction for low-income earners",
  url: "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners",
  updated: "2026-06-30",
  checked: "2026-11-05",
};

export const ATO_HELP: GoldenSource = {
  name: "ATO: Study and training loan repayment thresholds and rates",
  url: "https://www.ato.gov.au/tax-rates-and-codes/study-and-training-loan-minimum-repayment-income-and-rates",
  updated: "2026-06-30",
  checked: "2026-11-05",
};

export const ATO_SUPER_GUARANTEE: GoldenSource = {
  name: "ATO: Super guarantee",
  url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee",
  updated: "2026-04-17",
  checked: "2026-11-05",
};

export const ATO_CONTRIBUTION_CAPS: GoldenSource = {
  name: "ATO: Contributions caps",
  url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps",
  updated: "2026-09-11",
  checked: "2026-11-05",
};

export const ATO_SCHEDULE_1_EXAMPLES: GoldenSource = {
  name: "ATO: Schedule 1, examples of calculating the withholding amounts",
  url: "https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/examples-of-calculating-the-withholding-amounts",
  updated: "2026-06-17",
  checked: "2026-11-05",
};

export const ATO_SCHEDULE_1_SAMPLE: GoldenSource = {
  name: "ATO: Schedule 1, withholding amounts sample data",
  url: "https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/sample-data/withholding-amounts-sample-data",
  updated: "2026-06-17",
  checked: "2026-11-05",
};

export const NSW_TRANSFER_DUTY: GoldenSource = {
  name: "Revenue NSW: How to calculate transfer duty",
  url: "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty/understanding-transfer-duty/calculate-transfer-duty",
  updated: "2026-10-06",
  checked: "2026-11-05",
};

export const VIC_GENERAL_RATES: GoldenSource = {
  name: "SRO Victoria: Land transfer duty – non-principal place of residence (current rates)",
  url: "https://www.sro.vic.gov.au/about-us/rates-and-statistics/current-rates/land-transfer-duty-non-principal-place-residence-current-rates",
  updated: "2026-09-29",
  checked: "2026-11-05",
};

export const QLD_TRANSFER_DUTY: GoldenSource = {
  name: "Queensland Revenue Office: Transfer duty rates",
  url: "https://qro.qld.gov.au/duties/transfer-duty/calculate/rates/",
  updated: "2026-06-25",
  checked: "2026-11-05",
};

export const QLD_HOME_CONCESSION: GoldenSource = {
  name: "Queensland Revenue Office: Transfer duty home concession rates",
  url: "https://qro.qld.gov.au/duties/transfer-duty/calculate/concession-rates/",
  checked: "2026-11-05",
};

export const MONEYSMART_MORTGAGE: GoldenSource = {
  name: "Moneysmart mortgage calculator",
  url: "https://moneysmart.gov.au/home-loans/mortgage-calculator",
  updated: "2026-10-27",
  checked: "2026-11-05",
};

export const CBA_REPAYMENTS: GoldenSource = {
  name: "CommBank mortgage repayment calculator",
  url: "https://www.commbank.com.au/digital/home-buying/calculator/home-loan-repayments",
  checked: "2026-11-06",
};
