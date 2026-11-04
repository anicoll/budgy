import type { Cents } from "../money/cents";
import { calculatePay, type PayInput, type PayResult } from "../tax/pay";
import { taxRulesForYear } from "../tax/rules";
import { SUPER_RULES, type SuperRules } from "./rules";

/**
 * Salary sacrifice check, for a household.
 *
 * Each person has their pay and up to four super funds. Each fund can already
 * get salary sacrifice and personal deductible contributions, and the check
 * adds an `extra` sacrifice on top. For each person it compares the year with
 * and without the extra:
 *
 * - take-home cost: how much less pay lands in the bank (from the pay engine,
 *   so tax, Medicare, the surcharge and study loans all move);
 * - into super: the extra, less 15% contributions tax, less any Division 293
 *   tax it attracts, plus any change in the low income super tax offset;
 * - cap headroom: the concessional cap (plus carried-forward unused cap if
 *   the total super balance is under $500,000) less employer super, salary
 *   sacrifice and personal deductible contributions.
 *
 * It also suggests amounts: filling the cap, stopping at the edge of a tax
 * bracket, and splitting a household budget across people so each dollar of
 * take-home buys the most super.
 */

export interface SacrificeFund {
  id: string;
  name: string;
  balance: Cents; // for the $500,000 carry-forward test
  salarySacrifice: Cents; // a year, already in place
  personalDeductible: Cents; // a year, claimed at tax time
  extra: Cents; // a year, the new sacrifice being checked
}

export interface SacrificePerson {
  id: string;
  name: string;
  /** Their pay, as the pay calculator takes it. Salary sacrifice comes from the funds. */
  pay: Omit<PayInput, "year" | "salarySacrifice">;
  funds: SacrificeFund[];
  /** Unused concessional cap from the last five years, from myGov. */
  unusedCaps?: Cents;
}

export interface SacrificeInput {
  year: string; // "2026-27"
  people: SacrificePerson[];
  /** Take-home pay the household would give up a year, to split across people. */
  householdBudget?: Cents;
}

/** Low income super tax offset: contributions tax refunded for low earners. */
export interface ListoRules {
  rate: number; // of concessional contributions
  max: Cents;
  /** Adjusted taxable income above this gets nothing. */
  incomeLimit: Cents;
  source: string;
}

const ATO_LISTO =
  "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/how-to-save-more-in-your-super/government-super-contributions/low-income-super-tax-offset";
const ATO_CARRY =
  "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions/concessional-contributions-cap";

export const LISTO: ListoRules = {
  rate: 0.15,
  max: 50_000 as Cents,
  incomeLimit: 3_700_000 as Cents,
  source: ATO_LISTO,
};

/** Unused cap can only be carried forward with a total super balance under this. */
export const CARRY_FORWARD_BALANCE_LIMIT = 50_000_000 as Cents;
export const CARRY_FORWARD_SOURCE = ATO_CARRY;

export const MAX_SACRIFICE_PEOPLE = 4;
export const MAX_SACRIFICE_FUNDS = 4;

/** One person's year at a given total salary sacrifice. */
export interface SacrificePosition {
  salarySacrifice: Cents; // total, a year
  pay: PayResult;
  concessional: Cents; // employer + sacrifice + personal deductible
  contributionsTax: Cents; // 15% of concessional
  division293: Cents;
  listo: Cents;
  /** Concessional contributions less contributions tax, Division 293 and plus LISTO. */
  intoSuper: Cents;
  /** Cap plus usable carry-forward, less concessional. Negative when over. */
  headroom: Cents;
}

export interface SacrificeEffect {
  extra: Cents;
  before: SacrificePosition;
  after: SacrificePosition;
  /** Less take-home pay a year. */
  takeHomeCost: Cents;
  /** Tax, levies and study loan saved a year. */
  taxSaved: Cents;
  contributionsTax: Cents; // on the extra
  division293: Cents; // extra Division 293 tax because of the extra
  listoChange: Cents; // negative when the extra loses some or all of the offset
  /** More in super a year, after tax inside the fund. */
  intoSuper: Cents;
  /** Super gained less take-home given up. Positive means ahead overall. */
  netGain: Cents;
  /** Super gained for each dollar of take-home, e.g. 1.35. */
  superPerDollar: number;
}

export type SacrificeWarning =
  | { kind: "over-cap"; over: Cents }
  | { kind: "uses-carry-forward"; amount: Cents }
  | { kind: "carry-forward-blocked"; balance: Cents }
  | { kind: "not-worth-it"; netGain: Cents }
  | { kind: "loses-listo"; amount: Cents }
  | { kind: "division-293"; amount: Cents }
  | { kind: "too-big" };

