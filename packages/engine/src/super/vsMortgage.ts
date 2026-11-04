import { addMonths, isIsoDate, monthsBetween } from "../dates";
import type { Cents } from "../money/cents";
import type { Frequency, LoanInput, SimulationResult } from "../mortgage/simulate";
import { simulateLoan, validateLoan } from "../mortgage/simulate";
import { calculatePay, type PayInput, validatePay } from "../tax/pay";
import { financialYear, PRESERVATION_AGE, rulesFor, type SuperRules } from "./rules";

/**
 * Super or mortgage: where should spare cash go?
 *
 * The household has the same take-home dollars to spare each month either way
 * and compares what that money is worth later:
 *
 * - **Mortgage**: the spare cash goes on the loan as extra repayments (an
 *   offset does the same to the interest). Once the loan is gone, the
 *   repayment it freed and the spare cash go into super instead, through the
 *   person whose sacrifice works best, until the original loan would have
 *   ended; from then on just the spare cash does.
 * - **Super, through one person**: that person salary sacrifices whatever
 *   costs the spare cash in take-home pay. It goes in before tax, loses 15%
 *   contributions tax (more with Division 293, less with the low income super
 *   tax offset), and grows at the super return. Past the concessional cap, the
 *   rest goes in after tax. The loan runs at its usual repayment.
 *
 * Each option's gain is measured against spending the money: loan paid off
 * sooner (a lower balance) plus extra super. Values are given in today's
 * dollars. Super can't be touched until the person meets a condition of
 * release (retired after 60, or 65), so the timeline also shows how much of
 * each option's gain you could reach.
 *
 * Simplifications, kept deliberately: tax is worked out on this year's pay
 * and rates for every year (bracket creep and pay rises are left out, which is
 * slightly kind to the mortgage), the super return is after fees and earnings
 * tax as funds report it, and the cap headroom is held at this year's.
 */

export interface SomPerson {
  id: string;
  name: string;
  age: number; // today
  retireAge: number;
  /** This year's pay, as for the pay calculator, including any sacrifice already made. */
  pay: Omit<PayInput, "year">;
}

export interface SomLoan {
  balance: Cents;
  annualRate: number;
  termMonths: number;
  frequency: Frequency;
  /** Pay this per period instead of the minimum. */
  repayment?: Cents;
  offsetBalance?: Cents;
}

export interface SuperOrMortgageInput {
  startDate: string; // YYYY-MM-DD, usually today
  people: SomPerson[];
  loan: SomLoan;
  /** Take-home pay to spare, a month. */
  spareMonthly: Cents;
  /** Super return a year, after fees and earnings tax, e.g. 0.07. */
  superReturn: number;
  inflation: number; // a year, e.g. 0.025
  /** Compare this many years from now. Default: until the first person retires. */
  years?: number;
}

/** What one person's sacrifice does with a year of take-home dollars. */
export interface SacrificeYear {
  takeHome: Cents; // a year, what it costs in take-home pay
  sacrifice: Cents; // a year, before tax, up to the cap
  afterTax: Cents; // a year, the part over the cap, put in after tax
  taxSaved: Cents; // a year: sacrifice less its take-home cost
  contributionsTax: Cents; // a year: 15%, plus Division 293, less the offset
  intoSuper: Cents; // a year, what lands in the fund
  capHeadroom: Cents; // concessional cap left before the sacrifice
}

export type OptionKind = "mortgage" | "super";

export interface SomRow {
  year: number; // 0 = today
  date: string;
  loanBalance: Cents; // nominal
  extraSuper: Cents; // nominal
  /** Gain over spending the money, in today's dollars. */
  gain: Cents;
  /** The part of `gain` you could get at that year (loan equity, plus super once released). */
  reachable: Cents;
}

export interface SomOption {
  kind: OptionKind;
  /** The person whose super it goes into. For "mortgage", where it goes after the loan is gone. */
  personId: string;
  label: string;
  /** Gain at the end of the comparison, in today's dollars. */
  gain: Cents;
  reachable: Cents;
  loanPaidOff: string; // date
  interest: Cents; // total interest on the loan
  extraSuper: Cents; // nominal, at the end
  /** The sacrifice that costs the spare cash, for "super" options. */
  sacrifice: SacrificeYear | null;
  rows: SomRow[];
}

