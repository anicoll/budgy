import {
  AU_STATES,
  type AuState,
  type BuyerType,
  type BuyingCostsInput,
  type Cents,
  type PropertyKind,
} from "@budgy/engine";

/** What the person types into the home buying costs tool, in dollars. */
export interface BuyingForm {
  state: AuState;
  price: number;
  deposit: number;
  buyer: BuyerType;
  property: PropertyKind;
  foreign: boolean;
  homeGuarantee: boolean;
  lmiOnLoan: boolean;
  conveyancing: number;
  inspections: number;
  loanFees: number;
  other: number;
  view: "costs" | "compare";
}

export function defaultBuying(): BuyingForm {
  return {
    state: "NSW",
    price: 850_000,
    deposit: 85_000,
    buyer: "firstHome",
    property: "existing",
    foreign: false,
    homeGuarantee: false,
    lmiOnLoan: false,
    conveyancing: 1_800,
    inspections: 600,
    loanFees: 0,
    other: 0,
    view: "costs",
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toBuyingInput(f: BuyingForm): BuyingCostsInput {
  return {
    state: f.state,
    price: toCents(f.price),
    deposit: toCents(Math.min(f.deposit, f.price)),
    buyer: f.buyer,
    property: f.property,
    foreign: f.foreign,
    homeGuarantee: f.homeGuarantee,
    lmiOnLoan: f.lmiOnLoan,
    other: {
      conveyancing: toCents(f.conveyancing),
      inspections: toCents(f.inspections),
      loanFees: toCents(f.loanFees),
      other: toCents(f.other),
    },
  };
}

// ── URL state ───────────────────────────────────────────────────────────────

export const BUYING_URL_VERSION = 1;

const NUM_KEYS = {
  p: "price",
  d: "deposit",
  cv: "conveyancing",
  i: "inspections",
  lf: "loanFees",
  o: "other",
} as const satisfies Record<string, keyof BuyingForm>;

const BUYERS: BuyerType[] = ["firstHome", "ownerOccupier", "investor"];
const PROPERTIES: PropertyKind[] = ["existing", "new", "land"];

export function encodeBuying(f: BuyingForm): string {
  const q = new URLSearchParams({ v: String(BUYING_URL_VERSION), s: f.state });
  for (const [k, field] of Object.entries(NUM_KEYS)) q.set(k, String(f[field]));
  q.set("b", f.buyer);
  q.set("k", f.property);
  if (f.foreign) q.set("fx", "1");
  if (f.homeGuarantee) q.set("hg", "1");
  if (f.lmiOnLoan) q.set("ml", "1");
  if (f.view === "compare") q.set("view", "compare");
  return q.toString();
}

/** Read the form from a query string. Anything missing or broken falls back. */
export function decodeBuying(query: string, fallback = defaultBuying()): BuyingForm {
  const q = new URLSearchParams(query);
  if (q.get("v") !== String(BUYING_URL_VERSION)) return fallback;
  const f: BuyingForm = { ...fallback };
  const s = q.get("s") as AuState;
  if (AU_STATES.includes(s)) f.state = s;
  for (const [k, field] of Object.entries(NUM_KEYS)) {
    const raw = q.get(k);
    const n = raw === null || raw === "" ? Number.NaN : Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1e9) f[field] = n;
  }
  const b = q.get("b") as BuyerType;
  if (BUYERS.includes(b)) f.buyer = b;
  const k = q.get("k") as PropertyKind;
  if (PROPERTIES.includes(k)) f.property = k;
  f.foreign = q.get("fx") === "1";
  f.homeGuarantee = q.get("hg") === "1";
  f.lmiOnLoan = q.get("ml") === "1";
  f.view = q.get("view") === "compare" ? "compare" : "costs";
  return f;
}

/**
 * A link to the buying costs tool for a home at `price` with `deposit`, both
 * in dollars. Keeps the rest of the buyer's saved buying form, if there is one.
 */
export function buyingLinkFor(price: number, deposit: number, saved?: string | null): string {
  const base = saved ? decodeBuying(saved) : defaultBuying();
  const p = Math.max(0, Math.floor(price / 1_000) * 1_000);
  return `../buying-costs/?${encodeBuying({ ...base, price: p, deposit: Math.min(Math.max(0, deposit), p), view: "costs" })}`;
}
