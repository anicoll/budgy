import type { Cents } from "../money/cents";
import { financialYear } from "../super/rules";
import { calculatePay, studyLoanRepayment } from "../tax/pay";
import { type TaxRules, taxRulesForYear } from "../tax/rules";

/**
 * Pay off a HELP (or other study and training) loan early, or keep the money?
 *
 * A HELP debt grows by indexation on 1 June each year, on the balance after
 * any voluntary payment made before then. The compulsory repayment for an
 * income year is withheld from pay during the year but only comes off the
 * debt when the tax return is assessed, after that year's indexation.
 *
 * The comparison: put a lump sum on the loan today, or keep it in an offset
 * account or savings. Either way the compulsory repayments are set by income,
 * so paying early doesn't change them until the debt is gone; after that the
 * repayments that would have been withheld are kept and saved at the same
 * rate. Both sides are compared when the debt is gone in both, as savings
 * minus what's still owed.
 */

/** Indexation rate applied on 1 June of each year (lower of CPI and WPI since 2023). */
export const HELP_INDEXATION: { year: number; rate: number }[] = [
  { year: 2022, rate: 0.039 },
  { year: 2023, rate: 0.032 }, // first published as 7.1%
  { year: 2024, rate: 0.04 }, // first published as 4.7%
  { year: 2025, rate: 0.032 },
  { year: 2026, rate: 0.028 },
];
export const HELP_INDEXATION_SOURCE =
  "https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-indexation-rates";

/**
 * The last income year whose HELP repayment thresholds the ATO has published.
 * Later years scale those thresholds by each 1 June's indexation, as the ATO does.
 * Move this on each July when the new thresholds are added to `TAX_RULES`.
 */
export const HELP_THRESHOLDS_PUBLISHED_TO = "2026-27";

export type HelpAlternative = "offset" | "savings";

export interface HelpEarlyInput {
  /** Today, as an ISO date. */
  today: string;
  /** Loan balance on myGov after your last tax return was assessed. */
  balance: Cents;
  /** Repayment income this year (taxable income plus fringe benefits, super sacrifice and so on). */
  income: Cents;
  /** Yearly growth in repayment income, such as 0.03. */
  incomeGrowth: number;
  /** Indexation rate for each 1 June the ATO hasn't published yet. */
  indexation: number;
  /** The lump sum you could pay today. Anything above the balance is ignored. */
  lumpSum: Cents;
  /** Where the money goes if you don't pay the loan. Offset interest saved isn't taxed; savings interest is. */
  alternative: HelpAlternative;
  /** Yearly rate for the alternative, before tax. */
  rate: number;
  /** Marginal tax rate on savings interest. Leave out to work it out from `income`. */
  taxRate?: number;
}

export interface HelpYear {
  year: string; // "2026-27"
  income: Cents;
  opening: Cents;
  /** 1 June inside this income year, or null when it has already passed. */
  indexationDate: string | null;
  indexationRate: number;
  /** Whether the rate is the ATO's or the assumption. */
  rateKnown: boolean;
  indexation: Cents;
  /** Compulsory repayment credited when this year's return is assessed. */
  compulsory: Cents;
  closing: Cents;
  /** Savings at the end of the year (the lump sum kept, or repayments no longer needed). */
  savings: Cents;
}

export interface HelpScenario {
  years: HelpYear[];
  /** Paid today. */
  paidNow: Cents;
  /** The income year the debt is gone in, or null if it isn't gone by the end. */
  clearedIn: string | null;
  totalIndexation: Cents;
  totalCompulsory: Cents;
  /** What you have at the end: savings minus any debt left. */
  netWorth: Cents;
}

export type HelpWarning =
  | { kind: "lump-sum-capped"; balance: Cents }
  | { kind: "never-repaid"; owed: Cents }
  | { kind: "below-threshold" };

export interface HelpEarlyResult {
  keep: HelpScenario;
  payNow: HelpScenario;
  /** Rate the kept money earns after tax. */
  afterTaxRate: number;
  taxRate: number;
  /** End of the comparison: the last income year shown. */
  horizon: string;
  /** Pay now minus keep. Positive means paying the loan early comes out ahead. */
  advantage: Cents;
  /**
   * The before-tax rate on the alternative at which both come out the same, or
   * null if no rate from -5% to 30% does. Paying early wins below it.
   */
  breakEvenRate: number | null;
  /** How many income years sooner the loan is gone if you pay now. */
  yearsSooner: number;
  /** Compulsory repayment this year, and as a share of income. */
  compulsoryThisYear: Cents;
  warnings: HelpWarning[];
  sources: string[];
}

