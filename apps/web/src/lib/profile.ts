import type { ToolKey } from "./saved";
import { TOOLS } from "./tools";

/** The home page questions. No numbers: those stay in each tool. */
export type Earn = "salary" | "self" | "none";
export type Home = "loan" | "buying" | "neither";
export type DebtKind = "help" | "card" | "car" | "personal";
export type Lease = "have" | "thinking" | "no";
export type Who = "me" | "two";

export interface Profile {
  earn: Earn;
  home: Home;
  debts: DebtKind[];
  lease: Lease;
  who: Who;
}

export const PROFILE_VERSION = 1;

const EARN: Earn[] = ["salary", "self", "none"];
const HOME: Home[] = ["loan", "buying", "neither"];
const DEBTS: DebtKind[] = ["help", "card", "car", "personal"];
const LEASE: Lease[] = ["have", "thinking", "no"];
const WHO: Who[] = ["me", "two"];

/** What the questions start on before anyone taps. */
export function defaultProfile(): Profile {
  return { earn: "salary", home: "loan", debts: [], lease: "no", who: "me" };
}

const pick = <T extends string>(list: T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

/** Read saved answers. Anything missing, old or broken gives null: ask again. */
export function parseProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== PROFILE_VERSION) return null;
  const d = defaultProfile();
  return {
    earn: pick(EARN, r.earn, d.earn),
    home: pick(HOME, r.home, d.home),
    debts: Array.isArray(r.debts) ? DEBTS.filter((k) => (r.debts as unknown[]).includes(k)) : [],
    lease: pick(LEASE, r.lease, d.lease),
    who: pick(WHO, r.who, d.who),
  };
}

/** The shape saved on the device. */
export function storeProfile(p: Profile): Record<string, unknown> {
  return { v: PROFILE_VERSION, ...p, debts: [...p.debts] };
}

export interface JourneyStep {
  key: ToolKey;
  /** A few words on why it's in the plan. */
  why: string;
}

/**
 * The tools that fit someone's answers, in the order the guided plan walks
 * them: their numbers first (pay, home loan, other debts), then ways to get
 * ahead. Each answer only adds or drops steps, so most people get the same
 * shape of plan.
 */
export function buildJourney(p: Profile): JourneyStep[] {
  const steps: JourneyStep[] = [];
  const add = (key: ToolKey, why: string) => steps.push({ key, why });
  const salary = p.earn === "salary";
  const consumer = p.debts.some((d) => d !== "help");
  const help = p.debts.includes("help");
  const loan = p.home === "loan";

  // Your numbers.
  if (p.earn !== "none") add("pay", "your take-home pay");
  if (loan) add("mortgage", "your home loan");
  if (loan && p.who === "two") add("split", "who pays what");
  if (p.home === "buying") {
    add("borrow", "what a bank might lend");
    add("buying", "the costs on top of the price");
  }
  if (consumer) add("debt", "your other debts");

  // Ways to get ahead.
  if (loan) {
    add("rates", "compare your rate");
    add("refinance", "is switching worth it");
    add("fixed", "fix or stay variable");
  }
  if (help) add("help", "lump sum or offset");
  if (p.lease !== "no" && salary)
    add("lease", p.lease === "have" ? "check your lease" : "is a lease worth it");
  if (salary) add("sacrifice", "extra into super");
  if (salary && loan) add("super-mortgage", "where spare cash goes");
  if (salary) add("super", p.who === "two" ? "for both of you" : "where you're headed");
  add("budget", "see where it all goes");
  return steps;
}

/** Tools not in someone's plan, in the site's usual order. */
export function otherTools(p: Profile): ToolKey[] {
  const inPlan = new Set(buildJourney(p).map((s) => s.key));
  return TOOLS.map((t) => t.key).filter((k) => !inPlan.has(k));
}

/** Where someone is in the plan: done means the tool has saved inputs. */
export function planProgress(
  steps: JourneyStep[],
  saved: Partial<Record<ToolKey, string>>,
): { done: Set<ToolKey>; next: ToolKey | null } {
  const done = new Set(steps.filter((s) => Boolean(saved[s.key])).map((s) => s.key));
  const next = steps.find((s) => !done.has(s.key))?.key ?? null;
  return { done, next };
}
