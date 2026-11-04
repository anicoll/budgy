/**
 * Transfer (stamp) duty rules for each state and territory, for contracts
 * signed in the 2026-27 financial year (from 1 July 2026).
 *
 * Duty scales are in dollars, as the revenue offices publish them: each band
 * charges `base` plus `per100` for every $100 (or part of $100) over `from`.
 * A `flat` band charges `per100` on the whole value instead. Update these each
 * July, and whenever a state budget changes a concession mid-year.
 */

export type AuState = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "ACT" | "NT";

export const AU_STATES: AuState[] = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

export const STATE_NAMES: Record<AuState, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

export interface DutyBand {
  from: number; // dollars; the band applies to values above this
  base: number; // dollars
  per100: number; // dollars per $100 over `from`, or of the whole value when `flat`
  flat?: boolean;
}

export interface DutyScale {
  bands: DutyBand[];
  /** "per100OrPart" rounds the excess up to the next $100; "exact" charges the percentage on the exact amount. */
  rounding: "per100OrPart" | "exact";
  min?: number; // dollars
}

export const DUTY_RULES_YEAR = "2026-27";

// ---------------------------------------------------------------- NSW

export const NSW_GENERAL: DutyScale = {
  rounding: "per100OrPart",
  min: 20,
  bands: [
    { from: 0, base: 0, per100: 1.25 },
    { from: 18_000, base: 225, per100: 1.5 },
    { from: 38_000, base: 525, per100: 1.75 },
    { from: 103_000, base: 1_662, per100: 3.5 },
    { from: 387_000, base: 11_602, per100: 4.5 },
    { from: 1_290_000, base: 52_237, per100: 5.5 },
    // Premium property duty, residential land only.
    { from: 3_870_000, base: 194_137, per100: 7 },
  ],
};

/** First Home Buyers Assistance Scheme: exempt up to `exempt`, concessional below `upper`. */
export const NSW_FIRST_HOME = {
  home: { exempt: 800_000, upper: 1_000_000 },
  land: { exempt: 350_000, upper: 450_000 },
};

// ---------------------------------------------------------------- VIC

export const VIC_GENERAL: DutyScale = {
  rounding: "exact",
  bands: [
    { from: 0, base: 0, per100: 1.4 },
    { from: 25_000, base: 350, per100: 2.4 },
    { from: 130_000, base: 2_870, per100: 6 },
    { from: 960_000, base: 0, per100: 5.5, flat: true },
    { from: 2_000_000, base: 110_000, per100: 6.5 },
  ],
};

/** Principal place of residence concession, for homes up to $550,000. */
export const VIC_PPR: DutyScale = {
  rounding: "exact",
  bands: [
    { from: 0, base: 0, per100: 1.4 },
    { from: 25_000, base: 350, per100: 2.4 },
    { from: 130_000, base: 2_870, per100: 5 },
    { from: 440_000, base: 18_370, per100: 6 },
  ],
};
export const VIC_PPR_CAP = 550_000;

/** First home buyer: exempt up to $600,000, then duty phases back in to $750,000. */
export const VIC_FIRST_HOME = { exempt: 600_000, upper: 750_000 };

// ---------------------------------------------------------------- QLD

export const QLD_GENERAL: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 0 },
    { from: 5_000, base: 0, per100: 1.5 },
    { from: 75_000, base: 1_050, per100: 3.5 },
    { from: 540_000, base: 17_325, per100: 4.5 },
    { from: 1_000_000, base: 38_025, per100: 5.75 },
  ],
};

/** Home concession rate, for a home you'll live in. Charged on the whole value in the first band. */
export const QLD_HOME: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 1 },
    { from: 350_000, base: 3_500, per100: 3.5 },
    { from: 540_000, base: 10_150, per100: 4.5 },
    { from: 1_000_000, base: 30_850, per100: 5.75 },
  ],
};

/**
 * First home concession on an existing home (contracts from 9 June 2024): this
 * amount comes off the home concession duty. Each row is [price below, deduction].
 */
export const QLD_FIRST_HOME_DEDUCTION: [number, number][] = [
  [710_000, 17_350],
  [720_000, 15_615],
  [730_000, 13_880],
  [740_000, 12_145],
  [750_000, 10_410],
  [760_000, 8_675],
  [770_000, 6_940],
  [780_000, 5_205],
  [790_000, 3_470],
  [800_000, 1_735],
];

// ---------------------------------------------------------------- SA

export const SA_GENERAL: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 1 },
    { from: 12_000, base: 120, per100: 2 },
    { from: 30_000, base: 480, per100: 3 },
    { from: 50_000, base: 1_080, per100: 3.5 },
    { from: 100_000, base: 2_830, per100: 4 },
    { from: 200_000, base: 6_830, per100: 4.25 },
    { from: 250_000, base: 8_955, per100: 4.75 },
    { from: 300_000, base: 11_330, per100: 5 },
    { from: 500_000, base: 21_330, per100: 5.5 },
  ],
};