export interface SuperOrMortgageResult {
  years: number;
  endDate: string;
  /** Sorted best first. */
  options: SomOption[];
  best: SomOption;
  mortgage: SomOption;
  /** Super return a year at which the best super option and the mortgage come out even. */
  breakEvenReturn: number | null;
  /** Interest saved by the extra repayments, and how much sooner the loan goes. */
  interestSaved: Cents;
  monthsSooner: number;
  baseLoan: Pick<SimulationResult, "payoffDate" | "totalInterest" | "repayment">;
  taxYear: string;
  warnings: SomWarning[];
}

export type SomWarning =
  | { kind: "over-cap"; personId: string; afterTax: Cents }
  | { kind: "division-293"; personId: string; extra: Cents }
  | { kind: "locked"; personId: string; releaseAge: number }
  | { kind: "rules-carried-forward"; year: string }
  | { kind: "loan"; message: string };

export const SOM_MAX_PEOPLE = 4;

export function validateSuperOrMortgage(input: SuperOrMortgageInput): string[] {
  const errors: string[] = [];
  if (!isIsoDate(input.startDate)) errors.push("start date must be YYYY-MM-DD");
  if (input.people.length < 1) errors.push("add at least one person");
  if (input.people.length > SOM_MAX_PEOPLE) errors.push(`at most ${SOM_MAX_PEOPLE} people`);
  if (!(Number.isInteger(input.spareMonthly) && input.spareMonthly >= 0))
    errors.push("spare cash can't be negative");
  if (!(input.superReturn >= -0.1 && input.superReturn <= 0.2))
    errors.push("super return must be -10% to 20%");
  if (!(input.inflation >= 0 && input.inflation <= 0.2)) errors.push("inflation must be 0–20%");
  if (input.years !== undefined && !(input.years >= 1 && input.years <= 60))
    errors.push("compare over 1 to 60 years");
  for (const p of input.people) {
    const who = p.name || "someone";
    if (!(p.age >= 15 && p.age <= 100)) errors.push(`${who}: age must be 15–100`);
    if (!(p.retireAge > p.age && p.retireAge <= 100))
      errors.push(`${who}: retirement age must be after their age`);
    for (const e of validatePay({ ...p.pay, year: financialYear(input.startDate) }))
      errors.push(`${who}: ${e}`);
  }
  errors.push(...validateLoan(loanInput(input, 0)));
  return errors;
}

const toC = (n: number) => Math.round(n) as Cents;

function loanInput(input: SuperOrMortgageInput, extraPerPeriod: number): LoanInput {
  const l = input.loan;
  return {
    balance: l.balance,
    annualRate: l.annualRate,
    termMonths: l.termMonths,
    startDate: input.startDate,
    frequency: l.frequency,
    repayment: l.repayment,
    offsetBalance: l.offsetBalance,
    extraPerPeriod: extraPerPeriod as Cents,
  };
}

const PER_YEAR: Record<Frequency, number> = { weekly: 52, fortnightly: 26, monthly: 12 };

/** Low income super tax offset: 15% of concessional contributions, up to $500, at $37,000 or less. */
function listo(adjustedTaxable: number, concessional: number): number {
  return adjustedTaxable <= 3_700_000 ? Math.min(50_000, concessional * 0.15) : 0;
}

/**
 * What it takes, through one person, to put a year of take-home dollars into
 * super: the sacrifice that costs that much take-home pay, up to the cap, and
 * after-tax money for the rest.
 */
