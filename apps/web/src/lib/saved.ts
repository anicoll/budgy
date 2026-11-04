import type { FortnightlyMethod, Frequency } from "@budgy/engine";

/**
 * Inputs remembered on this device, in localStorage. Nothing here is ever
 * sent anywhere. Each tool keeps its own inputs in the same versioned query
 * string its share link uses, so old saves keep working when a tool's shape
 * changes: its URL decoder already handles old versions and bad data.
 *
 * The loan itself (balance, rate, term, repayments, offset) is shared, so
 * changing it in one tool carries it into the others.
 */

export const SAVED_KEY = "budgy:saved";
export const SAVED_VERSION = 1;

/** Remember inputs unless the person has said not to. */
export const REMEMBER_BY_DEFAULT = true;

export type ToolKey =
  | "mortgage"
  | "debt"
  | "refinance"
  | "fixed"
  | "split"
  | "super"
  | "pay"
  | "borrow";

export interface SharedLoan {
  balance: number; // dollars
  ratePct: number;
  termYears: number;
  frequency: Frequency;
  fortnightlyMethod: FortnightlyMethod;
  offset: number; // dollars
}

export interface SavedData {
  v: typeof SAVED_VERSION;
  remember: boolean;
  loan: Partial<SharedLoan>;
  tools: Partial<Record<ToolKey, string>>;
}

/** The bits of Storage we use, so tests can pass a plain object. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TOOLS: ToolKey[] = [
  "mortgage",
  "debt",
  "refinance",
  "fixed",
  "split",
  "super",
  "pay",
  "borrow",
];
const FREQUENCIES: Frequency[] = ["weekly", "fortnightly", "monthly"];

export function emptySaved(remember = REMEMBER_BY_DEFAULT): SavedData {
  return { v: SAVED_VERSION, remember, loan: {}, tools: {} };
}

const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

/** Keep only loan fields that are present and sensible. */
export function cleanLoan(raw: unknown): Partial<SharedLoan> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<SharedLoan> = {};
  if (inRange(r.balance, 0, 1e9)) out.balance = r.balance;
  if (inRange(r.ratePct, 0, 100)) out.ratePct = r.ratePct;
  if (inRange(r.termYears, 0, 100)) out.termYears = r.termYears;
  if (FREQUENCIES.includes(r.frequency as Frequency)) out.frequency = r.frequency as Frequency;
  if (r.fortnightlyMethod === "true" || r.fortnightlyMethod === "half-monthly")
    out.fortnightlyMethod = r.fortnightlyMethod;
  if (inRange(r.offset, 0, 1e9)) out.offset = r.offset;
  return out;
}

/** Parse what's stored. Anything missing, old or broken gives a clean start. */
export function parseSaved(text: string | null): SavedData {
  if (!text) return emptySaved();
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || raw.v !== SAVED_VERSION) return emptySaved();
    const tools: SavedData["tools"] = {};
    if (raw.tools && typeof raw.tools === "object") {
      for (const t of TOOLS) {
        const q = raw.tools[t];
        if (typeof q === "string" && q.length < 20_000) tools[t] = q;
      }
    }
    return {
      v: SAVED_VERSION,
      remember: typeof raw.remember === "boolean" ? raw.remember : REMEMBER_BY_DEFAULT,
      loan: cleanLoan(raw.loan),
      tools,
    };
  } catch {
    return emptySaved();
  }
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // storage blocked
  }
}

export function readSaved(store = browserStore()): SavedData {
  try {
    return parseSaved(store?.getItem(SAVED_KEY) ?? null);
  } catch {
    return emptySaved();
  }
}

function writeSaved(data: SavedData, store: KeyValueStore | null): void {
  try {
    store?.setItem(SAVED_KEY, JSON.stringify(data));
  } catch {
    /* full or blocked: carry on without saving */
  }
}

/**
 * Save one tool's inputs and its part of the shared loan. Reads first so two
 * tabs on different tools don't undo each other. Does nothing when the person
 * has turned remembering off.
 */
export function saveTool(
  tool: ToolKey,
  query: string,
  loan: Partial<SharedLoan> = {},
  store = browserStore(),
): void {
  const data = readSaved(store);
  if (!data.remember) return;
  writeSaved(
    {
      ...data,
      loan: { ...data.loan, ...cleanLoan(loan) },
      tools: { ...data.tools, [tool]: query },
    },
    store,
  );
}

/** Wipe everything saved and stop remembering on this device. */
export function forgetAll(store = browserStore()): void {
  try {
    store?.removeItem(SAVED_KEY);
  } catch {
    /* blocked */
  }
  writeSaved(emptySaved(false), store);
}

/** Start remembering again. */
export function rememberAgain(store = browserStore()): void {
  writeSaved({ ...readSaved(store), remember: true }, store);
}

/** Put only the present fields of `loan` onto `target`. */
export function withLoanFields<T extends object>(target: T, loan: Partial<SharedLoan>): T {
  const clean = cleanLoan(loan);
  const out = { ...target } as Record<string, unknown>;
  for (const [k, v] of Object.entries(clean)) if (k in out) out[k] = v;
  return out as T;
}

/** True when a query string carries a tool's state (every tool versions with `v`). */
export function queryHasState(query: string): boolean {
  return new URLSearchParams(query).has("v");
}

/** A link from one of our own tools: open it as the person's own inputs. */
export const OWN_LINK_PARAM = "mine";

export type SavedMode = "saved" | "link" | "off";

/**
 * Decide what a tool opens with. A link someone shared wins but is not saved
 * over the person's own inputs. A reload of the person's own page (URL equal
 * to what's saved) or a link from another of our tools counts as their own.
 */
export function startingPoint(
  tool: ToolKey,
  search: string,
  data: SavedData,
): { query: string | null; mode: SavedMode } {
  const params = new URLSearchParams(search);
  const own = params.get(OWN_LINK_PARAM) === "1";
  params.delete(OWN_LINK_PARAM);
  const urlQuery = params.toString();
  const saved = data.tools[tool] ?? null;
  const base: SavedMode = data.remember ? "saved" : "off";
  if (!queryHasState(urlQuery)) return { query: data.remember ? saved : null, mode: base };
  if (own) return { query: data.remember && saved ? saved : urlQuery, mode: base };
  if (data.remember && saved === urlQuery) return { query: saved, mode: "saved" };
  return { query: urlQuery, mode: data.remember ? "link" : "off" };
}
