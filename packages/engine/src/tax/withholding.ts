import type { Cents } from "../money/cents";

/**
 * Pay-as-you-go withholding: what an employer takes out of each pay, from the
 * ATO's statement of formulas (Schedule 1) and study loan components
 * (Schedule 8). Over a year it lands near, but not exactly on, the tax you
 * owe, and the difference comes back (or is owed) at tax time.
 */

export type WithholdingFrequency = "weekly" | "fortnightly" | "monthly";

/** One row: for weekly earnings below `under` (whole dollars), y = a·x − b. */
type Row = [under: number, a: number, b: number];

export interface WithholdingTables {
  year: string;
  /** Scale 1: tax-free threshold not claimed. */
  noThreshold: Row[];
  /** Scale 2: tax-free threshold claimed. */
  threshold: Row[];
  /** Scale 3: foreign residents. */
  foreign: Row[];
  /** Scale 5: full Medicare levy exemption. */
  fullExemption: Row[];
  /** Scale 6: half Medicare levy exemption. */
  halfExemption: Row[];
  /** Schedule 8 study loan component, threshold claimed (or a foreign resident). */
  loanThreshold: Row[];
  /** Schedule 8 study loan component, threshold not claimed. */
  loanNoThreshold: Row[];
  /** Schedule 15: working holiday makers, on the year's earnings. */
  whm: { from: number; rate: number }[];
  sources: string[];
}

const INF = Number.POSITIVE_INFINITY;
const SCHEDULE_1 =
  "https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/coefficients-to-use-in-formulas-for-withholding-from-weekly-payments";
const SCHEDULE_8 =
  "https://www.ato.gov.au/tax-rates-and-codes/schedule-8-statement-of-formulas-for-calculating-study-and-training-support-loans-components";
const SCHEDULE_15 =
  "https://www.ato.gov.au/tax-rates-and-codes/schedule-15-tax-table-for-working-holiday-makers";

export const WITHHOLDING_TABLES: WithholdingTables[] = [
  {
    year: "2026-27", // payments from 1 July 2026
    noThreshold: [
      [188, 0.15, 0.15],
      [371, 0.2084, 11.0185],
      [515, 0.179, 0.1066],
      [932, 0.3227, 74.1674],
      [2246, 0.32, 71.6508],
      [3303, 0.39, 228.8816],
      [INF, 0.47, 493.1893],
    ],
    threshold: [
      [362, 0, 0],
      [538, 0.15, 54.3462],
      [673, 0.25, 108.2135],
      [721, 0.17, 54.3473],
      [865, 0.179, 60.8377],
      [1282, 0.3227, 185.1935],
      [2596, 0.32, 181.7319],
      [3653, 0.39, 363.4627],
      [INF, 0.47, 655.7704],
    ],
    foreign: [
      [2596, 0.3, 0.3],
      [3653, 0.37, 181.7308],
      [INF, 0.45, 474.0385],
    ],
    fullExemption: [
      [362, 0, 0],
      [721, 0.15, 54.3462],
      [865, 0.159, 60.8365],
      [1282, 0.3027, 185.1923],
      [2596, 0.3, 181.7308],
      [3653, 0.37, 363.4615],
      [INF, 0.45, 655.7692],
    ],
    halfExemption: [
      [362, 0, 0],
      [721, 0.15, 54.3462],
      [865, 0.159, 60.8365],
      [908, 0.3027, 185.1923],
      [1135, 0.3527, 230.6135],
      [1282, 0.3127, 185.1923],
      [2596, 0.31, 181.7308],
      [3653, 0.38, 363.4615],
      [INF, 0.46, 655.7692],
    ],
    loanThreshold: [
      [1337, 0, 0],
      [2494, 0.15, 200.5615],
      [3577, 0.17, 250.4527],
      [INF, 0.1, 0],
    ],
    loanNoThreshold: [
      [987, 0, 0],
      [2144, 0.15, 148.0615],
      [2727, 0.17, 190.9527],
      [INF, 0.1, 0],
    ],
    whm: [
      { from: 0, rate: 0.15 },
      { from: 45_000, rate: 0.3 },
      { from: 135_000, rate: 0.37 },
      { from: 190_000, rate: 0.45 },
    ],
    sources: [SCHEDULE_1, SCHEDULE_8, SCHEDULE_15],
  },
];

export function withholdingTablesFor(year: string): WithholdingTables | undefined {
  return WITHHOLDING_TABLES.find((t) => t.year === year);
}

/** Round to the nearest dollar, halves up, as the schedules say. Returns dollars. */
const nearestDollar = (v: number) => Math.floor(v + 0.5 + 1e-9);

/** Weekly withholding in whole dollars for whole-dollar weekly earnings. */
export function weeklyFromTable(weeklyDollars: number, rows: Row[]): number {
  const x = weeklyDollars + 0.99;
  const row = rows.find(([under]) => weeklyDollars < under) ?? rows[rows.length - 1];
  const y = row[1] * x - row[2];
  return Math.max(0, nearestDollar(y));
}

/**
 * Withholding for one pay, in cents, using the ATO's conversion: fortnightly
 * halves to a week and doubles back; monthly goes through 3/13 and back.
 */
export function withholdForPay(
  earnings: Cents,
  frequency: WithholdingFrequency,
  rows: Row[],
): Cents {
  if (earnings <= 0) return 0 as Cents;
  if (frequency === "weekly")
    return (weeklyFromTable(Math.floor(earnings / 100), rows) * 100) as Cents;
  if (frequency === "fortnightly") {
    const week = Math.floor(earnings / 2 / 100);
    return (weeklyFromTable(week, rows) * 2 * 100) as Cents;
  }
  // Monthly: an amount ending in 33 cents gets a cent added first.
  const adjusted = earnings % 100 === 33 ? earnings + 1 : earnings;
  const week = Math.floor((adjusted * 3) / 13 / 100);
  return (nearestDollar((weeklyFromTable(week, rows) * 13) / 3) * 100) as Cents;
}

export type WithholdingScale =
  | "threshold"
  | "noThreshold"
  | "foreign"
  | "fullExemption"
  | "halfExemption";

/** Working holiday makers: the year's earnings through the Schedule 15 rates, spread evenly. */
export function whmWithholding(
  annualEarnings: Cents,
  periods: number,
  bands: WithholdingTables["whm"],
): Cents {
  const dollars = Math.floor(annualEarnings / 100);
  let tax = 0;
  for (let i = 0; i < bands.length; i++) {
    const { from, rate } = bands[i];
    if (dollars <= from) break;
    const to = i + 1 < bands.length ? Math.min(dollars, bands[i + 1].from) : dollars;
    tax += (to - from) * rate;
  }
  return (nearestDollar(tax / periods) * 100) as Cents;
}
