import {
  type Cents,
  financialYear,
  MAX_SACRIFICE_FUNDS,
  MAX_SACRIFICE_PEOPLE,
  type SacrificeInput,
  type SacrificePerson,
} from "@budgy/engine";
import { b64urlDecode, b64urlEncode, today } from "./state";

export type ShowPer = "weekly" | "fortnightly" | "monthly" | "annual";
export const SHOW_N: Record<ShowPer, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  annual: 1,
};
export const SACRIFICE_YEARS = ["2025-26", "2026-27", "2027-28"];

/** One super fund as typed. */
export interface FundRow {
  id: string;
  name: string;
  balance: number; // dollars
}

/** One person as typed, in dollars a year and percent. */
export interface PersonRow {
  id: string;
  name: string;
  salary: number;
  employerPct?: number; // blank = the super guarantee
  current: number; // salary sacrifice already in place
  personal: number; // personal deductible contributions
  extra: number; // the new sacrifice being checked
  extraFund: string; // the fund the extra goes into
  unusedCaps: number;
  studyLoan: boolean;
  hospitalCover: boolean;
  funds: FundRow[];
}

export interface SacrificeState {
  year: string;
  mode: "me" | "household";
  people: PersonRow[];
  show: ShowPer;
  budget: number; // household take-home to give up, a year
}

export function newPerson(id: string, name: string, salary = 80_000): PersonRow {
  return {
    id,
    name,
    salary,
    current: 0,
    personal: 0,
    extra: 0,
    extraFund: `${id}f1`,
    unusedCaps: 0,
    studyLoan: false,
    hospitalCover: true,
    funds: [{ id: `${id}f1`, name: "Super fund", balance: 100_000 }],
  };
}

export function nextId(prefix: string, ids: string[]): string {
  let n = ids.length + 1;
  while (ids.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function defaultSacrificeState(on = today()): SacrificeState {
  const fy = financialYear(on);
  return {
    year: SACRIFICE_YEARS.includes(fy) ? fy : "2026-27",
    mode: "me",
    people: [{ ...newPerson("p1", "You", 100_000), extra: 10_000 }],
    show: "fortnightly",
    budget: 5_000,
  };
}

const toC = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toSacrificePerson(p: PersonRow): SacrificePerson {
  const target = p.funds.some((f) => f.id === p.extraFund) ? p.extraFund : p.funds[0]?.id;
  return {
    id: p.id,
    name: p.name || "Someone",
    pay: {
      salary: toC(p.salary),
      superRate: p.employerPct === undefined ? undefined : p.employerPct / 100,
      studyLoan: p.studyLoan,
      hospitalCover: p.hospitalCover,
    },
    unusedCaps: toC(p.unusedCaps),
    funds: p.funds.map((f, i) => ({
      id: f.id,
      name: f.name || "Super fund",
      balance: toC(f.balance),
      // What's in place sits in the first fund; only the total matters to the cap and tax.
      salarySacrifice: i === 0 ? toC(p.current) : (0 as Cents),
      personalDeductible: i === 0 ? toC(p.personal) : (0 as Cents),
      extra: f.id === target ? toC(p.extra) : (0 as Cents),
    })),
  };
}

/** The people this view covers: just the first in "me" mode. */
export function activePeople(s: SacrificeState): PersonRow[] {
  return s.mode === "me" ? s.people.slice(0, 1) : s.people;
}

export function toSacrificeInput(s: SacrificeState): SacrificeInput {
  return {
    year: s.year,
    people: activePeople(s).map(toSacrificePerson),
    householdBudget: s.mode === "household" && s.budget > 0 ? toC(s.budget) : undefined,
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const SACRIFICE_URL_VERSION = 1;
const SHOWS: ShowPer[] = ["weekly", "fortnightly", "monthly", "annual"];

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const pos = (v: unknown, fallback = 0) => Math.min(10_000_000, Math.max(0, num(v, fallback)));
const optPct = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v.slice(0, 40) : fallback);

export function encodeSacrificeState(s: SacrificeState): string {
  const compact = {
    y: s.year,
    m: s.mode === "household" ? 1 : 0,
    w: SHOWS.indexOf(s.show),
    b: s.budget,
    p: s.people.map((p) => ({
      i: p.id,
      n: p.name,
      s: p.salary,
      e: p.employerPct,
      a: [p.current, p.personal, p.extra, p.unusedCaps],
      x: p.extraFund,
      o: (p.studyLoan ? 1 : 0) | (p.hospitalCover ? 0 : 2),
      f: p.funds.map((f) => [f.id, f.name, f.balance]),
    })),
  };
  return new URLSearchParams({
    v: String(SACRIFICE_URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeSacrificeState(
  query: string,
  fallback = defaultSacrificeState(),
): SacrificeState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(SACRIFICE_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const seen = new Set<string>();
    const uniq = (id: unknown, pattern: RegExp, fb: string) => {
      let out = typeof id === "string" && pattern.test(id) ? id : fb;
      while (seen.has(out)) out = `${out}x`;
      seen.add(out);
      return out;
    };
    const people: PersonRow[] = (Array.isArray(c.p) ? c.p : [])
      .filter((p: unknown) => p && typeof p === "object")
      .slice(0, MAX_SACRIFICE_PEOPLE)
      .map((p: Record<string, unknown>, i: number) => {
        const pid = uniq(p.i, /^p\d{1,3}x*$/, `p${i + 1}`);
        const funds: FundRow[] = (Array.isArray(p.f) ? p.f : [])
          .filter((f: unknown) => Array.isArray(f))
          .slice(0, MAX_SACRIFICE_FUNDS)
          .map((f: unknown[], j: number) => ({
            id: uniq(f[0], /^p\d{1,3}x*f\d{1,3}x*$/, `${pid}f${j + 1}`),
            name: str(f[1], "Super fund"),
            balance: pos(f[2]),
          }));
        if (!funds.length) funds.push({ id: `${pid}f1`, name: "Super fund", balance: 0 });
        const a = Array.isArray(p.a) ? p.a : [];
        const flags = num(p.o, 0);
        const extraFund =
          typeof p.x === "string" && funds.some((f) => f.id === p.x) ? p.x : funds[0].id;
        return {
          id: pid,
          name: str(p.n, `Person ${i + 1}`),
          salary: pos(p.s),
          employerPct: optPct(p.e),
          current: pos(a[0]),
          personal: pos(a[1]),
          extra: pos(a[2]),
          unusedCaps: pos(a[3]),
          extraFund,
          studyLoan: (flags & 1) === 1,
          hospitalCover: (flags & 2) === 0,
          funds,
        };
      });
    if (!people.length) return fallback;
    return {
      year: SACRIFICE_YEARS.includes(c.y) ? c.y : fallback.year,
      mode: c.m === 1 ? "household" : "me",
      show: SHOWS[num(c.w, 1)] ?? "fortnightly",
      budget: pos(c.b, fallback.budget),
      people,
    };
  } catch {
    return fallback;
  }
}
