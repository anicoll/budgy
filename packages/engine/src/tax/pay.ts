import type { Cents } from "../money/cents";
import { SUPER_RULES, type SuperRules } from "../super/rules";
import { type Bracket, type TaxRules, taxRulesForYear } from "./rules";

/**
 * Take-home pay for one person on a salary, for a whole financial year, as
 * the ATO would assess it at tax time. Pay slips withhold from the ATO's
 * tables, which land within a few dollars of this over the year.
 */

export type PayPeriod = "annual" | "monthly" | "fortnightly" | "weekly";
export const PAY_PERIODS_PER_YEAR: Record<PayPeriod, number> = {
  annual: 1,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

export interface PayInput {
  year: string; // "2026-27"
  /** Salary a year, before tax. Excludes employer super unless `includesSuper`. */
  salary: Cents;
  /** The salary is a package that includes the employer's super. */
  includesSuper?: boolean;
  /** Employer super rate. Leave out for the super guarantee. */
  superRate?: number;
  /** Salary sacrificed into super a year, before tax. */
  salarySacrifice?: Cents;
  residency?: "resident" | "foreign";
  /** Has a HELP, VSL, SFSS or other study and training loan. */
  studyLoan?: boolean;
  /** Has private hospital cover, so no Medicare levy surcharge. Default true. */
  hospitalCover?: boolean;
  /** For the Medicare levy and surcharge thresholds. */
  family?: {
    partnerIncome: Cents; // their income for surcharge purposes
    children: number; // dependent children
  };
}

export interface PayAmounts {
  gross: Cents; // salary, excluding employer super
  salarySacrifice: Cents;
  taxableIncome: Cents;
  incomeTax: Cents; // after the low income tax offset
  medicare: Cents;
  surcharge: Cents; // Medicare levy surcharge
  studyLoan: Cents;
  /** Everything taken out: tax, levies and study loan repayments. */
  totalTax: Cents;
  net: Cents; // take-home pay
  employerSuper: Cents;
}

export type PayWarning =
  | { kind: "concessional-cap"; total: Cents; cap: Cents }
  | { kind: "division-293"; extra: Cents }
  | { kind: "sacrifice-too-big" };

export interface PayResult extends PayAmounts {
  year: string;
  /** The year asked for wasn't listed, so these are the nearest year's rules. */
  carriedForward: boolean;
  /** Tax before the low income tax offset, and the offset itself. */
  taxBeforeOffsets: Cents;
  lito: Cents;
  /** Of the next dollar earned, how much goes in tax, levies and loan. */
  marginalRate: number;
  /** Of the gross, how much goes in tax, levies and loan. */
  averageRate: number;
  periods: Record<PayPeriod, PayAmounts>;
  warnings: PayWarning[];
  notes: string[];
  rules: TaxRules;
  superRules: SuperRules;
}

const toC = (n: number) => Math.round(n) as Cents;

/** Tax on `income` from progressive brackets, to the cent. */
export function bracketTax(income: Cents, brackets: Bracket[]): Cents {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const { from, rate } = brackets[i];
    if (income <= from) break;
    const to = i + 1 < brackets.length ? Math.min(income, brackets[i + 1].from) : income;
    tax += (to - from) * rate;
  }
  return toC(tax);
}

/** Low income tax offset. It can't take tax below zero, which the caller handles. */
export function lowIncomeOffset(taxable: Cents, r: TaxRules["lito"]): Cents {
  if (taxable <= r.full) return r.max;
  let offset = r.max - (Math.min(taxable, r.taper1To) - r.full) * r.taper1Rate;
  if (taxable > r.taper1To) offset -= (taxable - r.taper1To) * r.taper2Rate;
  return toC(Math.max(0, offset));
}

/** Medicare levy, shaded in above the low-income threshold. */
export function medicareLevy(
  taxable: Cents,
  r: TaxRules["medicare"],
  family?: PayInput["family"],
): Cents {
  if (taxable <= r.lowSingle) return 0 as Cents;
  let levy = Math.min(taxable * r.rate, (taxable - r.lowSingle) * r.shadeIn);
  if (family) {
    // A family shades in on family income, and each partner pays their share.
    const low = r.lowFamily + r.perChild * family.children;
    const familyIncome = taxable + family.partnerIncome;
    if (familyIncome <= low) return 0 as Cents;
    const share = ((familyIncome - low) * r.shadeIn * taxable) / familyIncome;
    levy = Math.min(levy, share);
  }
  return toC(levy);
}

