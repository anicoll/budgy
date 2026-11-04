import {
  type Cents,
  type Frequency,
  SOM_MAX_PEOPLE,
  type SuperOrMortgageInput,
} from "@budgy/engine";
import type { SharedLoan } from "./saved";
import { b64urlDecode, b64urlEncode, today } from "./state";

/** Inputs for "Super or mortgage?", as typed: dollars, percent and years. */

export type SparePer = "week" | "fortnight" | "month" | "year";
export const SPARE_PER_YEAR: Record<SparePer, number> = {
  week: 52,
  fortnight: 26,
  month: 12,
  year: 1,
};

export interface SomPersonRow {
  id: string;
  name: string;
  age: number;
  retireAge: number;
  salary: number; // a year, before tax, not counting employer super
  sacrificing: number; // a year, already salary sacrificed
  superBalance: number; // for the carry-forward test
  help: boolean; // has a HELP or other study loan
  privateCover: boolean; // has private hospital cover
}

export interface SomState {
  people: SomPersonRow[];
  loan: {
    balance: number;
    ratePct: number;
    termYears: number;
    frequency: Frequency;
    offset: number;
  };
  spare: number;
  sparePer: SparePer;
  superReturnPct: number; // after fees and tax
  inflationPct: number;
  /** Compare until this person retires. Blank (and no years) = the first person. */
  compareTo?: string;
  /** Compare over this many years instead. */
  compareYears?: number;
  startDate: string;
}

export function newSomPerson(id: string, name: string): SomPersonRow {
  return {
    id,
    name,
    age: 40,
    retireAge: 67,
    salary: 80_000,
    sacrificing: 0,
    superBalance: 100_000,
    help: false,
    privateCover: true,
  };
}

