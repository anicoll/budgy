import {
  type Cents,
  financialYear,
  type MedicareExemption,
  type PayInput,
  type Residency,
} from "@budgy/engine";
import { b64urlDecode, b64urlEncode, today } from "./state";

export type EntryPer = "year" | "month" | "fortnight" | "week" | "hour";
export type ShowPer = "weekly" | "fortnightly" | "monthly" | "annual";

/**
 * A novated lease's effect on pay, a year in dollars, from the novated lease
 * calculator: packaged before tax, the employee contribution after tax, and
 * the reportable fringe benefits on the income statement.
 */
export interface LeaseInPay {
  preTax: number;
  postTax: number;
  fringe: number;
}

/** The pay calculator's inputs as typed, in dollars and percent. */
export interface PayState {
  amount: number;
  per: EntryPer;
  hoursPerWeek: number;
  includesSuper: boolean;
  superPct?: number; // blank = the super guarantee
  year: string; // "2026-27"
  studyLoan: boolean;
  hospitalCover: boolean;
  residency: Residency;
  taxFreeThreshold: boolean;
  medicareExemption: MedicareExemption;
  family: boolean;
  partnerIncome: number; // a year
  children: number;
  overtimeHours: number; // a week
  overtimeRate: number; // 1.5 = time and a half
  bonus: number; // a year
  allowances: number; // a year
  sacrifice: number; // to super, a year
  packaging: number; // other pre-tax, a year
  fringe: number; // reportable fringe benefits, a year
  deductions: number; // a year
  /** The novated lease, included in pay. Null: no lease in this pay. */
  lease: LeaseInPay | null;
  /** The person turned their lease off here, so don't bring it back in. */
  leaseOff: boolean;
  show: ShowPer;
  raise: number; // a year, for "what you'd keep"
  compareAmount: number; // the other salary in the compare view, same `per`
  view: "pay" | "compare";
}

export const PAY_YEARS = ["2025-26", "2026-27", "2027-28"];

export function defaultPayState(on = today()): PayState {
  const fy = financialYear(on);
  return {
    amount: 100_000,
    per: "year",
    hoursPerWeek: 38,
    includesSuper: false,
    year: PAY_YEARS.includes(fy) ? fy : "2026-27",
    studyLoan: false,
    hospitalCover: true,
    residency: "resident",
    taxFreeThreshold: true,
    medicareExemption: "none",
    family: false,
    partnerIncome: 0,
    children: 0,
    overtimeHours: 0,
    overtimeRate: 1.5,
    bonus: 0,
    allowances: 0,
    sacrifice: 0,
    packaging: 0,
    fringe: 0,
    deductions: 0,
    lease: null,
    leaseOff: false,
    show: "fortnightly",
    raise: 5_000,
    compareAmount: 110_000,
    view: "pay",
  };
}

const PER_YEAR: Record<Exclude<EntryPer, "hour">, number> = {
  year: 1,
  month: 12,
  fortnight: 26,
  week: 52,
};

/** A typed amount as dollars a year. */
export function annualise(amount: number, per: EntryPer, hoursPerWeek: number): number {
  if (per === "hour") return amount * hoursPerWeek * 52;
  return amount * PER_YEAR[per];
}