export interface SacrificeSuggestion {
  kind: "fill-cap" | "bracket-edge";
  extra: Cents; // on top of current sacrifice, a year
  effect: SacrificeEffect;
  /** For "bracket-edge": the taxable income it brings you down to. */
  taxableIncome?: Cents;
  /** For "bracket-edge": the marginal tax rate saved on each dollar before the edge. */
  rateAbove?: number;
}

export interface PersonSacrifice {
  id: string;
  name: string;
  effect: SacrificeEffect;
  cap: Cents; // this year's concessional cap
  carryForward: Cents; // usable this year
  totalBalance: Cents;
  suggestions: SacrificeSuggestion[];
  warnings: SacrificeWarning[];
}

export interface HouseholdShare {
  id: string;
  extra: Cents;
  takeHomeCost: Cents;
  intoSuper: Cents;
}

export interface SacrificeResult {
  year: string;
  rulesCarriedForward: boolean;
  people: PersonSacrifice[];
  total: {
    extra: Cents;
    takeHomeCost: Cents;
    taxSaved: Cents;
    intoSuper: Cents;
    netGain: Cents;
  };
  /** The household budget split to put the most into super, if a budget was given. */
  budgetSplit: HouseholdShare[] | null;
  superRules: SuperRules;
  sources: string[];
}

const toC = (n: number) => Math.round(n) as Cents;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

function superRulesForYear(fy: string): SuperRules {
  return (
    SUPER_RULES.find((r) => r.year === fy) ??
    (fy < SUPER_RULES[0].year ? SUPER_RULES[0] : SUPER_RULES[SUPER_RULES.length - 1])
  );
}

export function validateSacrifice(input: SacrificeInput): string[] {
  const errors: string[] = [];
  const ok = (v: number | undefined) => v === undefined || (Number.isInteger(v) && v >= 0);
  if (input.people.length < 1) errors.push("Add at least one person.");
  if (input.people.length > MAX_SACRIFICE_PEOPLE)
    errors.push(`At most ${MAX_SACRIFICE_PEOPLE} people.`);
  if (!ok(input.householdBudget)) errors.push("The household budget can't be negative.");
  for (const p of input.people) {
    const who = p.name || "Someone";
    if (p.funds.length < 1) errors.push(`${who}: add a super fund.`);
    if (p.funds.length > MAX_SACRIFICE_FUNDS)
      errors.push(`${who}: at most ${MAX_SACRIFICE_FUNDS} funds.`);
    if (!ok(p.unusedCaps)) errors.push(`${who}: unused cap can't be negative.`);
    for (const f of p.funds) {
      if (![f.balance, f.salarySacrifice, f.personalDeductible, f.extra].every(ok))
        errors.push(`${who}, ${f.name || "fund"}: amounts can't be negative.`);
    }
  }
  return errors;
}

/** Total super balance across a person's funds. */
const totalBalance = (p: SacrificePerson) => sum(p.funds, (f) => f.balance) as Cents;
const currentSacrifice = (p: SacrificePerson) => sum(p.funds, (f) => f.salarySacrifice) as Cents;
const personalDeductible = (p: SacrificePerson) =>
  sum(p.funds, (f) => f.personalDeductible) as Cents;

/** Unused cap this person can use this year. */
export function usableCarryForward(p: SacrificePerson): Cents {
  if (totalBalance(p) >= CARRY_FORWARD_BALANCE_LIMIT) return 0 as Cents;
  return (p.unusedCaps ?? 0) as Cents;
}

/** Low income super tax offset on a year's concessional contributions. */
export function listoFor(adjustedTaxable: Cents, concessional: Cents, r = LISTO): Cents {
  if (adjustedTaxable > r.incomeLimit) return 0 as Cents;
  return toC(Math.min(r.max, concessional * r.rate));
}