const MAX_YEARS = 50;
const toC = (n: number) => Math.round(n) as Cents;

function fyStart(fy: string): number {
  return Number(fy.slice(0, 4));
}
function fyName(start: number): string {
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function indexationRateFor(
  juneYear: number,
  assumed: number,
): { rate: number; known: boolean } {
  const hit = HELP_INDEXATION.find((r) => r.year === juneYear);
  return hit ? { rate: hit.rate, known: true } : { rate: assumed, known: false };
}

/** HELP thresholds for an income year, and the factor they were scaled by. */
export function helpRulesFor(
  fy: string,
  assumed: number,
): { rules: TaxRules["help"]; scale: number } {
  if (fy <= HELP_THRESHOLDS_PUBLISHED_TO)
    return { rules: taxRulesForYear(fy).rules.help, scale: 1 };
  const base = taxRulesForYear(HELP_THRESHOLDS_PUBLISHED_TO).rules.help;
  let scale = 1;
  // Thresholds for the year starting July Y move with the indexation of 1 June Y.
  for (let y = fyStart(HELP_THRESHOLDS_PUBLISHED_TO) + 1; y <= fyStart(fy); y++)
    scale *= 1 + indexationRateFor(y, assumed).rate;
  return { rules: base, scale };
}

/** Compulsory repayment for an income year, with thresholds indexed past the last published year. */
export function compulsoryRepayment(income: Cents, fy: string, assumed: number): Cents {
  const { rules, scale } = helpRulesFor(fy, assumed);
  if (scale === 1) return studyLoanRepayment(income, rules);
  return toC(studyLoanRepayment((income / scale) as Cents, rules) * scale);
}

export function validateHelpEarly(input: HelpEarlyInput): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.today))
    errors.push("Today should be a date like 2026-11-04.");
  const money = (v: number, label: string, max: number) => {
    if (!Number.isInteger(v) || v < 0 || v > max)
      errors.push(`${label} should be from $0 to $${max / 100}.`);
  };
  money(input.balance, "The loan balance", 1_000_000_00);
  money(input.income, "Income", 10_000_000_00);
  money(input.lumpSum, "The lump sum", 1_000_000_00);
  const rate = (v: number, label: string, lo: number, hi: number) => {
    if (!Number.isFinite(v) || v < lo || v > hi)
      errors.push(`${label} should be from ${lo * 100}% to ${hi * 100}%.`);
  };
  rate(input.incomeGrowth, "Income growth", -0.1, 0.2);
  rate(input.indexation, "Indexation", -0.05, 0.2);
  rate(input.rate, "The rate", -0.05, 0.3);
  if (input.taxRate !== undefined) rate(input.taxRate, "The tax rate", 0, 0.6);
  return errors;
}

/** Fraction of a year from `iso` to 30 June. */
function rest(iso: string): number {
  const start = fyStart(financialYear(iso));
  const end = Date.UTC(start + 1, 6, 1);
  const now = Date.parse(`${iso}T00:00:00Z`);
  return Math.max(0, Math.min(1, (end - now) / (end - Date.UTC(start, 6, 1))));
}

function run(
  input: HelpEarlyInput,
  paid: Cents,
  growth: number,
  /** Compulsory repayments of the keep scenario, to know what's freed up. */
  keepCompulsory: Cents[] | null,
  years: number,
): HelpScenario {
  const first = fyStart(financialYear(input.today));
  const firstPart = rest(input.today);
  let debt = input.balance - paid;
  let savings = 0;
  const rows: HelpYear[] = [];
  let clearedIn: string | null = debt <= 0 ? financialYear(input.today) : null;
  let totalIndexation = 0;
  let totalCompulsory = 0;
  for (let k = 0; k < years; k++) {
    const year = fyName(first + k);
    const income = toC(input.income * (1 + input.incomeGrowth) ** k);
    const opening = debt;
    const june = `${first + k + 1}-06-01`;
    const passed = k === 0 && input.today >= june;
    const { rate, known } = indexationRateFor(first + k + 1, input.indexation);
    const indexation = passed || debt <= 0 ? 0 : toC(debt * rate);
    debt += indexation;
    const due = compulsoryRepayment(income, year, input.indexation);
    const compulsory = Math.min(due, debt) as Cents;
    debt -= compulsory;
    if (debt <= 0 && clearedIn === null) clearedIn = year;
    savings = savings * (1 + growth) ** (k === 0 ? firstPart : 1);
    if (keepCompulsory) savings += (keepCompulsory[k] ?? 0) - compulsory;
    savings = toC(savings);
    totalIndexation += indexation;
    totalCompulsory += compulsory;
    rows.push({
      year,
      income,
      opening: opening as Cents,
      indexationDate: passed ? null : june,
      indexationRate: rate,
      rateKnown: known,
      indexation: indexation as Cents,
      compulsory,
      closing: debt as Cents,
      savings: savings as Cents,
    });
  }
  return {
    years: rows,
    paidNow: paid,
    clearedIn,
    totalIndexation: totalIndexation as Cents,
    totalCompulsory: totalCompulsory as Cents,
    netWorth: (savings - debt) as Cents,
  };
}