export function defaultSomState(start = today()): SomState {
  return {
    people: [
      { ...newSomPerson("p1", "You"), salary: 120_000, superBalance: 150_000 },
      { ...newSomPerson("p2", "Partner"), age: 38, salary: 70_000, superBalance: 90_000 },
    ],
    loan: { balance: 600_000, ratePct: 6, termYears: 25, frequency: "monthly", offset: 0 },
    spare: 500,
    sparePer: "month",
    superReturnPct: 7,
    inflationPct: 2.5,
    startDate: start,
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

/** Spare cash a month, in cents, from what was typed. */
export function spareMonthly(s: Pick<SomState, "spare" | "sparePer">): Cents {
  return toCents((s.spare * SPARE_PER_YEAR[s.sparePer]) / 12);
}

export function toSomInput(s: SomState): SuperOrMortgageInput {
  return {
    startDate: s.startDate,
    people: s.people.map((p) => ({
      id: p.id,
      name: p.name || "Someone",
      age: p.age,
      retireAge: p.retireAge,
      pay: { salary: toCents(p.salary), studyLoan: p.help, hospitalCover: p.privateCover },
      funds: [
        {
          id: `${p.id}f`,
          name: "Super",
          balance: toCents(p.superBalance),
          salarySacrifice: toCents(p.sacrificing),
          personalDeductible: 0 as Cents,
          extra: 0 as Cents,
        },
      ],
    })),
    loan: {
      balance: toCents(s.loan.balance),
      annualRate: s.loan.ratePct / 100,
      termMonths: Math.round(s.loan.termYears * 12),
      frequency: s.loan.frequency,
      offsetBalance: toCents(s.loan.offset),
    },
    spareMonthly: spareMonthly(s),
    superReturn: s.superReturnPct / 100,
    inflation: s.inflationPct / 100,
    years: compareYears(s),
  };
}

/** Years to compare over: a set number, or until the chosen person retires. */
export function compareYears(s: SomState): number | undefined {
  if (s.compareYears !== undefined) return s.compareYears;
  const p = s.people.find((x) => x.id === s.compareTo) ?? s.people[0];
  return Math.min(60, Math.max(1, Math.round(p.retireAge - p.age)));
}

/** The loan as the other tools share it. */
export function readSomLoan(s: SomState): Partial<SharedLoan> {
  return {
    balance: s.loan.balance,
    ratePct: s.loan.ratePct,
    termYears: s.loan.termYears,
    frequency: s.loan.frequency,
    offset: s.loan.offset,
  };
}

export function applySomLoan(s: SomState, loan: Partial<SharedLoan>): SomState {
  return {
    ...s,
    loan: {
      balance: loan.balance ?? s.loan.balance,
      ratePct: loan.ratePct ?? s.loan.ratePct,
      termYears: loan.termYears ?? s.loan.termYears,
      frequency: loan.frequency ?? s.loan.frequency,
      offset: loan.offset ?? s.loan.offset,
    },
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const SOM_URL_VERSION = 1;

const PERS: SparePer[] = ["week", "fortnight", "month", "year"];
const FREQS: Frequency[] = ["weekly", "fortnightly", "monthly"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const money = (v: unknown, fallback: number) => clamp(num(v, fallback), 0, 1e9);

export function encodeSomState(s: SomState): string {
  const compact = {
    p: s.people.map((p) => [
      p.id,
      p.name,
      p.age,
      p.retireAge,
      p.salary,
      p.sacrificing,
      p.superBalance,
      p.help ? 1 : 0,
      p.privateCover ? 1 : 0,
    ]),
    l: [s.loan.balance, s.loan.ratePct, s.loan.termYears, s.loan.frequency, s.loan.offset],
    c: [
      s.spare,
      s.sparePer,
      s.superReturnPct,
      s.inflationPct,
      s.compareYears ?? null,
      s.compareTo ?? null,
    ],
    t: s.startDate,
  };
  return new URLSearchParams({
    v: String(SOM_URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeSomState(query: string, fallback = defaultSomState()): SomState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(SOM_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const seen = new Set<string>();
    const people: SomPersonRow[] = (Array.isArray(c.p) ? c.p : [])
      .filter((p: unknown) => Array.isArray(p))
      .slice(0, SOM_MAX_PEOPLE)
      .map((p: unknown[], i: number) => {
        let id = typeof p[0] === "string" && /^p\d{1,3}$/.test(p[0]) ? p[0] : `p${i + 1}`;
        while (seen.has(id)) id = `p${Number(id.slice(1)) + 10}`;
        seen.add(id);
        const age = clamp(num(p[2], 40), 15, 99);
        return {
          id,
          name: typeof p[1] === "string" ? p[1].slice(0, 40) : `Person ${i + 1}`,
          age,
          retireAge: clamp(num(p[3], 67), age + 1, 100),
          salary: money(p[4], 0),
          sacrificing: money(p[5], 0),
          superBalance: money(p[6], 0),
          help: p[7] === 1,
          privateCover: p[8] !== 0,
        };
      });
    if (!people.length) return fallback;
    const l = Array.isArray(c.l) ? c.l : [];
    const g = Array.isArray(c.c) ? c.c : [];
    const years =
      typeof g[4] === "number" && Number.isFinite(g[4]) ? clamp(g[4], 1, 60) : undefined;
    return {
      people,
      loan: {
        balance: money(l[0], fallback.loan.balance),
        ratePct: clamp(num(l[1], fallback.loan.ratePct), 0, 20),
        termYears: clamp(num(l[2], fallback.loan.termYears), 1, 40),
        frequency: FREQS.includes(l[3]) ? l[3] : fallback.loan.frequency,
        offset: money(l[4], 0),
      },
      spare: money(g[0], fallback.spare),
      sparePer: PERS.includes(g[1]) ? g[1] : fallback.sparePer,
      superReturnPct: clamp(num(g[2], fallback.superReturnPct), -10, 20),
      inflationPct: clamp(num(g[3], fallback.inflationPct), 0, 20),
      compareYears: years,
      compareTo: typeof g[5] === "string" && people.some((p) => p.id === g[5]) ? g[5] : undefined,
      startDate: isDate(c.t) ? c.t : fallback.startDate,
    };
  } catch {
    return fallback;
  }
}