/** The same yearly amount shown `per` something, for switching the entry period. */
export function fromAnnual(annual: number, per: EntryPer, hoursPerWeek: number): number {
  const v = per === "hour" ? annual / (hoursPerWeek * 52 || 1) : annual / PER_YEAR[per];
  return Math.round(v * 100) / 100;
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

/** Overtime a year from hours a week at a multiple of the ordinary hourly rate. */
export function overtimeAnnual(s: PayState, amount = s.amount): number {
  if (!s.overtimeHours) return 0;
  const salary = annualise(amount, s.per, s.hoursPerWeek);
  const base = s.includesSuper ? salary / (1 + (s.superPct ?? 12) / 100) : salary;
  const hourly = base / (Math.max(1, s.hoursPerWeek) * 52);
  return hourly * s.overtimeRate * s.overtimeHours * 52;
}

export function toPayInput(s: PayState, amount = s.amount): PayInput {
  const lease = s.lease ?? { preTax: 0, postTax: 0, fringe: 0 };
  return {
    year: s.year,
    salary: toCents(annualise(amount, s.per, s.hoursPerWeek)),
    includesSuper: s.includesSuper,
    superRate: s.superPct === undefined ? undefined : s.superPct / 100,
    overtime: toCents(overtimeAnnual(s, amount)),
    bonus: toCents(s.bonus),
    allowances: toCents(s.allowances),
    salarySacrifice: toCents(s.sacrifice),
    otherPackaging: toCents(s.packaging + lease.preTax),
    fringeBenefits: toCents(s.fringe + lease.fringe),
    deductions: toCents(s.deductions),
    afterTax: toCents(lease.postTax),
    residency: s.residency,
    taxFreeThreshold: s.taxFreeThreshold,
    medicareExemption: s.medicareExemption,
    studyLoan: s.studyLoan,
    hospitalCover: s.hospitalCover,
    family: s.family
      ? { partnerIncome: toCents(s.partnerIncome), children: s.children }
      : undefined,
  };
}

/** True when any of the "more options" differ from the defaults, so they open. */
export function hasAdvanced(s: PayState): boolean {
  const d = defaultPayState();
  return (
    s.superPct !== undefined ||
    s.residency !== d.residency ||
    !s.taxFreeThreshold ||
    s.medicareExemption !== "none" ||
    !s.hospitalCover ||
    s.family ||
    s.overtimeHours > 0 ||
    s.bonus > 0 ||
    s.allowances > 0 ||
    s.sacrifice > 0 ||
    s.packaging > 0 ||
    s.fringe > 0 ||
    s.deductions > 0
  );
}

// ── URL state ───────────────────────────────────────────────────────────────

export const PAY_URL_VERSION = 1;

const PERS: EntryPer[] = ["year", "month", "fortnight", "week", "hour"];
const SHOWS: ShowPer[] = ["weekly", "fortnightly", "monthly", "annual"];
const RESIDENCIES: Residency[] = ["resident", "foreign", "whm"];
const EXEMPTIONS: MedicareExemption[] = ["none", "half", "full"];

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const money = (v: unknown, fallback: number) => clamp(num(v, fallback), 0, 10_000_000);
const pick = <T extends string>(v: unknown, options: T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

export function encodePayState(s: PayState): string {
  const compact = {
    a: [s.amount, PERS.indexOf(s.per), s.hoursPerWeek, s.includesSuper ? 1 : 0, s.superPct ?? null],
    y: s.year,
    f: [
      s.studyLoan ? 1 : 0,
      s.hospitalCover ? 1 : 0,
      RESIDENCIES.indexOf(s.residency),
      s.taxFreeThreshold ? 1 : 0,
      EXEMPTIONS.indexOf(s.medicareExemption),
    ],
    m: s.family ? [s.partnerIncome, s.children] : null,
    x: [
      s.overtimeHours,
      s.overtimeRate,
      s.bonus,
      s.allowances,
      s.sacrifice,
      s.packaging,
      s.fringe,
      s.deductions,
    ],
    v: [SHOWS.indexOf(s.show), s.raise, s.compareAmount, s.view === "compare" ? 1 : 0],
    n: s.lease ? [s.lease.preTax, s.lease.postTax, s.lease.fringe] : null,
    o: s.leaseOff ? 1 : 0,
  };
  return new URLSearchParams({
    v: String(PAY_URL_VERSION),
    p: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodePayState(query: string, fallback = defaultPayState()): PayState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("p");
    if (!raw || params.get("v") !== String(PAY_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const a = Array.isArray(c.a) ? c.a : [];
    const f = Array.isArray(c.f) ? c.f : [];
    const x = Array.isArray(c.x) ? c.x : [];
    const v = Array.isArray(c.v) ? c.v : [];
    const m = Array.isArray(c.m) ? c.m : null;
    const n = Array.isArray(c.n) ? c.n : null;
    const superPct =
      typeof a[4] === "number" && Number.isFinite(a[4]) ? clamp(a[4], 0, 100) : undefined;
    return {
      amount: money(a[0], fallback.amount),
      per: PERS[num(a[1], -1)] ?? fallback.per,
      hoursPerWeek: clamp(num(a[2], fallback.hoursPerWeek), 1, 100),
      includesSuper: a[3] === 1,
      superPct,
      year: PAY_YEARS.includes(c.y) ? c.y : fallback.year,
      studyLoan: f[0] === 1,
      hospitalCover: f[1] !== 0,
      residency: RESIDENCIES[num(f[2], 0)] ?? "resident",
      taxFreeThreshold: f[3] !== 0,
      medicareExemption: EXEMPTIONS[num(f[4], 0)] ?? "none",
      family: Boolean(m),
      partnerIncome: m ? money(m[0], 0) : 0,
      children: m ? clamp(Math.round(num(m[1], 0)), 0, 20) : 0,
      overtimeHours: clamp(num(x[0], 0), 0, 80),
      overtimeRate: clamp(num(x[1], 1.5), 1, 3),
      bonus: money(x[2], 0),
      allowances: money(x[3], 0),
      sacrifice: money(x[4], 0),
      packaging: money(x[5], 0),
      fringe: money(x[6], 0),
      deductions: money(x[7], 0),
      lease: n ? { preTax: money(n[0], 0), postTax: money(n[1], 0), fringe: money(n[2], 0) } : null,
      leaseOff: c.o === 1,
      show: pick(SHOWS[num(v[0], -1)], SHOWS, fallback.show),
      raise: money(v[1], fallback.raise),
      compareAmount: money(v[2], fallback.compareAmount),
      view: v[3] === 1 ? "compare" : "pay",
    };
  } catch {
    return fallback;
  }
}
