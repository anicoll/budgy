import { addMonths, isIsoDate } from "../dates";
import type { Cents } from "../money/cents";
import { financialYear, rulesFor } from "./rules";

/**
 * Super at retirement, for a household.
 *
 * Each person has an age, a retirement age, a salary and one or more super
 * accounts. Month by month until they retire:
 *
 * - their employer pays the super guarantee (or a higher rate) on salary, up to
 *   the year's maximum contribution base, into the account marked to receive it;
 * - salary sacrifice and after-tax contributions go into each account as set;
 * - concessional contributions (employer + salary sacrifice) lose 15%
 *   contributions tax on the way in;
 * - each account grows at its return (entered after investment fees and tax,
 *   the way funds report it), less its admin fees (dollars a year plus a
 *   percentage of the balance).
 *
 * Salary grows by wage growth each year. Rules (SG rate, caps, contribution
 * base) follow the financial year of each month, from `rules.ts`.
 *
 * At retirement, the balance is turned into an income in today's dollars: the
 * most you could draw each year, rising with inflation, so it runs out at
 * `incomeUntilAge`. Earnings keep coming at the same return less the
 * percentage fee. Age Pension is not included.
 */

export interface SuperAccount {
  id: string;
  name: string;
  balance: Cents;
  returnPct: number; // a year, after investment fees and tax, e.g. 0.07
  adminFeeFixed: Cents; // a year
  adminFeePct: number; // a year, of the balance, e.g. 0.001
  salarySacrifice: Cents; // a year, before tax (concessional)
  afterTax: Cents; // a year (non-concessional)
  receivesEmployer: boolean;
}

export interface SuperPerson {
  id: string;
  name: string;
  age: number; // today, whole or fractional years
  retireAge: number;
  salary: Cents; // a year, before tax
  /** Employer rate if above the super guarantee, e.g. 0.15. Blank = the SG rate each year. */
  employerRate?: number;
  accounts: SuperAccount[];
}

export interface SuperInput {
  people: SuperPerson[];
  startDate: string; // YYYY-MM-DD, usually today
  wageGrowth: number; // a year, e.g. 0.035
  inflation: number; // a year, e.g. 0.025
  incomeUntilAge: number; // e.g. 90
}

export interface SuperYear {
  year: number; // 0 = today
  date: string;
  age: number;
  balances: Cents[]; // per account, nominal
  total: Cents; // nominal
  real: Cents; // in today's dollars
}

export interface PersonProjection {
  id: string;
  name: string;
  retireDate: string;
  yearsToRetire: number;
  atRetirement: Cents; // nominal
  atRetirementReal: Cents; // today's dollars
  /** Income a year in retirement, in today's dollars, lasting to incomeUntilAge. */
  incomePerYear: Cents;
  employerTotal: Cents; // nominal, before contributions tax
  personalTotal: Cents; // salary sacrifice + after-tax, nominal
  contributionsTax: Cents;
  fees: Cents;
  earnings: Cents;
  years: SuperYear[];
  warnings: string[];
}

export interface SuperResult {
  people: PersonProjection[];
  householdAtRetirementReal: Cents;
  householdIncomePerYear: Cents;
  /** True when some months use the latest known year's rules for a later year. */
  rulesCarriedForward: boolean;
  rulesYears: string[]; // financial years whose rules were used, in order
}

export const MAX_PEOPLE = 4;
export const MAX_ACCOUNTS = 4;

export function validateSuper(input: SuperInput): string[] {
  const errors: string[] = [];
  if (!isIsoDate(input.startDate)) errors.push("start date must be YYYY-MM-DD");
  if (input.people.length < 1) errors.push("add at least one person");
  if (input.people.length > MAX_PEOPLE) errors.push(`at most ${MAX_PEOPLE} people`);
  if (!(input.inflation >= 0 && input.inflation <= 0.2)) errors.push("inflation must be 0–20%");
  if (!(input.wageGrowth >= 0 && input.wageGrowth <= 0.2)) errors.push("wage growth must be 0–20%");
  if (!(input.incomeUntilAge > 0 && input.incomeUntilAge <= 110))
    errors.push("income-until age must be up to 110");
  const cents = (n: number) => Number.isInteger(n) && n >= 0;
  for (const p of input.people) {
    const who = p.name || "someone";
    if (!(p.age >= 15 && p.age <= 100)) errors.push(`${who}: age must be 15–100`);
    if (!(p.retireAge >= 15 && p.retireAge <= 100))
      errors.push(`${who}: retirement age must be 15–100`);
    if (!(p.retireAge < input.incomeUntilAge))
      errors.push(`${who}: retirement age must be before the income-until age`);
    if (!cents(p.salary)) errors.push(`${who}: salary can't be negative`);
    if (p.employerRate !== undefined && !(p.employerRate >= 0 && p.employerRate <= 0.5))
      errors.push(`${who}: employer rate must be 0–50%`);
    if (p.accounts.length < 1) errors.push(`${who}: add a super account`);
    if (p.accounts.length > MAX_ACCOUNTS) errors.push(`${who}: at most ${MAX_ACCOUNTS} accounts`);
    for (const a of p.accounts) {
      const acc = `${who}, ${a.name || "account"}`;
      if (![a.balance, a.adminFeeFixed, a.salarySacrifice, a.afterTax].every(cents))
        errors.push(`${acc}: amounts can't be negative`);
      if (!(a.returnPct >= -0.2 && a.returnPct <= 0.2)) errors.push(`${acc}: return must be ±20%`);
      if (!(a.adminFeePct >= 0 && a.adminFeePct <= 0.05)) errors.push(`${acc}: fee must be 0–5%`);
    }
  }
  return errors;
}