// ---------------------------------------------------------------- WA

export const WA_GENERAL: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 1.9 },
    { from: 120_000, base: 2_280, per100: 2.85 },
    { from: 150_000, base: 3_135, per100: 3.8 },
    { from: 360_000, base: 11_115, per100: 4.75 },
    { from: 725_000, base: 28_453, per100: 5.15 },
  ],
};

/** Residential rate for a home you'll live in, up to $200,000. */
export const WA_PPR: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 1.5 },
    { from: 120_000, base: 1_800, per100: 4.04 },
  ],
};
export const WA_PPR_CAP = 200_000;

/** First home owner rate (agreements from 7 May 2026). */
export const WA_FIRST_HOME = {
  home: { exempt: 600_000, upper: 800_000, per100: 16.15 },
  land: { exempt: 450_000, upper: 550_000, per100: 20.14 },
};

// ---------------------------------------------------------------- TAS

export const TAS_GENERAL: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 50, per100: 0 },
    { from: 3_000, base: 50, per100: 1.75 },
    { from: 25_000, base: 435, per100: 2.25 },
    { from: 75_000, base: 1_560, per100: 3.5 },
    { from: 200_000, base: 5_935, per100: 4 },
    { from: 375_000, base: 12_935, per100: 4.25 },
    { from: 725_000, base: 27_810, per100: 4.5 },
  ],
};

// ---------------------------------------------------------------- ACT

export const ACT_OWNER_OCCUPIER: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 0.28 },
    { from: 260_000, base: 728, per100: 2.2 },
    { from: 300_000, base: 1_608, per100: 3.4 },
    { from: 500_000, base: 8_408, per100: 4.32 },
    { from: 750_000, base: 19_208, per100: 5.9 },
    { from: 1_000_000, base: 33_958, per100: 6.4 },
    { from: 1_455_000, base: 0, per100: 4.54, flat: true },
  ],
};

export const ACT_INVESTOR: DutyScale = {
  rounding: "per100OrPart",
  bands: [
    { from: 0, base: 0, per100: 1.2 },
    { from: 200_000, base: 2_400, per100: 2.2 },
    { from: 300_000, base: 4_600, per100: 3.4 },
    { from: 500_000, base: 11_400, per100: 4.32 },
    { from: 750_000, base: 22_200, per100: 5.9 },
    { from: 1_000_000, base: 36_950, per100: 6.4 },
    { from: 1_455_000, base: 0, per100: 4.54, flat: true },
  ],
};

// ---------------------------------------------------------------- foreign buyers

/** Extra duty on residential land bought by a foreign person, as a share of the value. */
export const FOREIGN_SURCHARGE: Record<AuState, number> = {
  NSW: 0.09,
  VIC: 0.08,
  QLD: 0.08,
  SA: 0.07,
  WA: 0.07,
  TAS: 0.08,
  ACT: 0,
  NT: 0,
};

// ---------------------------------------------------------------- sources

export const DUTY_SOURCES: Record<AuState, string[]> = {
  NSW: [
    "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty",
    "https://www.revenue.nsw.gov.au/grants-schemes/first-home-buyer/assistance-scheme",
  ],
  VIC: [
    "https://www.sro.vic.gov.au/rates-taxes-duties-and-levies/general-land-transfer-duty-property-current-rates",
    "https://www.sro.vic.gov.au/rates-taxes-duties-and-levies/principal-place-residence-current-rates",
    "https://www.sro.vic.gov.au/land-transfer-duty/first-home-buyer-duty-exemption-or-concession",
  ],
  QLD: [
    "https://qro.qld.gov.au/duties/transfer-duty/calculate/rates/",
    "https://qro.qld.gov.au/duties/transfer-duty/calculate/concession-rates/",
  ],
  SA: ["https://revenuesa.sa.gov.au/stampduty/rate-of-stamp-duty"],
  WA: [
    "https://www.wa.gov.au/organisation/department-of-finance/transfer-duty-assessment",
    "https://www.wa.gov.au/government/publications/first-home-owner-rate-of-duty",
  ],
  TAS: [
    "https://www.sro.tas.gov.au/property-transfer-duties/rates-of-duty",
    "https://www.sro.tas.gov.au/property-transfer-duties/concessions-exemptions",
  ],
  ACT: [
    "https://www.revenue.act.gov.au/rates-and-property-charges/conveyance-duty-stamp-duty/conveyance-duty-for-non-commercial-property",
    "https://www.revenue.act.gov.au/home-buyer-assistance/home-buyer-concession-scheme/about-the-home-buyer-concession-scheme",
  ],
  NT: ["https://treasury.nt.gov.au/dtf/territory-revenue-office/stamp-duty"],
};