export function sacrificeFor(
  pay: PayInput,
  takeHome: Cents,
  sup: SuperRules = rulesFor(`${pay.year.slice(0, 4)}-07-01`).rules,
): SacrificeYear {
  const already = pay.salarySacrifice ?? 0;
  const at = (extra: number) => calculatePay({ ...pay, salarySacrifice: toC(already + extra) });
  const base = at(0);
  const div293 = (r: ReturnType<typeof calculatePay>) =>
    r.warnings.reduce((s, w) => (w.kind === "division-293" ? s + w.extra : s), 0);
  const capHeadroom = Math.max(0, sup.concessionalCap - base.employerSuper);
  // Can't sacrifice more than the cash pay left after what's already packaged.
  const room = Math.max(0, base.gross - base.salarySacrifice - base.otherPackaging);
  const maxSacrifice = Math.min(capHeadroom, room);
  const cost = (s: number) => base.net - at(s).net;

  let sacrifice: number;
  if (takeHome <= 0 || maxSacrifice <= 0) sacrifice = 0;
  else if (cost(maxSacrifice) <= takeHome) sacrifice = maxSacrifice;
  else {
    // Take-home cost rises with the sacrifice, so bisect to the cent.
    let lo = 0;
    let hi = maxSacrifice;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (cost(mid) <= takeHome) lo = mid;
      else hi = mid;
    }
    sacrifice = lo;
  }
  const after = at(sacrifice);
  const spent = base.net - after.net;
  const afterTax = Math.max(0, takeHome - spent);
  const offset = (r: ReturnType<typeof calculatePay>) =>
    listo(r.taxableIncome + (pay.fringeBenefits ?? 0), r.employerSuper);
  const contributionsTax =
    sacrifice * sup.contributionsTax +
    (div293(after) - div293(base)) -
    (offset(after) - offset(base));
  return {
    takeHome,
    sacrifice: toC(sacrifice),
    afterTax: toC(afterTax),
    taxSaved: toC(sacrifice - spent),
    contributionsTax: toC(contributionsTax),
    intoSuper: toC(sacrifice - contributionsTax + afterTax),
    capHeadroom: toC(capHeadroom),
  };
}

/** Age a person can reach their super: retired after preservation age, or 65. */
export function releaseAge(p: Pick<SomPerson, "retireAge">): number {
  return Math.min(65, Math.max(PRESERVATION_AGE, p.retireAge));
}

interface Fixed {
  months: number;
  base: SimulationResult;
  extra: SimulationResult;
  baseOff: number; // month the loan is gone, without extra
  extraOff: number; // with extra
  repaymentMonthly: number; // the usual repayment, a month
  /** (person index, take-home a year) → what lands in super a year */
  into: (i: number, takeHome: number) => SacrificeYear;
}

function balanceAt(sim: SimulationResult, m: number): number {
  return m < sim.balances.length ? sim.balances[m].balance : 0;
}

function payoffMonth(start: string, sim: SimulationResult): number {
  const whole = monthsBetween(start, sim.payoffDate);
  return addMonths(start, whole) < sim.payoffDate ? whole + 1 : whole;
}

function runOption(
  input: SuperOrMortgageInput,
  f: Fixed,
  kind: OptionKind,
  personIndex: number,
  superReturn: number,
): SomOption {
  const p = input.people[personIndex];
  const g = (1 + superReturn) ** (1 / 12) - 1;
  const spareYear = input.spareMonthly * 12;
  const loan = kind === "mortgage" ? f.extra : f.base;
  const rows: SomRow[] = [];
  let extraSuper = 0;
  const deflate = (m: number, v: number) => v / (1 + input.inflation) ** (m / 12);
  const release = releaseAge(p);
  const row = (m: number) => {
    const equity = balanceAt(f.base, m) - balanceAt(loan, m);
    const free = p.age + m / 12 >= release;
    return {
      year: m / 12,
      date: addMonths(input.startDate, m),
      loanBalance: toC(balanceAt(loan, m)),
      extraSuper: toC(extraSuper),
      gain: toC(deflate(m, equity + extraSuper)),
      reachable: toC(deflate(m, equity + (free ? extraSuper : 0))),
    };
  };
  rows.push(row(0));
  for (let m = 1; m <= f.months; m++) {
    let takeHome = 0;
    if (kind === "super") takeHome = spareYear;
    else if (m > f.extraOff && m <= f.baseOff) takeHome = spareYear + f.repaymentMonthly * 12;
    else if (m > f.baseOff) takeHome = spareYear;
    const inflow = takeHome > 0 ? f.into(personIndex, takeHome).intoSuper / 12 : 0;
    extraSuper = extraSuper * (1 + g) + inflow;
    if (m % 12 === 0 || m === f.months) rows.push(row(m));
  }
  const last = rows[rows.length - 1];
  return {
    kind,
    personId: p.id,
    label:
      kind === "mortgage"
        ? "Extra mortgage repayments"
        : p.name
          ? `Into ${p.name}'s super`
          : "Into super",
    gain: last.gain,
    reachable: last.reachable,
    loanPaidOff: loan.payoffDate,
    interest: loan.totalInterest,
    extraSuper: last.extraSuper,
    sacrifice: kind === "super" ? f.into(personIndex, spareYear) : null,
    rows,
  };
}