/**
 * Most income a year (today's dollars) a balance can pay, rising with
 * inflation, so it runs out after `years`.
 */
export function retirementIncome(
  realBalance: number,
  annualReturn: number,
  inflation: number,
  years: number,
): Cents {
  if (realBalance <= 0 || years <= 0) return 0 as Cents;
  const n = Math.round(years * 12);
  const g = ((1 + annualReturn) / (1 + inflation)) ** (1 / 12) - 1;
  const monthly = Math.abs(g) < 1e-12 ? realBalance / n : (realBalance * g) / (1 - (1 + g) ** -n);
  return Math.round(monthly * 12) as Cents;
}

function projectPerson(p: SuperPerson, input: SuperInput, used: Set<string>) {
  const months = Math.max(0, Math.round((p.retireAge - p.age) * 12));
  const monthlyGrowth = p.accounts.map((a) => (1 + a.returnPct) ** (1 / 12) - 1);
  const bal = p.accounts.map((a) => a.balance as number);
  let sgIndex = p.accounts.findIndex((a) => a.receivesEmployer);
  if (sgIndex < 0) sgIndex = 0;

  let employerTotal = 0;
  let personalTotal = 0;
  let taxTotal = 0;
  let feeTotal = 0;
  let carried = false;
  const warnings = new Set<string>();

  let fy = "";
  let fyEarned = 0;
  let fyConcessional = 0;
  let fyNonConcessional = 0;

  const realAt = (m: number, nominal: number) => nominal / (1 + input.inflation) ** (m / 12);
  const total = () => bal.reduce((s, b) => s + b, 0);
  const years: SuperYear[] = [
    {
      year: 0,
      date: input.startDate,
      age: p.age,
      balances: bal.map(Math.round) as Cents[],
      total: Math.round(total()) as Cents,
      real: Math.round(total()) as Cents,
    },
  ];

  for (let m = 1; m <= months; m++) {
    const date = addMonths(input.startDate, m);
    // Rules follow the month the salary is earned in, which starts a month earlier.
    const earned = addMonths(input.startDate, m - 1);
    const { rules, carriedForward } = rulesFor(earned);
    carried ||= carriedForward;
    used.add(rules.year);
    const thisFy = financialYear(earned);
    if (thisFy !== fy) {
      fy = thisFy;
      fyEarned = 0;
      fyConcessional = 0;
      fyNonConcessional = 0;
    }

    // Caps and the contribution base are indexed to wages, so years past the
    // last published ones grow with wage growth instead of standing still.
    const ahead = Math.max(0, Number(thisFy.slice(0, 4)) - Number(rules.year.slice(0, 4)));
    const index = (1 + input.wageGrowth) ** ahead;
    const ccCap = rules.concessionalCap * index;
    const nccCap = rules.nonConcessionalCap * index;
    const capLabel = (cap: number) =>
      `${ahead ? "about " : ""}$${Math.round(cap / 100).toLocaleString("en-AU")} in ${thisFy}`;

    const salary = (p.salary * (1 + input.wageGrowth) ** Math.floor((m - 1) / 12)) / 12;
    const base = Math.max(0, Math.min(salary, rules.maxContributionBase * index - fyEarned));
    fyEarned += salary;
    const rate = p.employerRate ?? rules.sgRate;
    const employer = base * rate;
    employerTotal += employer;
    const sacrifice = p.accounts.reduce((t, a) => t + a.salarySacrifice / 12, 0);
    // Only checked this year: the threshold isn't indexed, so far-off wage growth would always trip it.
    if (m <= 12 && (salary + employer + sacrifice) * 12 > rules.division293Threshold) {
      warnings.add(
        "Income plus concessional contributions is over $250,000, so Division 293 tax (another 15%) may apply. It isn't included here.",
      );
    }

    for (let i = 0; i < bal.length; i++) {
      const a = p.accounts[i];
      const concessional = (i === sgIndex ? employer : 0) + a.salarySacrifice / 12;
      const nonConcessional = a.afterTax / 12;
      const tax = concessional * rules.contributionsTax;
      const fee = a.adminFeeFixed / 12 + (bal[i] * a.adminFeePct) / 12;
      fyConcessional += concessional;
      fyNonConcessional += nonConcessional;
      personalTotal += a.salarySacrifice / 12 + nonConcessional;
      taxTotal += tax;
      feeTotal += fee;
      bal[i] = Math.max(
        0,
        bal[i] * (1 + monthlyGrowth[i]) + concessional - tax + nonConcessional - fee,
      );
    }
    if (fyConcessional > ccCap + 0.5 && !warnings.has("cc")) {
      warnings.add("cc");
      warnings.add(
        `Concessional contributions go over the cap (${capLabel(ccCap)}). Extra tax applies to the excess, which isn't included here.`,
      );
    }
    if (fyNonConcessional > nccCap + 0.5 && !warnings.has("ncc")) {
      warnings.add("ncc");
      warnings.add(`After-tax contributions go over the cap (${capLabel(nccCap)}).`);
    }

    if (m % 12 === 0 || m === months) {
      years.push({
        year: years.length,
        date,
        age: p.age + m / 12,
        balances: bal.map(Math.round) as Cents[],
        total: Math.round(total()) as Cents,
        real: Math.round(realAt(m, total())) as Cents,
      });
    }
  }

  const atRetirement = Math.round(total());
  const atRetirementReal = Math.round(realAt(months, atRetirement));
  // Retirement return: balance-weighted across accounts, less the % fee.
  const weights = atRetirement > 0 ? bal.map((b) => b / total()) : bal.map(() => 1 / bal.length);
  const netReturn = p.accounts.reduce(
    (s, a, i) => s + weights[i] * (a.returnPct - a.adminFeePct),
    0,
  );
  const incomePerYear = retirementIncome(
    atRetirementReal,
    netReturn,
    input.inflation,
    input.incomeUntilAge - Math.max(p.age, p.retireAge),
  );
  const contributed = p.accounts.reduce((s, a) => s + a.balance, 0) + employerTotal + personalTotal;

  return {
    id: p.id,
    name: p.name,
    retireDate: addMonths(input.startDate, months),
    yearsToRetire: months / 12,
    atRetirement: atRetirement as Cents,
    atRetirementReal: atRetirementReal as Cents,
    incomePerYear,
    employerTotal: Math.round(employerTotal) as Cents,
    personalTotal: Math.round(personalTotal) as Cents,
    contributionsTax: Math.round(taxTotal) as Cents,
    fees: Math.round(feeTotal) as Cents,
    earnings: Math.round(atRetirement - contributed + taxTotal + feeTotal) as Cents,
    years,
    warnings: [...warnings].filter((w) => w !== "cc" && w !== "ncc"),
    carried,
  };
}

