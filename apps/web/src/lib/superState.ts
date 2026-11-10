import { type Cents, MAX_ACCOUNTS, MAX_PEOPLE, type SuperInput } from "@budgy/engine";
import { b64urlDecode, b64urlEncode, today } from "./state";

/** One super account as typed, in dollars and percent. */
export interface AccountRow {
  id: string;
  name: string;
  balance: number;
  returnPct: number; // after investment fees and tax
  feeFixed: number; // dollars a year
  feePct: number; // percent a year
  sacrifice?: number; // dollars a month, before tax
  afterTax?: number; // dollars a month
  employer: boolean; // employer contributions go here
}

export interface PersonRow {
  id: string;
  name: string;
  age: number;
  retireAge: number;
  salary: number; // dollars a year, before tax
  employerPct?: number; // blank = the super guarantee
  accounts: AccountRow[];
}

export interface SuperState {
  people: PersonRow[];
  wageGrowthPct: number;
  inflationPct: number;
  incomeUntil: number;
  startDate: string;
  extraPerWeek: number; // for the "what an extra does" card
  pension: PensionRow;
  /** The "compare fees" section, once the person has typed in it. */
  fees?: FeeCompareRow;
}

/** Fees for the two funds being compared: dollars a year and percent of balance. */
export interface FeeCompareRow {
  a: { fixed: number; pct: number };
  b: { fixed: number; pct: number };
}

/** What the Age Pension estimate needs beyond super, in dollars. */
export interface PensionRow {
  homeowner: boolean;
  savings: number; // savings and shares outside super: deemed
  otherAssets: number; // cars, contents, investment property: not deemed
  otherIncome: number; // a fortnight: rent, work
}

export const defaultPension = (): PensionRow => ({
  homeowner: true,
  savings: 0,
  otherAssets: 20_000,
  otherIncome: 0,
});

export function newAccount(id: string, name = "Super fund", employer = false): AccountRow {
  return { id, name, balance: 0, returnPct: 7, feeFixed: 100, feePct: 0.2, employer };
}

export function newPerson(id: string, name: string): PersonRow {
  return {
    id,
    name,
    age: 40,
    retireAge: 67,
    salary: 80_000,
    accounts: [newAccount(`${id}a1`, "Super fund", true)],
  };
}

