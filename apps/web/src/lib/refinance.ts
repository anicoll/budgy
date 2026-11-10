import type {
  Cents,
  FortnightlyMethod,
  Frequency,
  RefinanceInput,
  RefinanceRepayment,
} from "@budgy/engine";
import { addMonths } from "@budgy/engine";
import { today } from "@/lib/state";

/**
 * What the person types into the refinance check, in dollars, percent and
 * years. Kept apart from the engine's cents-based input so the form and the
 * URL stay human-sized.
 */
/** A second offer to compare with the first. Shares the loan, term and exit costs. */
export interface OfferB {
  ratePct: number;
  annualFee: number; // dollars a year
  setupCosts: number; // application, valuation, settlement, government fees
  cashback: number;
}

export interface RefinanceForm {
  // The loan now
  balance: number;
  ratePct: number;
  termYears: number;
  frequency: Frequency;
  fortnightlyMethod: FortnightlyMethod;
  repayment?: number; // dollars per period; blank = the minimum
  currentFee: number; // dollars a year
  offset: number;
  homeValue?: number; // for the LVR; blank = not asked
  // The new loan
  newRatePct: number;
  newTermYears?: number; // blank = same as years left
  introRatePct?: number; // honeymoon rate, then newRatePct
  introYears?: number;
  newFee: number;
  // Switching
  exitCosts: number; // discharge and break costs
  setupCosts: number; // application, valuation, settlement, legal, government
  cashback: number;
  addCostsToLoan: boolean;
  repaymentChoice: RefinanceRepayment;
  startDate: string; // the switch date
  offerB?: OfferB; // optional second offer
}

export function defaultRefinance(start = today()): RefinanceForm {
  return {
    balance: 600_000,
    ratePct: 6.49,
    termYears: 25,
    frequency: "monthly",
    fortnightlyMethod: "half-monthly",
    currentFee: 0,
    offset: 0,
    newRatePct: 5.79,
    newFee: 0,
    exitCosts: 350,
    setupCosts: 600,
    cashback: 0,
    addCostsToLoan: false,
    repaymentChoice: "keep",
    startDate: start,
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toRefinanceInput(f: RefinanceForm): RefinanceInput {
  const hasIntro = f.introRatePct !== undefined && (f.introYears ?? 0) > 0;
  return {
    current: {
      balance: toCents(f.balance),
      annualRate: f.ratePct / 100,
      termMonths: Math.round(f.termYears * 12),
      startDate: f.startDate,
      frequency: f.frequency,
      fortnightlyMethod: f.fortnightlyMethod,
      repayment: f.repayment ? toCents(f.repayment) : undefined,
      offsetBalance: toCents(f.offset),
    },
    proposed: {
      annualRate: (hasIntro ? (f.introRatePct as number) : f.newRatePct) / 100,
      termMonths: f.newTermYears ? Math.round(f.newTermYears * 12) : undefined,
      rateChanges: hasIntro
        ? [
            {
              date: addMonths(f.startDate, Math.round((f.introYears as number) * 12)),
              annualRate: f.newRatePct / 100,
            },
          ]
        : undefined,
    },
    repayment: f.repaymentChoice,
    switchingCosts: toCents(f.exitCosts + f.setupCosts),
    cashback: toCents(f.cashback),
    addCostsToLoan: f.addCostsToLoan,
    currentAnnualFee: toCents(f.currentFee),
    proposedAnnualFee: toCents(f.newFee),
  };
}

/** The engine input for Offer B, or undefined when there isn't one. */
export function toRefinanceInputB(f: RefinanceForm): RefinanceInput | undefined {
  const b = f.offerB;
  if (!b) return undefined;
  const a = toRefinanceInput(f);
  return {
    ...a,
    proposed: {
      annualRate: b.ratePct / 100,
      termMonths: a.proposed.termMonths,
    },
    switchingCosts: toCents(f.exitCosts + b.setupCosts),
    cashback: toCents(b.cashback),
    proposedAnnualFee: toCents(b.annualFee),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────
// Short keys keep shared links readable. Versioned so old links keep working.

export const REFINANCE_URL_VERSION = 1;

const FREQ = { weekly: "w", fortnightly: "f", monthly: "m" } as const;
const FREQ_BACK: Record<string, Frequency> = { w: "weekly", f: "fortnightly", m: "monthly" };

const NUM_KEYS = {
  b: "balance",
  r: "ratePct",
  t: "termYears",
  p: "repayment",
  cf: "currentFee",
  o: "offset",
  nr: "newRatePct",
  nt: "newTermYears",
  ir: "introRatePct",
  iy: "introYears",
  nf: "newFee",
  x: "exitCosts",
  s: "setupCosts",
  cb: "cashback",
  hv: "homeValue",
} as const satisfies Record<string, keyof RefinanceForm>;

export function encodeRefinance(f: RefinanceForm): string {
  const q = new URLSearchParams({ v: String(REFINANCE_URL_VERSION) });
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const v = f[field];
    if (v !== undefined) q.set(k, String(v));
  }
  q.set("f", FREQ[f.frequency]);
  if (f.fortnightlyMethod === "true") q.set("ft", "1");
  if (f.addCostsToLoan) q.set("cap", "1");
  q.set("k", f.repaymentChoice === "keep" ? "keep" : "min");
  q.set("d", f.startDate);
  if (f.offerB) {
    q.set("br", String(f.offerB.ratePct));
    q.set("bf", String(f.offerB.annualFee));
    q.set("bs", String(f.offerB.setupCosts));
    q.set("bc", String(f.offerB.cashback));
  }
  return q.toString();
}

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeRefinance(query: string, fallback = defaultRefinance()): RefinanceForm {
  const q = new URLSearchParams(query);
  if (q.get("v") !== String(REFINANCE_URL_VERSION)) return fallback;
  const f: RefinanceForm = { ...fallback };
  const optional = new Set<keyof RefinanceForm>([
    "repayment",
    "newTermYears",
    "introRatePct",
    "introYears",
    "homeValue",
  ]);
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const raw = q.get(k);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    if (Number.isFinite(n) && n >= 0) (f as unknown as Record<string, number>)[field] = n;
    else if (optional.has(field)) (f as unknown as Record<string, undefined>)[field] = undefined;
  }
  f.frequency = FREQ_BACK[q.get("f") ?? ""] ?? fallback.frequency;
  f.fortnightlyMethod = q.get("ft") === "1" ? "true" : "half-monthly";
  f.addCostsToLoan = q.get("cap") === "1";
  f.repaymentChoice = q.get("k") === "min" ? "minimum" : "keep";
  const d = q.get("d");
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) f.startDate = d;
  // Offer B is optional: older links have none.
  const nonNeg = (k: string, fb: number) => {
    const raw = q.get(k);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fb;
  };
  const br = q.get("br");
  if (br !== null && br !== "" && Number.isFinite(Number(br)) && Number(br) >= 0) {
    f.offerB = {
      ratePct: Number(br),
      annualFee: nonNeg("bf", 0),
      setupCosts: nonNeg("bs", f.setupCosts),
      cashback: nonNeg("bc", 0),
    };
  }
  return f;
}