/** Medicare levy surcharge rate for someone without private hospital cover. */
export function surchargeRate(
  incomeForSurcharge: Cents,
  r: TaxRules["mls"],
  family?: PayInput["family"],
): number {
  const extra = family ? r.perChildAfterFirst * Math.max(0, family.children - 1) : 0;
  const tiers = family ? r.family : r.single;
  const income = family ? incomeForSurcharge + family.partnerIncome : incomeForSurcharge;
  let rate = 0;
  for (let i = 0; i < 3; i++) if (income > tiers[i] + extra) rate = r.rates[i];
  return rate;
}

/** Compulsory study and training loan repayment for a year. */
export function studyLoanRepayment(repaymentIncome: Cents, r: TaxRules["help"]): Cents {
  if (repaymentIncome <= r.nil) return 0 as Cents;
  if (repaymentIncome >= r.topFrom) return toC(repaymentIncome * r.topRate);
  if (repaymentIncome <= r.band1To) return toC((repaymentIncome - r.nil) * r.band1Rate);
  return toC(r.band2Base + (repaymentIncome - r.band1To) * r.band2Rate);
}

function superRulesForYear(fy: string): SuperRules {
  return (
    SUPER_RULES.find((r) => r.year === fy) ??
    (fy < SUPER_RULES[0].year ? SUPER_RULES[0] : SUPER_RULES[SUPER_RULES.length - 1])
  );
}

/** Salary and employer super from what was typed, splitting a package if need be. */
export function splitPackage(
  amount: Cents,
  includesSuper: boolean,
  rate: number,
  maxBase: Cents,
): { salary: Cents; employerSuper: Cents } {
  if (!includesSuper) {
    return { salary: amount, employerSuper: toC(Math.min(amount, maxBase) * rate) };
  }
  // Above the maximum contribution base, super stops growing with salary.
  const capSuper = maxBase * rate;
  const salary = amount > maxBase + capSuper ? amount - capSuper : amount / (1 + rate);
  const s = toC(salary);
  return { salary: s, employerSuper: toC(amount - s) };
}

interface Core extends PayAmounts {
  taxBeforeOffsets: Cents;
  lito: Cents;
}

function core(input: PayInput, rules: TaxRules, sup: SuperRules): Core {
  const rate = input.superRate ?? sup.sgRate;
  const { salary, employerSuper } = splitPackage(
    input.salary,
    Boolean(input.includesSuper),
    rate,
    sup.maxContributionBase,
  );
  const sacrifice = Math.min(input.salarySacrifice ?? 0, salary) as Cents;
  const taxable = (salary - sacrifice) as Cents;
  const foreign = input.residency === "foreign";

  const taxBeforeOffsets = bracketTax(taxable, foreign ? rules.foreign : rules.resident);
  const lito = foreign ? (0 as Cents) : lowIncomeOffset(taxable, rules.lito);
  const incomeTax = Math.max(0, taxBeforeOffsets - lito) as Cents;
  const medicare = foreign ? (0 as Cents) : medicareLevy(taxable, rules.medicare, input.family);

  // Salary sacrifice is a reportable super contribution: it counts towards
  // the surcharge and study loan income tests even though it isn't taxed.
  const reportable = taxable + sacrifice;
  const surcharge =
    foreign || input.hospitalCover !== false
      ? (0 as Cents)
      : toC(taxable * surchargeRate(reportable as Cents, rules.mls, input.family));
  const studyLoan = input.studyLoan
    ? studyLoanRepayment(reportable as Cents, rules.help)
    : (0 as Cents);

  const totalTax = (incomeTax + medicare + surcharge + studyLoan) as Cents;
  return {
    gross: salary,
    salarySacrifice: sacrifice,
    taxableIncome: taxable,
    taxBeforeOffsets,
    lito: Math.min(lito, taxBeforeOffsets) as Cents,
    incomeTax,
    medicare,
    surcharge,
    studyLoan,
    totalTax,
    net: (taxable - totalTax) as Cents,
    employerSuper: (employerSuper + sacrifice) as Cents,
  };
}

