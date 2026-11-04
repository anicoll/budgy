import type { Cents, LoanPurpose, RateCheckInput, RateType, RepaymentType } from "@budgy/engine";

/**
 * What the person types into the rate check, in dollars, percent and years.
 * Kept apart from the engine's cents-based input so the form and the URL stay
 * human-sized.
 */
export interface RateCheckForm {
  balance: number;
  ratePct: number;
  termYears: number;
  purpose: LoanPurpose;
  repayment: RepaymentType;
  rateType: RateType;
}

export function defaultRateCheck(): RateCheckForm {
  return {
    balance: 600_000,
    ratePct: 6.49,
    termYears: 25,
    purpose: "owner-occupier",
    repayment: "principal-and-interest",
    rateType: "variable",
  };
}

export function toRateCheckInput(f: RateCheckForm): RateCheckInput {
  return {
    balance: Math.round(f.balance * 100) as Cents,
    annualRate: f.ratePct / 100,
    termMonths: Math.round(f.termYears * 12),
    purpose: f.purpose,
    repayment: f.repayment,
    rateType: f.rateType,
  };
}

// ── URL state ───────────────────────────────────────────────────────────────
// Short keys keep shared links readable. Versioned so old links keep working.

export const RATE_CHECK_URL_VERSION = 1;

const PURPOSE = { "owner-occupier": "o", investor: "i" } as const;
const REPAY = { "principal-and-interest": "pi", "interest-only": "io" } as const;
const RATE = { variable: "v", "fixed-up-to-3-years": "f3", "fixed-over-3-years": "f4" } as const;

const back = <T extends string>(map: Record<T, string>, code: string | null, fallback: T): T =>
  (Object.entries(map) as [T, string][]).find(([, c]) => c === code)?.[0] ?? fallback;

export function encodeRateCheck(f: RateCheckForm): string {
  return new URLSearchParams({
    v: String(RATE_CHECK_URL_VERSION),
    b: String(f.balance),
    r: String(f.ratePct),
    t: String(f.termYears),
    p: PURPOSE[f.purpose],
    k: REPAY[f.repayment],
    rt: RATE[f.rateType],
  }).toString();
}

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeRateCheck(query: string, fallback = defaultRateCheck()): RateCheckForm {
  const q = new URLSearchParams(query);
  if (q.get("v") !== String(RATE_CHECK_URL_VERSION)) return fallback;
  const num = (key: string, min: number, max: number, dflt: number) => {
    const raw = q.get(key);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
  };
  return {
    balance: num("b", 1, 1e9, fallback.balance),
    ratePct: num("r", 0.01, 20, fallback.ratePct),
    termYears: num("t", 1, 40, fallback.termYears),
    purpose: back(PURPOSE, q.get("p"), fallback.purpose),
    repayment: back(REPAY, q.get("k"), fallback.repayment),
    rateType: back(RATE, q.get("rt"), fallback.rateType),
  };
}