/** One person's year at a total salary sacrifice of `sacrifice`. */
export function sacrificePosition(
  p: SacrificePerson,
  year: string,
  sacrifice: Cents,
): SacrificePosition {
  const personal = personalDeductible(p);
  const pay = calculatePay({
    ...p.pay,
    year,
    salarySacrifice: sacrifice,
    // Personal deductible contributions come off taxable income at tax time.
    deductions: ((p.pay.deductions ?? 0) + personal) as Cents,
  });
  const sup = pay.superRules;
  // The pay engine's employer super already includes the sacrifice.
  const concessional = (pay.employerSuper + personal) as Cents;
  const contributionsTax = toC(concessional * sup.contributionsTax);
  const fringe = p.pay.fringeBenefits ?? 0;
  const div293Income = pay.taxableIncome + fringe + concessional;
  const division293 =
    div293Income > sup.division293Threshold
      ? toC(Math.min(concessional, div293Income - sup.division293Threshold) * sup.contributionsTax)
      : (0 as Cents);
  // Adjusted taxable income adds back reportable super and fringe benefits.
  const ati = (pay.taxableIncome + fringe + pay.salarySacrifice + personal) as Cents;
  const listo = listoFor(ati, concessional);
  const intoSuper = (concessional - contributionsTax - division293 + listo) as Cents;
  const room = sup.concessionalCap + usableCarryForward(p);
  return {
    salarySacrifice: pay.salarySacrifice,
    pay,
    concessional,
    contributionsTax,
    division293,
    listo,
    intoSuper,
    headroom: (room - concessional) as Cents,
  };
}

/** What adding `extra` a year of salary sacrifice on top of what's in place does. */
export function sacrificeEffect(p: SacrificePerson, year: string, extra: Cents): SacrificeEffect {
  const base = currentSacrifice(p);
  const before = sacrificePosition(p, year, base);
  const after = sacrificePosition(p, year, (base + extra) as Cents);
  const added = (after.salarySacrifice - before.salarySacrifice) as Cents;
  const takeHomeCost = (before.pay.net - after.pay.net) as Cents;
  const intoSuper = (after.intoSuper - before.intoSuper) as Cents;
  return {
    extra: added,
    before,
    after,
    takeHomeCost,
    taxSaved: (before.pay.totalTax - after.pay.totalTax) as Cents,
    contributionsTax: (after.contributionsTax - before.contributionsTax) as Cents,
    division293: (after.division293 - before.division293) as Cents,
    listoChange: (after.listo - before.listo) as Cents,
    intoSuper,
    netGain: (intoSuper - takeHomeCost) as Cents,
    superPerDollar: takeHomeCost > 0 ? intoSuper / takeHomeCost : 0,
  };
}

/** The most extra sacrifice that fits: cap headroom, and no more than the cash pay left. */
export function maxExtra(p: SacrificePerson, year: string): Cents {
  const now = sacrificePosition(p, year, currentSacrifice(p));
  const pay = now.pay;
  const cashLeft = pay.gross - pay.salarySacrifice - pay.otherPackaging;
  return Math.max(0, Math.min(now.headroom, cashLeft)) as Cents;
}

/**
 * The extra sacrifice that costs `takeHome` a year of take-home pay, to the
 * dollar. Capped at what the cap and pay allow.
 */
export function sacrificeForTakeHome(p: SacrificePerson, year: string, takeHome: Cents): Cents {
  const most = maxExtra(p, year);
  if (takeHome <= 0) return 0 as Cents;
  if (sacrificeEffect(p, year, most).takeHomeCost <= takeHome) return most;
  // Take-home cost rises with the sacrifice, so bisect in whole dollars.
  let lo = 0;
  let hi = most as number;
  while (hi - lo > 100) {
    const mid = lo + Math.max(1, Math.floor((hi - lo) / 200)) * 100;
    if (sacrificeEffect(p, year, mid as Cents).takeHomeCost <= takeHome) lo = mid;
    else hi = mid;
  }
  return lo as Cents;
}

function suggestions(p: SacrificePerson, year: string): SacrificeSuggestion[] {
  const out: SacrificeSuggestion[] = [];
  const most = maxExtra(p, year);
  if (most > 0) out.push({ kind: "fill-cap", extra: most, effect: sacrificeEffect(p, year, most) });

  // Bring taxable income down to the bottom of the current tax bracket.
  const now = sacrificePosition(p, year, currentSacrifice(p));
  const taxable = now.pay.taxableIncome;
  const residency = p.pay.residency ?? "resident";
  const { rules } = taxRulesForYear(year);
  const brackets =
    residency === "foreign" ? rules.foreign : residency === "whm" ? rules.whm : rules.resident;
  let edge: { from: Cents; rate: number } | undefined;
  for (const b of brackets) if (taxable > b.from) edge = b;
  if (edge && edge.from > 0 && edge.rate > 0.2) {
    const toEdge = (taxable - edge.from) as Cents;
    if (toEdge > 0 && toEdge < most) {
      out.push({
        kind: "bracket-edge",
        extra: toEdge,
        effect: sacrificeEffect(p, year, toEdge),
        taxableIncome: edge.from,
        rateAbove: edge.rate,
      });
    }
  }
  return out;
}

