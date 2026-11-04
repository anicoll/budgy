import type { Cents, Debt, DebtStrategy, PayoffInput } from "@budgy/engine";
import { b64urlDecode, b64urlEncode, today } from "./state";

/** One debt as the person types it, in dollars and percent. */
export interface DebtRow {
  id: string;
  name: string;
  balance: number;
  ratePct: number;
  minType: "fixed" | "percent";
  minAmount: number; // fixed: dollars a month
  minPct: number; // percent: e.g. 2 for 2%
  minFloor: number; // percent: dollars, the least it can be
}

export type PlanStrategy = Exclude<DebtStrategy, "minimums">;

export interface DebtPlanState {
  debts: DebtRow[];
  extra: number; // dollars a month on top of the minimums
  strategy: PlanStrategy;
  order: string[]; // custom priority, debt ids
  startDate: string;
  target?: string; // optional "debt-free by" date
}

export const MAX_ROWS = 12;

export function newDebt(id: string, kind: "card" | "loan" = "loan"): DebtRow {
  return kind === "card"
    ? {
        id,
        name: "Credit card",
        balance: 3_000,
        ratePct: 20.99,
        minType: "percent",
        minAmount: 0,
        minPct: 2,
        minFloor: 25,
      }
    : {
        id,
        name: "Loan",
        balance: 5_000,
        ratePct: 12,
        minType: "fixed",
        minAmount: 150,
        minPct: 2,
        minFloor: 25,
      };
}

export function nextId(debts: DebtRow[]): string {
  const n = Math.max(0, ...debts.map((d) => Number(d.id.slice(1)) || 0));
  return `d${n + 1}`;
}

export function defaultDebtState(start = today()): DebtPlanState {
  return {
    debts: [
      { ...newDebt("d1", "card"), balance: 4_000 },
      { ...newDebt("d2"), name: "Car loan", balance: 18_000, ratePct: 8.9, minAmount: 450 },
      { ...newDebt("d3"), name: "Personal loan", balance: 1_500, ratePct: 12.9, minAmount: 120 },
    ],
    extra: 200,
    strategy: "avalanche",
    order: ["d1", "d2", "d3"],
    startDate: start,
  };
}

const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

export function toDebt(r: DebtRow): Debt {
  return {
    id: r.id,
    name: r.name || "Debt",
    balance: toCents(r.balance),
    annualRate: r.ratePct / 100,
    minimum:
      r.minType === "percent"
        ? { type: "percent", percent: r.minPct / 100, floor: toCents(r.minFloor) }
        : { type: "fixed", amount: toCents(r.minAmount) },
  };
}

export function toPayoffInput(s: DebtPlanState): Omit<PayoffInput, "strategy"> {
  return {
    debts: s.debts.map(toDebt),
    extraPerMonth: toCents(s.extra),
    order: s.order,
    startDate: s.startDate,
  };
}

/** Keep the custom order in step with the debt list: drop removed ids, append new ones. */
export function syncOrder(order: string[], debts: DebtRow[]): string[] {
  const ids = debts.map((d) => d.id);
  return [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
}

// ── URL state ───────────────────────────────────────────────────────────────

export const DEBT_URL_VERSION = 1;

const STRATS: PlanStrategy[] = ["avalanche", "snowball", "custom"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function encodeDebtState(s: DebtPlanState): string {
  const compact = {
    d: s.debts.map((r) => [
      r.id,
      r.name,
      r.balance,
      r.ratePct,
      r.minType === "percent" ? 1 : 0,
      r.minAmount,
      r.minPct,
      r.minFloor,
    ]),
    x: s.extra,
    k: STRATS.indexOf(s.strategy),
    o: s.order,
    t: s.startDate,
    g: s.target,
  };
  return new URLSearchParams({
    v: String(DEBT_URL_VERSION),
    s: b64urlEncode(JSON.stringify(compact)),
  }).toString();
}

export function decodeDebtState(query: string, fallback = defaultDebtState()): DebtPlanState {
  try {
    const params = new URLSearchParams(query);
    const raw = params.get("s");
    if (!raw || params.get("v") !== String(DEBT_URL_VERSION)) return fallback;
    const c = JSON.parse(b64urlDecode(raw));
    const seen = new Set<string>();
    const debts: DebtRow[] = (Array.isArray(c.d) ? c.d : [])
      .filter((r: unknown) => Array.isArray(r))
      .slice(0, MAX_ROWS)
      .map((r: unknown[], i: number) => {
        let id = typeof r[0] === "string" && /^d\d{1,4}$/.test(r[0]) ? r[0] : `d${i + 1}`;
        if (seen.has(id)) id = `d${900 + i}`;
        seen.add(id);
        return {
          id,
          name: typeof r[1] === "string" ? r[1].slice(0, 40) : `Debt ${i + 1}`,
          balance: Math.max(0, num(r[2], 0)),
          ratePct: Math.min(100, Math.max(0, num(r[3], 0))),
          minType: r[4] === 1 ? "percent" : "fixed",
          minAmount: Math.max(0, num(r[5], 0)),
          minPct: Math.min(100, Math.max(0, num(r[6], 2))),
          minFloor: Math.max(0, num(r[7], 0)),
        };
      });
    if (!debts.length) return fallback;
    return {
      debts,
      extra: Math.max(0, num(c.x, 0)),
      strategy: STRATS[c.k] ?? "avalanche",
      order: syncOrder(
        Array.isArray(c.o) ? c.o.filter((x: unknown) => typeof x === "string") : [],
        debts,
      ),
      startDate: isDate(c.t) ? c.t : fallback.startDate,
      target: isDate(c.g) ? c.g : undefined,
    };
  } catch {
    return fallback;
  }
}
