import type { Cents } from "../money/cents";
import { SUPER_RULES, type SuperRules } from "../super/rules";
import { type Bracket, type TaxRules, taxRulesForYear } from "./rules";
import {
  type WithholdingFrequency,
  type WithholdingScale,
  type WithholdingTables,
  whmWithholding,
  withholdForPay,
  withholdingTablesFor,
} from "./withholding";

/**
 * Take-home pay for one person for a financial year. The tax is what the ATO
 * would assess at tax time; `withholding` is what each pay slip takes out,
 * from the ATO's tables, and the gap between them is the refund or bill.
 */

export type PayPeriod = "annual" | "monthly" | "fortnightly" | "weekly";
export const PAY_PERIODS_PER_YEAR: Record<PayPeriod, number> = {
  annual: 1,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

export type Residency = "resident" | "foreign" | "whm";
export type MedicareExemption = "none" | "half" | "full";

export interface PayInput {
  year: string; // "2026-27"
  /** Base salary a year, before tax. Excludes employer super unless `includesSuper`. */
  salary: Cents;
  /** The salary is a package that includes the employer's super. */
  includesSuper?: boolean;
  /** Employer super rate. Leave out for the super guarantee. */
  superRate?: number;
  /** Overtime a year. Taxed, but no super guarantee on it. */
  overtime?: Cents;
  /** Bonuses and commissions a year. Taxed, and super is paid on them. */
  bonus?: Cents;
  /** Taxable allowances and other pay a year, without super. */
  allowances?: Cents;
  /** Salary sacrificed into super a year, before tax. */
  salarySacrifice?: Cents;
  /** Other pre-tax packaging a year, such as a novated lease or a laptop. */
  otherPackaging?: Cents;
  /** Reportable fringe benefits on the income statement (grossed-up amount). */
  fringeBenefits?: Cents;
  /** Deductions claimed at tax time, such as work expenses. */
  deductions?: Cents;
  /**
   * Taken out of pay after tax a year, such as the employee contribution
   * towards a novated lease. Doesn't change the tax, only what lands in the bank.
   */
  afterTax?: Cents;
  residency?: Residency;
  /** Claimed on the tax file number declaration. Only changes withholding. Default true. */
  taxFreeThreshold?: boolean;
  medicareExemption?: MedicareExemption;
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
  /** Everything paid before tax: salary, overtime, bonuses and allowances. */
  gross: Cents;
  salarySacrifice: Cents;
  otherPackaging: Cents;
  incomeTax: Cents; // after the low income tax offset
  medicare: Cents;
  surcharge: Cents; // Medicare levy surcharge
  studyLoan: Cents;
  /** Everything taken out: tax, levies and study loan repayments. */
  totalTax: Cents;
  /** Taken out after tax, such as a novated lease's employee contribution. */
  afterTax: Cents;
  /** Take-home pay: gross less packaging, `totalTax` and `afterTax`. */
  net: Cents;
  employerSuper: Cents;
}

/** What one pay slip shows, at a pay frequency. */
export interface PaySlip {
  frequency: WithholdingFrequency;
  gross: Cents;
  packaging: Cents; // salary sacrifice and other packaging
  tax: Cents; // withheld, including the Medicare levy
  studyLoan: Cents; // withheld
  afterTax: Cents; // taken out after tax, such as a lease contribution
  net: Cents;
  /** Withheld over the year (pays × amounts above). */
  yearWithheld: Cents;
  /** Positive: a refund at tax time. Negative: a bill. */
  atTaxTime: Cents;
}

export type PayWarning =
  | { kind: "concessional-cap"; total: Cents; cap: Cents }
  | { kind: "division-293"; extra: Cents }
  | { kind: "packaging-too-big" }
  | { kind: "deductions-too-big" };

export interface PayResult extends PayAmounts {
  year: string;
  /** The year asked for wasn't listed, so these are the nearest year's rules. */
  carriedForward: boolean;
  salary: Cents; // base salary, after splitting out super from a package
  overtime: Cents;
  bonus: Cents;
  allowances: Cents;
  deductions: Cents;
  taxableIncome: Cents;
  /** Income for the surcharge and study loan tests (adds back salary sacrifice and fringe benefits). */
  repaymentIncome: Cents;
  taxBeforeOffsets: Cents;
  lito: Cents;
  /** Of the next dollar of salary, how much goes in tax, levies and loan. */
  marginalRate: number;
  /** Of the gross, how much goes in tax, levies and loan. */
  averageRate: number;
  periods: Record<PayPeriod, PayAmounts>;
  /** Pay slips from the ATO's withholding tables, if they're out for this year. */
  withholding: Record<WithholdingFrequency, PaySlip> | null;
  warnings: PayWarning[];
  notes: string[];
  rules: TaxRules;
  superRules: SuperRules;
}

const toC = (n: number) => Math.round(n) as Cents;
const ZERO = 0 as Cents;

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
  if (taxable <= r.lowSingle) return ZERO;
  let levy = Math.min(taxable * r.rate, (taxable - r.lowSingle) * r.shadeIn);
  if (family) {
    // A family shades in on family income, and each partner pays their share.
    const low = r.lowFamily + r.perChild * family.children;
    const familyIncome = taxable + family.partnerIncome;
    if (familyIncome <= low) return ZERO;
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
  if (repaymentIncome <= r.nil) return ZERO;
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
  salary: Cents;
  overtime: Cents;
  bonus: Cents;
  allowances: Cents;
  deductions: Cents;
  taxableIncome: Cents;
  repaymentIncome: Cents;
  taxBeforeOffsets: Cents;
  lito: Cents;
}

const amt = (v: Cents | undefined) => (v ?? 0) as Cents;

function core(input: PayInput, rules: TaxRules, sup: SuperRules): Core {
  const rate = input.superRate ?? sup.sgRate;
  const { salary } = splitPackage(
    input.salary,
    Boolean(input.includesSuper),
    rate,
    sup.maxContributionBase,
  );
  const overtime = amt(input.overtime);
  const bonus = amt(input.bonus);
  const allowances = amt(input.allowances);
  const gross = (salary + overtime + bonus + allowances) as Cents;

  // Super is paid on ordinary time earnings (salary and bonuses, not
  // overtime), up to the maximum contribution base, before any sacrifice.
  const ote = salary + bonus;
  const employerBase = toC(Math.min(ote, sup.maxContributionBase) * rate);

  const sacrifice = Math.min(amt(input.salarySacrifice), gross) as Cents;
  const packaging = Math.min(amt(input.otherPackaging), gross - sacrifice) as Cents;
  const cash = gross - sacrifice - packaging;
  const deductions = Math.max(0, Math.min(amt(input.deductions), cash)) as Cents;
  const taxable = (cash - deductions) as Cents;

  const residency = input.residency ?? "resident";
  const resident = residency === "resident";
  const exemption = resident ? (input.medicareExemption ?? "none") : "full";
  const brackets =
    residency === "foreign" ? rules.foreign : residency === "whm" ? rules.whm : rules.resident;

  const taxBeforeOffsets = bracketTax(taxable, brackets);
  const lito = resident ? lowIncomeOffset(taxable, rules.lito) : ZERO;
  const incomeTax = Math.max(0, taxBeforeOffsets - lito) as Cents;
  const fullLevy = medicareLevy(taxable, rules.medicare, input.family);
  const medicare =
    exemption === "full" ? ZERO : exemption === "half" ? toC(fullLevy / 2) : fullLevy;

  // Salary sacrifice is a reportable super contribution, and fringe benefits
  // are reportable too: both count for the surcharge and study loan tests.
  const fringe = amt(input.fringeBenefits);
  const repaymentIncome = (taxable + sacrifice + fringe) as Cents;
  const surcharge =
    exemption === "full" || input.hospitalCover !== false
      ? ZERO
      : toC((taxable + fringe) * surchargeRate(repaymentIncome, rules.mls, input.family));
  const studyLoan = input.studyLoan ? studyLoanRepayment(repaymentIncome, rules.help) : ZERO;

  const totalTax = (incomeTax + medicare + surcharge + studyLoan) as Cents;
  const afterTax = Math.min(amt(input.afterTax), Math.max(0, cash - totalTax)) as Cents;
  return {
    salary,
    overtime,
    bonus,
    allowances,
    deductions,
    gross,
    salarySacrifice: sacrifice,
    otherPackaging: packaging,
    taxableIncome: taxable,
    repaymentIncome,
    taxBeforeOffsets,
    lito: Math.min(lito, taxBeforeOffsets) as Cents,
    incomeTax,
    medicare,
    surcharge,
    studyLoan,
    totalTax,
    afterTax,
    net: (cash - totalTax - afterTax) as Cents,
    employerSuper: (employerBase + sacrifice) as Cents,
  };
}

/** Split a year's amounts into a pay period. Net is what's left, so each period adds up. */
export function perPeriod(a: PayAmounts, period: PayPeriod): PayAmounts {
  const n = PAY_PERIODS_PER_YEAR[period];
  const p = (c: Cents) => toC(c / n);
  const out = {
    gross: p(a.gross),
    salarySacrifice: p(a.salarySacrifice),
    otherPackaging: p(a.otherPackaging),
    incomeTax: p(a.incomeTax),
    medicare: p(a.medicare),
    surcharge: p(a.surcharge),
    studyLoan: p(a.studyLoan),
    afterTax: p(a.afterTax),
    employerSuper: p(a.employerSuper),
  };
  const totalTax = (out.incomeTax + out.medicare + out.surcharge + out.studyLoan) as Cents;
  const net = (out.gross -
    out.salarySacrifice -
    out.otherPackaging -
    totalTax -
    out.afterTax) as Cents;
  return { ...out, totalTax, net };
}

function scaleFor(input: PayInput): WithholdingScale {
  const residency = input.residency ?? "resident";
  if (residency === "foreign") return "foreign";
  if (input.taxFreeThreshold === false) return "noThreshold";
  if (input.medicareExemption === "full") return "fullExemption";
  if (input.medicareExemption === "half") return "halfExemption";
  return "threshold";
}

/** Pay slips at each frequency, with pay spread evenly over the year. */
function paySlips(
  input: PayInput,
  a: Core,
  tables: WithholdingTables,
): Record<WithholdingFrequency, PaySlip> {
  const scale = scaleFor(input);
  const out = {} as Record<WithholdingFrequency, PaySlip>;
  for (const frequency of ["weekly", "fortnightly", "monthly"] as const) {
    const n = PAY_PERIODS_PER_YEAR[frequency];
    const gross = toC(a.gross / n);
    const packaging = toC((a.salarySacrifice + a.otherPackaging) / n);
    const earnings = (gross - packaging) as Cents;
    const tax =
      input.residency === "whm"
        ? whmWithholding((a.gross - a.salarySacrifice - a.otherPackaging) as Cents, n, tables.whm)
        : withholdForPay(earnings, frequency, tables[scale]);
    const loanRows =
      input.taxFreeThreshold === false ? tables.loanNoThreshold : tables.loanThreshold;
    const studyLoan = input.studyLoan ? withholdForPay(earnings, frequency, loanRows) : ZERO;
    const yearWithheld = ((tax + studyLoan) * n) as Cents;
    const afterTax = toC(a.afterTax / n);
    out[frequency] = {
      frequency,
      gross,
      packaging,
      tax,
      studyLoan,
      afterTax,
      net: (earnings - tax - studyLoan - afterTax) as Cents,
      yearWithheld,
      atTaxTime: (yearWithheld - a.totalTax) as Cents,
    };
  }
  return out;
}

export const MAX_SALARY = 10_000_000_00 as Cents; // $10m

export function validatePay(input: PayInput): string[] {
  const errors: string[] = [];
  const ok = (v: number) => Number.isFinite(v) && v >= 0;
  if (!ok(input.salary) || input.salary > MAX_SALARY)
    errors.push("Enter a salary between $0 and $10 million.");
  if (input.superRate !== undefined && (!ok(input.superRate) || input.superRate > 1))
    errors.push("Employer super should be between 0% and 100%.");
  const amounts: [keyof PayInput, string][] = [
    ["overtime", "Overtime"],
    ["bonus", "Bonuses"],
    ["allowances", "Allowances"],
    ["salarySacrifice", "Salary sacrifice"],
    ["otherPackaging", "Other packaging"],
    ["fringeBenefits", "Fringe benefits"],
    ["deductions", "Deductions"],
    ["afterTax", "After-tax deductions"],
  ];
  for (const [key, label] of amounts) {
    const v = input[key];
    if (v !== undefined && (typeof v !== "number" || !ok(v) || v > MAX_SALARY))
      errors.push(`${label} should be between $0 and $10 million.`);
  }
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
  const asked = amt(input.salarySacrifice) + amt(input.otherPackaging);
  if (asked > a.salarySacrifice + a.otherPackaging) warnings.push({ kind: "packaging-too-big" });
  if (amt(input.deductions) > a.deductions) warnings.push({ kind: "deductions-too-big" });
  const concessional = a.employerSuper;
  if (concessional > sup.concessionalCap)
    warnings.push({ kind: "concessional-cap", total: concessional, cap: sup.concessionalCap });
  const div293Income = a.taxableIncome + amt(input.fringeBenefits) + concessional;
  if (div293Income > sup.division293Threshold) {
    const extra = toC(
      Math.min(concessional, div293Income - sup.division293Threshold) * sup.contributionsTax,
    );
    if (extra > 0) warnings.push({ kind: "division-293", extra });
  }

  const periods = {} as Record<PayPeriod, PayAmounts>;
  for (const p of Object.keys(PAY_PERIODS_PER_YEAR) as PayPeriod[]) periods[p] = perPeriod(a, p);
  const tables = carriedForward ? undefined : withholdingTablesFor(rules.year);

  return {
    ...a,
    year: rules.year,
    carriedForward,
    marginalRate,
    averageRate: a.gross > 0 ? a.totalTax / a.gross : 0,
    periods,
    withholding: tables ? paySlips(input, a, tables) : null,
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