export function compareSuperOrMortgage(input: SuperOrMortgageInput): SuperOrMortgageResult {
  const errors = validateSuperOrMortgage(input);
  if (errors.length) throw new RangeError(errors.join("; "));

  const taxYear = financialYear(input.startDate);
  const { rules: sup, carriedForward } = rulesFor(input.startDate);
  const first = input.people[0];
  const years = input.years ?? Math.max(1, Math.round(first.retireAge - first.age));
  const months = Math.round(years * 12);

  const ppy = PER_YEAR[input.loan.frequency];
  const extraPerPeriod = Math.round((input.spareMonthly * 12) / ppy);
  const base = simulateLoan(loanInput(input, 0));
  const extra = simulateLoan(loanInput(input, extraPerPeriod));

  const cache = new Map<string, SacrificeYear>();
  const into = (i: number, takeHome: number) => {
    const key = `${i}:${takeHome}`;
    let s = cache.get(key);
    if (!s) {
      s = sacrificeFor({ ...input.people[i].pay, year: taxYear }, toC(takeHome), sup);
      cache.set(key, s);
    }
    return s;
  };
  const f: Fixed = {
    months,
    base,
    extra,
    baseOff: payoffMonth(input.startDate, base),
    extraOff: payoffMonth(input.startDate, extra),
    repaymentMonthly: (base.repayment * ppy) / 12,
    into,
  };

  // After the loan's gone, the mortgage option feeds whoever gets the most into super.
  const spareYear = input.spareMonthly * 12;
  let bestPerson = 0;
  for (let i = 1; i < input.people.length; i++) {
    if (into(i, spareYear).intoSuper > into(bestPerson, spareYear).intoSuper) bestPerson = i;
  }

  const run = (r: number) => ({
    mortgage: runOption(input, f, "mortgage", bestPerson, r),
    supers: input.people.map((_, i) => runOption(input, f, "super", i, r)),
  });
  const { mortgage, supers } = run(input.superReturn);
  const options = [mortgage, ...supers].sort((a, b) => b.gain - a.gain);

  // Super return where the best super option and the mortgage are even.
  const gap = (r: number) => {
    const o = run(r);
    return Math.max(...o.supers.map((s) => s.gain)) - o.mortgage.gain;
  };
  let breakEvenReturn: number | null = null;
  let lo = -0.1;
  let hi = 0.2;
  if (spareYear > 0 && gap(lo) < 0 && gap(hi) > 0) {
    for (let k = 0; k < 40 && hi - lo > 1e-5; k++) {
      const mid = (lo + hi) / 2;
      if (gap(mid) < 0) lo = mid;
      else hi = mid;
    }
    breakEvenReturn = Math.round(((lo + hi) / 2) * 10_000) / 10_000;
  }

  const warnings: SomWarning[] = [];
  if (carriedForward) warnings.push({ kind: "rules-carried-forward", year: sup.year });
  input.people.forEach((p, i) => {
    const s = into(i, spareYear);
    if (s.afterTax > 0) warnings.push({ kind: "over-cap", personId: p.id, afterTax: s.afterTax });
    const r = calculatePay({
      ...p.pay,
      year: taxYear,
      salarySacrifice: toC((p.pay.salarySacrifice ?? 0) + s.sacrifice),
    });
    for (const w of r.warnings)
      if (w.kind === "division-293")
        warnings.push({ kind: "division-293", personId: p.id, extra: w.extra });
    if (p.age + years < releaseAge(p))
      warnings.push({ kind: "locked", personId: p.id, releaseAge: releaseAge(p) });
  });
  for (const message of new Set([...base.warnings, ...extra.warnings]))
    warnings.push({ kind: "loan", message });

  return {
    years,
    endDate: addMonths(input.startDate, months),
    options,
    best: options[0],
    mortgage,
    breakEvenReturn,
    interestSaved: toC(base.totalInterest - extra.totalInterest),
    monthsSooner: Math.max(0, f.baseOff - f.extraOff),
    baseLoan: {
      payoffDate: base.payoffDate,
      totalInterest: base.totalInterest,
      repayment: base.repayment,
    },
    taxYear,
    warnings,
  };
}