/** Next id with a prefix, unique within `ids`. */
export function nextId(prefix: string, ids: string[]): string {
  let n = ids.length + 1;
  while (ids.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function defaultSuperState(start = today()): SuperState {
  return {
    people: [
      {
        ...newPerson("p1", "You"),
        age: 38,
        salary: 95_000,
        accounts: [{ ...newAccount("p1a1", "Super fund", true), balance: 110_000 }],
      },
      {
        ...newPerson("p2", "Partner"),
        age: 35,
        salary: 78_000,
        accounts: [{ ...newAccount("p2a1", "Super fund", true), balance: 65_000 }],
      },
    ],
    wageGrowthPct: 3.5,
    inflationPct: 2.5,
    incomeUntil: 90,
    startDate: start,
    extraPerWeek: 50,
    pension: defaultPension(),
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toSuperInput(s: SuperState): SuperInput {
  return {
    startDate: s.startDate,
    wageGrowth: s.wageGrowthPct / 100,
    inflation: s.inflationPct / 100,
    incomeUntilAge: s.incomeUntil,
    people: s.people.map((p) => ({
      id: p.id,
      name: p.name || "Someone",
      age: p.age,
      retireAge: p.retireAge,
      salary: toCents(p.salary),
      employerRate: p.employerPct === undefined ? undefined : p.employerPct / 100,
      accounts: p.accounts.map((a) => ({
        id: a.id,
        name: a.name || "Super fund",
        balance: toCents(a.balance),
        returnPct: a.returnPct / 100,
        adminFeeFixed: toCents(a.feeFixed),
        adminFeePct: a.feePct / 100,
        salarySacrifice: toCents((a.sacrifice ?? 0) * 12),
        afterTax: toCents((a.afterTax ?? 0) * 12),
        receivesEmployer: a.employer,
      })),
    })),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const SUPER_URL_VERSION = 1;

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const optNum = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function encodeSuperState(s: SuperState): string {
  const compact = {
    p: s.people.map((p) => ({
      i: p.id,
      n: p.name,
      a: p.age,
      r: p.retireAge,
      s: p.salary,
      e: p.employerPct,
      f: p.accounts.map((a) => [
        a.id,
        a.name,
        a.balance,
        a.returnPct,
        a.feeFixed,
        a.feePct,
        a.sacrifice ?? null,
        a.afterTax ?? null,
        a.employer ? 1 : 0,
      ]),
    })),
    g: [s.wageGrowthPct, s.inflationPct, s.incomeUntil, s.extraPerWeek],
    t: s.startDate,
    a: [
      s.pension.homeowner ? 1 : 0,
      s.pension.savings,
      s.pension.otherAssets,
      s.pension.otherIncome,
    ],
  };
  const body = s.fees
    ? { ...compact, c: [s.fees.a.fixed, s.fees.a.pct, s.fees.b.fixed, s.fees.b.pct] }
    : compact;
  return new URLSearchParams({
    v: String(SUPER_URL_VERSION),
    s: b64urlEncode(JSON.stringify(body)),
  }).toString();
}

function decodePension(v: unknown): PensionRow {
  const d = defaultPension();
  if (!Array.isArray(v)) return d;
  return {
    homeowner: v[0] !== 0,
    savings: Math.max(0, num(v[1], d.savings)),
    otherAssets: Math.max(0, num(v[2], d.otherAssets)),
    otherIncome: Math.max(0, num(v[3], d.otherIncome)),
  };
}

function decodeFees(v: unknown): FeeCompareRow | undefined {
  if (!Array.isArray(v) || v.length < 4 || !v.slice(0, 4).every((n) => Number.isFinite(n)))
    return undefined;
  const fee = (fixed: number, pct: number) => ({
    fixed: clamp(fixed, 0, 100_000),
    pct: clamp(pct, 0, 5),
  });
  return { a: fee(v[0], v[1]), b: fee(v[2], v[3]) };
}

export function decodeSuperState(query: string, fallback = defaultSuperState()): SuperState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(SUPER_URL_VERSION)) return fallback;
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
      .slice(0, MAX_PEOPLE)
      .map((p: Record<string, unknown>, i: number) => {
        const pid = uniq(p.i, /^p\d{1,3}x*$/, `p${i + 1}`);
        const accounts: AccountRow[] = (Array.isArray(p.f) ? p.f : [])
          .filter((a: unknown) => Array.isArray(a))
          .slice(0, MAX_ACCOUNTS)
          .map((a: unknown[], j: number) => ({
            id: uniq(a[0], /^p\d{1,3}x*a\d{1,3}x*$/, `${pid}a${j + 1}`),
            name: typeof a[1] === "string" ? a[1].slice(0, 40) : "Super fund",
            balance: Math.max(0, num(a[2], 0)),
            returnPct: clamp(num(a[3], 7), -20, 20),
            feeFixed: Math.max(0, num(a[4], 0)),
            feePct: clamp(num(a[5], 0), 0, 5),
            sacrifice: optNum(a[6]),
            afterTax: optNum(a[7]),
            employer: a[8] === 1,
          }));
        if (!accounts.length) accounts.push(newAccount(`${pid}a1`, "Super fund", true));
        return {
          id: pid,
          name: typeof p.n === "string" ? p.n.slice(0, 40) : `Person ${i + 1}`,
          age: clamp(num(p.a, 40), 15, 100),
          retireAge: clamp(num(p.r, 67), 15, 100),
          salary: Math.max(0, num(p.s, 0)),
          employerPct: optNum(p.e),
          accounts,
        };
      });
    if (!people.length) return fallback;
    const g = Array.isArray(c.g) ? c.g : [];
    return {
      people,
      wageGrowthPct: clamp(num(g[0], fallback.wageGrowthPct), 0, 20),
      inflationPct: clamp(num(g[1], fallback.inflationPct), 0, 20),
      incomeUntil: clamp(num(g[2], fallback.incomeUntil), 50, 110),
      extraPerWeek: Math.max(0, num(g[3], fallback.extraPerWeek)),
      startDate: isDate(c.t) ? c.t : fallback.startDate,
      pension: decodePension(c.a),
      fees: decodeFees(c.c),
    };
  } catch {
    return fallback;
  }
}