function warnings(p: SacrificePerson, e: SacrificeEffect, asked: Cents): SacrificeWarning[] {
  const w: SacrificeWarning[] = [];
  const a = e.after;
  if (asked > e.extra) w.push({ kind: "too-big" });
  if (a.headroom < 0) w.push({ kind: "over-cap", over: -a.headroom as Cents });
  const cap = a.pay.superRules.concessionalCap;
  if (a.concessional > cap && a.headroom >= 0)
    w.push({ kind: "uses-carry-forward", amount: (a.concessional - cap) as Cents });
  if ((p.unusedCaps ?? 0) > 0 && usableCarryForward(p) === 0)
    w.push({ kind: "carry-forward-blocked", balance: totalBalance(p) });
  if (e.extra > 0 && e.netGain < 0) w.push({ kind: "not-worth-it", netGain: e.netGain });
  if (e.listoChange < 0) w.push({ kind: "loses-listo", amount: -e.listoChange as Cents });
  if (e.division293 > 0) w.push({ kind: "division-293", amount: e.division293 });
  return w;
}

/**
 * Split `budget` of take-home pay a year across people so it buys the most
 * super. Gives $100 a year at a time to whoever turns it into the most super,
 * so it follows tax brackets, tapers and caps.
 */
export function splitBudget(
  people: SacrificePerson[],
  year: string,
  budget: Cents,
): HouseholdShare[] {
  const step = 10_000; // $100
  const extra = people.map(() => 0);
  const effects = people.map((p) => sacrificeEffect(p, year, 0 as Cents));
  const limits = people.map((p) => maxExtra(p, year));
  let spent = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    let best = -1;
    let bestRatio = 0;
    let bestEffect: SacrificeEffect | undefined;
    for (let i = 0; i < people.length; i++) {
      const next = Math.min(extra[i] + step, limits[i]);
      if (next <= extra[i]) continue;
      const e = sacrificeEffect(people[i], year, next as Cents);
      const dCost = e.takeHomeCost - effects[i].takeHomeCost;
      const dSuper = e.intoSuper - effects[i].intoSuper;
      if (spent + dCost > budget) continue;
      const ratio = dCost > 0 ? dSuper / dCost : dSuper > 0 ? Number.POSITIVE_INFINITY : 0;
      if (ratio > bestRatio) {
        best = i;
        bestRatio = ratio;
        bestEffect = e;
      }
    }
    if (best < 0 || !bestEffect) break;
    spent += bestEffect.takeHomeCost - effects[best].takeHomeCost;
    extra[best] = bestEffect.extra;
    effects[best] = bestEffect;
  }
  return people.map((p, i) => ({
    id: p.id,
    extra: extra[i] as Cents,
    takeHomeCost: effects[i].takeHomeCost,
    intoSuper: effects[i].intoSuper,
  }));
}

/** Check each person's extra salary sacrifice, and the household's total. */
export function checkSacrifice(input: SacrificeInput): SacrificeResult {
  const errors = validateSacrifice(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const { carriedForward } = taxRulesForYear(input.year);
  const superRules = superRulesForYear(input.year);
  const people = input.people.map((p): PersonSacrifice => {
    const asked = sum(p.funds, (f) => f.extra) as Cents;
    const effect = sacrificeEffect(p, input.year, asked);
    return {
      id: p.id,
      name: p.name,
      effect,
      cap: superRules.concessionalCap,
      carryForward: usableCarryForward(p),
      totalBalance: totalBalance(p),
      suggestions: suggestions(p, input.year),
      warnings: warnings(p, effect, asked),
    };
  });
  const t = (f: (e: SacrificeEffect) => number) => sum(people, (p) => f(p.effect)) as Cents;
  const { rules } = taxRulesForYear(input.year);
  return {
    year: input.year,
    rulesCarriedForward: carriedForward,
    people,
    total: {
      extra: t((e) => e.extra),
      takeHomeCost: t((e) => e.takeHomeCost),
      taxSaved: t((e) => e.taxSaved),
      intoSuper: t((e) => e.intoSuper),
      netGain: t((e) => e.netGain),
    },
    budgetSplit:
      input.householdBudget !== undefined && input.householdBudget > 0
        ? splitBudget(input.people, input.year, input.householdBudget)
        : null,
    superRules,
    sources: [...superRules.sources, LISTO.source, ...rules.sources],
  };
}