export function projectSuper(input: SuperInput): SuperResult {
  const errors = validateSuper(input);
  if (errors.length) throw new RangeError(errors.join("; "));
  const used = new Set<string>();
  const runs = input.people.map((p) => projectPerson(p, input, used));
  return {
    people: runs.map(({ carried: _, ...r }) => r),
    householdAtRetirementReal: runs.reduce((s, r) => s + r.atRetirementReal, 0) as Cents,
    householdIncomePerYear: runs.reduce((s, r) => s + r.incomePerYear, 0) as Cents,
    rulesCarriedForward: runs.some((r) => r.carried),
    rulesYears: [...used].sort(),
  };
}

/**
 * What adding `perYear` of salary sacrifice to one person's first account does,
 * in today's dollars at retirement and income a year.
 */
export function extraContributionEffect(
  input: SuperInput,
  personId: string,
  perYear: Cents,
): { atRetirementReal: Cents; incomePerYear: Cents } {
  const before = projectSuper(input).people.find((p) => p.id === personId);
  const people = input.people.map((p) =>
    p.id !== personId
      ? p
      : {
          ...p,
          accounts: p.accounts.map((a, i) =>
            i === 0 ? { ...a, salarySacrifice: (a.salarySacrifice + perYear) as Cents } : a,
          ),
        },
  );
  const after = projectSuper({ ...input, people }).people.find((p) => p.id === personId);
  if (!before || !after) return { atRetirementReal: 0 as Cents, incomePerYear: 0 as Cents };
  return {
    atRetirementReal: (after.atRetirementReal - before.atRetirementReal) as Cents,
    incomePerYear: (after.incomePerYear - before.incomePerYear) as Cents,
  };
}
