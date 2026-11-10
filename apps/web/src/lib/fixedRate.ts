import type {
  Cents,
  FixedVsVariableInput,
  FortnightlyMethod,
  Frequency,
  RateChange,
  RatePathPreset,
} from "@budgy/engine";
import { addMonths, presetPath, RATE_PATH_PRESETS } from "@budgy/engine";
import { today } from "@/lib/state";

/** One step of a custom rate path: from this many months out, this rate. */
export interface PathStep {
  months: number;
  ratePct: number;
}

export type PathChoice = RatePathPreset | "custom";

/**
 * What the person types into the fixed or variable tool, in dollars, percent
 * and years. The URL holds exactly this.
 */
export interface FixedForm {
  balance: number;
  termYears: number;
  frequency: Frequency;
  fortnightlyMethod: FortnightlyMethod;
  extra: number; // dollars per repayment, on the variable part
  offset: number;
  variableRatePct: number;
  path: PathChoice;
  customPath: PathStep[];
  fixedRatePct: number;
  fixedYears: number;
  fixedSharePct: number; // 0 to 100
  revertMarginPct: number;
  lockFee: number; // dollars, a one-off cost of fixing
  breakAfterYears: number;
  breakDropPct: number; // how far fixed rates have fallen when you break
  startDate: string;
}

export function defaultFixed(start = today()): FixedForm {
  return {
    balance: 600_000,
    termYears: 25,
    frequency: "monthly",
    fortnightlyMethod: "half-monthly",
    extra: 0,
    offset: 0,
    variableRatePct: 5.99,
    path: "hold",
    customPath: [],
    fixedRatePct: 5.69,
    fixedYears: 3,
    fixedSharePct: 50,
    revertMarginPct: 0,
    lockFee: 0,
    breakAfterYears: 1,
    breakDropPct: 1,
    startDate: start,
  };
}

export const PATH_CHOICES = Object.keys(RATE_PATH_PRESETS) as RatePathPreset[];

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** A preset as editable steps, so "Customise" starts from what's on screen. */
export function presetSteps(preset: RatePathPreset, variableRatePct: number): PathStep[] {
  return RATE_PATH_PRESETS[preset].steps.map(([months, change]) => ({
    months,
    ratePct: Math.max(0, Math.round((variableRatePct + change * 100) * 100) / 100),
  }));
}

/** The variable rate path for a choice, as dated rate changes. */
export function pathFor(
  path: PathChoice,
  f: Pick<FixedForm, "customPath" | "startDate" | "variableRatePct">,
): RateChange[] {
  if (path !== "custom") return presetPath(path, f.startDate, f.variableRatePct / 100);
  return [...f.customPath]
    .filter((s) => s.months > 0)
    .sort((a, b) => a.months - b.months)
    .map((s) => ({ date: addMonths(f.startDate, s.months), annualRate: round4(s.ratePct / 100) }));
}

export function toFixedInput(
  f: FixedForm,
  overrides: { path?: PathChoice; fixedSharePct?: number } = {},
): FixedVsVariableInput {
  return {
    loan: {
      balance: toCents(f.balance),
      annualRate: f.variableRatePct / 100,
      termMonths: Math.round(f.termYears * 12),
      startDate: f.startDate,
      frequency: f.frequency,
      fortnightlyMethod: f.fortnightlyMethod,
      extraPerPeriod: toCents(f.extra),
      offsetBalance: toCents(f.offset),
      rateChanges: pathFor(overrides.path ?? f.path, f),
    },
    fixedRate: f.fixedRatePct / 100,
    fixedMonths: Math.round(f.fixedYears * 12),
    fixedShare: (overrides.fixedSharePct ?? f.fixedSharePct) / 100,
    revertMargin: f.revertMarginPct / 100,
    fixingFee: toCents(Math.min(f.lockFee, 20_000)),
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const FIXED_URL_VERSION = 1;

const FREQ = { weekly: "w", fortnightly: "f", monthly: "m" } as const;
const FREQ_BACK: Record<string, Frequency> = { w: "weekly", f: "fortnightly", m: "monthly" };

const NUM_KEYS = {
  b: "balance",
  t: "termYears",
  x: "extra",
  o: "offset",
  vr: "variableRatePct",
  fr: "fixedRatePct",
  fy: "fixedYears",
  fs: "fixedSharePct",
  rm: "revertMarginPct",
  lf: "lockFee",
  ba: "breakAfterYears",
  bd: "breakDropPct",
} as const satisfies Record<string, keyof FixedForm>;

/** Fields that may be negative. */
const SIGNED = new Set<keyof FixedForm>(["revertMarginPct"]);

export function encodeFixed(f: FixedForm): string {
  const q = new URLSearchParams({ v: String(FIXED_URL_VERSION) });
  for (const [k, field] of Object.entries(NUM_KEYS)) q.set(k, String(f[field]));
  q.set("f", FREQ[f.frequency]);
  if (f.fortnightlyMethod === "true") q.set("ft", "1");
  q.set("p", f.path === "custom" ? "c" : f.path);
  if (f.path === "custom")
    q.set("cp", f.customPath.map((s) => `${s.months}:${s.ratePct}`).join(","));
  q.set("d", f.startDate);
  return q.toString();
}

function decodeSteps(raw: string | null): PathStep[] {
  if (!raw) return [];
  const steps: PathStep[] = [];
  for (const part of raw.split(",").slice(0, 24)) {
    const [m, r] = part.split(":").map(Number);
    if (Number.isInteger(m) && m >= 1 && m <= 480 && Number.isFinite(r) && r >= 0 && r <= 20)
      steps.push({ months: m, ratePct: r });
  }
  return steps;
}

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeFixed(query: string, fallback = defaultFixed()): FixedForm {
  const q = new URLSearchParams(query);
  if (q.get("v") !== String(FIXED_URL_VERSION)) return fallback;
  const f: FixedForm = { ...fallback };
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const raw = q.get(k);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    if (Number.isFinite(n) && (n >= 0 || SIGNED.has(field)))
      (f as unknown as Record<string, number>)[field] = n;
  }
  f.frequency = FREQ_BACK[q.get("f") ?? ""] ?? fallback.frequency;
  f.fortnightlyMethod = q.get("ft") === "1" ? "true" : "half-monthly";
  const p = q.get("p");
  if (p === "c") {
    f.path = "custom";
    f.customPath = decodeSteps(q.get("cp"));
  } else if (p && (PATH_CHOICES as string[]).includes(p)) {
    f.path = p as RatePathPreset;
    f.customPath = [];
  }
  const d = q.get("d");
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) f.startDate = d;
  return f;
}
