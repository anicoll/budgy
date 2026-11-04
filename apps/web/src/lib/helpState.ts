import type { Cents, HelpAlternative, HelpEarlyInput } from "@budgy/engine";
import { today } from "@/lib/state";

/** What the person types into the HELP tool, in dollars and percent. */
export interface HelpForm {
  balance: number;
  income: number;
  lumpSum: number;
  alternative: HelpAlternative;
  ratePct: number;
  /** Blank works it out from income. */
  taxRatePct?: number;
  indexationPct: number;
  incomeGrowthPct: number;
}

export function defaultHelp(): HelpForm {
  return {
    balance: 30_000,
    income: 90_000,
    lumpSum: 10_000,
    alternative: "offset",
    ratePct: 6,
    indexationPct: 3,
    incomeGrowthPct: 3,
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toHelpInput(f: HelpForm, on = today()): HelpEarlyInput {
  return {
    today: on,
    balance: toCents(f.balance),
    income: toCents(f.income),
    lumpSum: toCents(f.lumpSum),
    alternative: f.alternative,
    rate: f.ratePct / 100,
    taxRate: f.taxRatePct === undefined ? undefined : f.taxRatePct / 100,
    indexation: f.indexationPct / 100,
    incomeGrowth: f.incomeGrowthPct / 100,
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const HELP_URL_VERSION = 1;

const NUM_KEYS = {
  b: "balance",
  i: "income",
  l: "lumpSum",
  r: "ratePct",
  t: "taxRatePct",
  x: "indexationPct",
  g: "incomeGrowthPct",
} as const satisfies Record<string, keyof HelpForm>;

export function encodeHelp(f: HelpForm): string {
  const q = new URLSearchParams({ v: String(HELP_URL_VERSION) });
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const v = f[field];
    if (v !== undefined) q.set(k, String(v));
  }
  q.set("a", f.alternative === "offset" ? "o" : "s");
  return q.toString();
}

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeHelp(query: string, fallback = defaultHelp()): HelpForm {
  const q = new URLSearchParams(query);
  if (q.get("v") !== String(HELP_URL_VERSION)) return fallback;
  const f: HelpForm = { ...fallback, taxRatePct: undefined };
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const raw = q.get(k);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    // Growth can be negative; everything else is zero or more.
    const ok = Number.isFinite(n) && (n >= 0 || field === "incomeGrowthPct");
    if (ok) (f as unknown as Record<string, number>)[field] = n;
  }
  f.alternative = q.get("a") === "s" ? "savings" : "offset";
  return f;
}
