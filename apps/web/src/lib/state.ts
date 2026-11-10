import type {
  Cents,
  FortnightlyMethod,
  Frequency,
  LoanInput,
  ScenarioChanges,
} from "@budgy/engine";

/**
 * What the person types, in dollars and percent. Kept separate from the
 * engine's cents-based LoanInput so the form and the URL stay human-sized.
 */
export interface BaseLoan {
  balance: number; // dollars
  ratePct: number; // e.g. 6.04
  termYears: number;
  frequency: Frequency;
  fortnightlyMethod: FortnightlyMethod;
  offset: number; // dollars
  startDate: string; // YYYY-MM-DD
}

export interface Scenario {
  name: string;
  extra?: number; // dollars per repayment
  offset?: number; // replaces the base offset
  offsetDeposit?: number; // dollars per month
  lumpSum?: { amount: number; date: string; yearly: boolean };
  rateChange?: { date: string; ratePct: number; followMinimum?: boolean };
  frequency?: Frequency;
}

export interface CalculatorState {
  base: BaseLoan;
  scenarios: Scenario[];
}

export const MAX_SCENARIOS = 3;

// Pages are prerendered when the site is built, so the browser's first render
// has to use the build's date too. Otherwise anything worked out from today (a
// payoff date, a balance chart) renders different text the day after a deploy,
// and React throws the prerendered page away (error #418). `startClock` moves
// on to the real date once the page has hydrated.
const BUILD_DAY = process.env.BUDGY_BUILD_DAY;
let live = !BUILD_DAY;

/** Use the real date from now on. Call it from an effect, after hydration. */
export function startClock(): void {
  live = true;
}

export function today(): string {
  return live || !BUILD_DAY ? new Date().toISOString().slice(0, 10) : BUILD_DAY;
}

export function defaultState(start = today()): CalculatorState {
  return {
    base: {
      balance: 600_000,
      ratePct: 6,
      termYears: 30,
      frequency: "monthly",
      fortnightlyMethod: "half-monthly",
      offset: 0,
      startDate: start,
    },
    scenarios: [{ name: "Scenario A", extra: 200 }],
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toLoanInput(base: BaseLoan): LoanInput {
  return {
    balance: toCents(base.balance),
    annualRate: base.ratePct / 100,
    termMonths: Math.round(base.termYears * 12),
    startDate: base.startDate,
    frequency: base.frequency,
    fortnightlyMethod: base.fortnightlyMethod,
    offsetBalance: toCents(base.offset),
  };
}

export function toChanges(s: Scenario): ScenarioChanges {
  const c: ScenarioChanges = {};
  if (s.extra) c.extraPerPeriod = toCents(s.extra);
  if (s.offset !== undefined) c.offsetBalance = toCents(s.offset);
  if (s.offsetDeposit) c.offsetMonthlyDeposit = toCents(s.offsetDeposit);
  if (s.lumpSum && s.lumpSum.amount > 0) {
    c.lumpSums = [
      { date: s.lumpSum.date, amount: toCents(s.lumpSum.amount), repeatYearly: s.lumpSum.yearly },
    ];
  }
  if (s.rateChange) {
    c.rateChanges = [{ date: s.rateChange.date, annualRate: s.rateChange.ratePct / 100 }];
    if (s.rateChange.followMinimum) c.followMinimum = true;
  }
  if (s.frequency) c.frequency = s.frequency;
  return c;
}

/**
 * Parse loose money input: "600k", "$600,000", "1.2m", "600000".
 * Returns null when it isn't a number.
 */
export function parseMoney(text: string): number | null {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, "");
  const m = /^(\d*\.?\d+)([km]?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ── URL state ───────────────────────────────────────────────────────────────
// The whole calculator lives in the URL so any view can be shared. It is
// versioned so old links keep working when the shape changes.

export const URL_VERSION = 1;

const FREQ = { weekly: "w", fortnightly: "f", monthly: "m" } as const;
const FREQ_BACK: Record<string, Frequency> = { w: "weekly", f: "fortnightly", m: "monthly" };

export function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeState(state: CalculatorState): string {
  const { base } = state;
  const compact = {
    b: [
      base.balance,
      base.ratePct,
      base.termYears,
      FREQ[base.frequency],
      base.fortnightlyMethod === "true" ? 1 : 0,
      base.offset,
      base.startDate,
    ],
    s: state.scenarios.map((s) => ({
      n: s.name,
      x: s.extra,
      o: s.offset,
      d: s.offsetDeposit,
      l: s.lumpSum ? [s.lumpSum.amount, s.lumpSum.date, s.lumpSum.yearly ? 1 : 0] : undefined,
      r: s.rateChange
        ? [s.rateChange.date, s.rateChange.ratePct, ...(s.rateChange.followMinimum ? [1] : [])]
        : undefined,
      f: s.frequency ? FREQ[s.frequency] : undefined,
    })),
  };
  return new URLSearchParams({
    v: String(URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const date = (v: unknown, fallback: string) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
const optNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Read state from a query string. Anything missing or broken falls back to defaults. */
export function decodeState(query: string, fallback = defaultState()): CalculatorState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const fb = fallback.base;
    const b = Array.isArray(c.b) ? c.b : [];
    const base: BaseLoan = {
      balance: num(b[0], fb.balance),
      ratePct: num(b[1], fb.ratePct),
      termYears: num(b[2], fb.termYears),
      frequency: FREQ_BACK[b[3]] ?? fb.frequency,
      fortnightlyMethod: b[4] === 1 ? "true" : "half-monthly",
      offset: num(b[5], fb.offset),
      startDate: date(b[6], fb.startDate),
    };
    const scenarios: Scenario[] = (Array.isArray(c.s) ? c.s : [])
      .slice(0, MAX_SCENARIOS)
      .map((s: Record<string, unknown>, i: number) => {
        const l = Array.isArray(s.l) ? s.l : null;
        const r = Array.isArray(s.r) ? s.r : null;
        return {
          name: typeof s.n === "string" ? s.n.slice(0, 40) : `Scenario ${"ABC"[i]}`,
          extra: optNum(s.x),
          offset: optNum(s.o),
          offsetDeposit: optNum(s.d),
          lumpSum: l
            ? { amount: num(l[0], 0), date: date(l[1], base.startDate), yearly: l[2] === 1 }
            : undefined,
          rateChange: r
            ? {
                date: date(r[0], base.startDate),
                ratePct: num(r[1], base.ratePct),
                ...(r[2] === 1 ? { followMinimum: true } : {}),
              }
            : undefined,
          frequency: typeof s.f === "string" ? FREQ_BACK[s.f] : undefined,
        };
      });
    return { base, scenarios };
  } catch {
    return fallback;
  }
}