function compare(input: HelpEarlyInput, growth: number) {
  const paid = Math.min(input.lumpSum, input.balance) as Cents;
  // Run keep until the debt is gone, then compare both over the same years.
  const none = 0 as Cents;
  const probe = run(input, none, growth, null, MAX_YEARS);
  const last = probe.years.findIndex((y) => y.closing <= 0);
  const years = last === -1 ? MAX_YEARS : last + 1;
  const keepTrack = run(input, none, growth, null, years);
  // The kept lump sum sits in savings; the debt is untouched.
  const keep = withLump(keepTrack, paid, growth, input.today);
  const payNow = run(
    input,
    paid,
    growth,
    keepTrack.years.map((y) => y.compulsory),
    years,
  );
  return { keep, payNow, paid };
}

/** Add a kept lump sum, growing from today, to a scenario's savings. */
function withLump(s: HelpScenario, lump: Cents, growth: number, today: string): HelpScenario {
  const firstPart = rest(today);
  let saved = lump as number;
  const years = s.years.map((y, k) => {
    saved = toC(saved * (1 + growth) ** (k === 0 ? firstPart : 1));
    return { ...y, savings: (y.savings + saved) as Cents };
  });
  const end = years[years.length - 1];
  return {
    ...s,
    years,
    netWorth: ((end?.savings ?? lump) - (end?.closing ?? s.years[0]?.opening ?? 0)) as Cents,
  };
}

export function compareHelpEarly(input: HelpEarlyInput): HelpEarlyResult {
  const errors = validateHelpEarly(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const fy = financialYear(input.today);
  const taxRate =
    input.alternative === "offset"
      ? 0
      : (input.taxRate ?? calculatePay({ year: fy, salary: input.income }).marginalRate);
  const afterTax = (r: number) => (input.alternative === "offset" ? r : r * (1 - taxRate));
  const afterTaxRate = afterTax(input.rate);
  const { keep, payNow, paid } = compare(input, afterTaxRate);
  const advantage = (payNow.netWorth - keep.netWorth) as Cents;

  let breakEvenRate: number | null = null;
  if (paid > 0) {
    const adv = (r: number) => {
      const c = compare(input, afterTax(r));
      return c.payNow.netWorth - c.keep.netWorth;
    };
    let lo = -0.05;
    let hi = 0.3;
    if (adv(lo) > 0 && adv(hi) < 0) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (adv(mid) > 0) lo = mid;
        else hi = mid;
      }
      breakEvenRate = Math.round(((lo + hi) / 2) * 10_000) / 10_000;
    }
  }

  const idx = (s: HelpScenario) =>
    s.clearedIn === null ? s.years.length : fyStart(s.clearedIn) - fyStart(fy) + 1;
  const warnings: HelpWarning[] = [];
  if (input.lumpSum > input.balance)
    warnings.push({ kind: "lump-sum-capped", balance: input.balance });
  const end = keep.years[keep.years.length - 1];
  if (keep.clearedIn === null && end) warnings.push({ kind: "never-repaid", owed: end.closing });
  const compulsoryThisYear = compulsoryRepayment(input.income, fy, input.indexation);
  if (compulsoryThisYear === 0) warnings.push({ kind: "below-threshold" });

  return {
    keep,
    payNow,
    afterTaxRate,
    taxRate,
    horizon: end?.year ?? fy,
    advantage,
    breakEvenRate,
    yearsSooner: idx(keep) - idx(payNow),
    compulsoryThisYear,
    warnings,
    sources: [
      HELP_INDEXATION_SOURCE,
      "https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds",
    ],
  };
}