/** Split a year's amounts into a pay period. Net is what's left, so each period adds up. */
export function perPeriod(a: PayAmounts, period: PayPeriod): PayAmounts {
  const n = PAY_PERIODS_PER_YEAR[period];
  const p = (c: Cents) => toC(c / n);
  const out = {
    gross: p(a.gross),
    salarySacrifice: p(a.salarySacrifice),
    incomeTax: p(a.incomeTax),
    medicare: p(a.medicare),
    surcharge: p(a.surcharge),
    studyLoan: p(a.studyLoan),
    employerSuper: p(a.employerSuper),
  };
  const taxableIncome = (out.gross - out.salarySacrifice) as Cents;
  const totalTax = (out.incomeTax + out.medicare + out.surcharge + out.studyLoan) as Cents;
  return { ...out, taxableIncome, totalTax, net: (taxableIncome - totalTax) as Cents };
}

export const MAX_SALARY = 10_000_000_00 as Cents; // $10m

export function validatePay(input: PayInput): string[] {
  const errors: string[] = [];
  const ok = (v: number) => Number.isFinite(v) && v >= 0;
  if (!ok(input.salary) || input.salary > MAX_SALARY)
    errors.push("Enter a salary between $0 and $10 million.");
  if (input.superRate !== undefined && (!ok(input.superRate) || input.superRate > 1))
    errors.push("Employer super should be between 0% and 100%.");
  if (input.salarySacrifice !== undefined && !ok(input.salarySacrifice))
    errors.push("Salary sacrifice can't be negative.");
  if (input.family) {
    if (!ok(input.family.partnerIncome)) errors.push("Partner income can't be negative.");
    if (
      !Number.isInteger(input.family.children) ||
      input.family.children < 0 ||
      input.family.children > 20
    )
      errors.push("Children should be a whole number from 0 to 20.");
  }
  return errors;
}

/** Take-home pay for a year, by pay period, with the rates that explain it. */
export function calculatePay(input: PayInput): PayResult {
  const errors = validatePay(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const { rules, carriedForward } = taxRulesForYear(input.year);
  const sup = superRulesForYear(input.year);
  const a = core(input, rules, sup);

  // Marginal rate from the next $100 of salary, so tapers and thresholds show.
  const step = 10_000;
  const next = core({ ...input, salary: (input.salary + step) as Cents }, rules, sup);
  const grossStep = next.gross - a.gross || step;
  const marginalRate = (next.totalTax - a.totalTax) / grossStep;

  const warnings: PayWarning[] = [];
  if ((input.salarySacrifice ?? 0) > a.gross) warnings.push({ kind: "sacrifice-too-big" });
  const concessional = a.employerSuper;
  if (concessional > sup.concessionalCap)
    warnings.push({ kind: "concessional-cap", total: concessional, cap: sup.concessionalCap });
  const div293Income = a.taxableIncome + concessional;
  if (div293Income > sup.division293Threshold) {
    const extra = toC(
      Math.min(concessional, div293Income - sup.division293Threshold) * sup.contributionsTax,
    );
    if (extra > 0) warnings.push({ kind: "division-293", extra });
  }

  const periods = {} as Record<PayPeriod, PayAmounts>;
  for (const p of Object.keys(PAY_PERIODS_PER_YEAR) as PayPeriod[]) periods[p] = perPeriod(a, p);
  const { taxBeforeOffsets, lito, ...amounts } = a;

  return {
    ...amounts,
    year: rules.year,
    carriedForward,
    taxBeforeOffsets,
    lito,
    marginalRate,
    averageRate: a.gross > 0 ? a.totalTax / a.gross : 0,
    periods,
    warnings,
    notes: rules.notes,
    rules,
    superRules: sup,
  };
}

/** How much of a pay rise (a year, before tax) ends up in the bank. */
export function keepFromRaise(input: PayInput, raise: Cents): Cents {
  const before = calculatePay(input).net;
  const after = calculatePay({ ...input, salary: (input.salary + raise) as Cents }).net;
  return (after - before) as Cents;
}
