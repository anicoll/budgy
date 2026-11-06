import {
  budgetForView,
  type Cents,
  calculatePay,
  checkRate,
  compareHelpEarly,
  compareStrategies,
  perView,
  planBudget,
  type SimulationResult,
  simulateLoan,
  simulatePayoff,
} from "@budgy/engine";
import { decodeBudgetState, toBudgetInput } from "./budgetState";
import { decodeDebtState, toPayoffInput } from "./debtState";
import { money, monthYear, monthYearShort } from "./format";
import { decodeHelp, toHelpInput } from "./helpState";
import { decodePayState, toPayInput } from "./payState";
import { decodeRateCheck, toRateCheckInput } from "./rateCheck";
import type { SavedData, SharedLoan, ToolKey } from "./saved";
import { today } from "./state";

/** One tile in the "at a glance" row. Missing means the tool has nothing saved. */
export interface Tile {
  key: ToolKey;
  label: string;
  value: string;
  sub: string;
}

export interface Idea {
  key: ToolKey;
  area: string;
  headline: string;
  text: string;
}

const C = (dollars: number) => Math.round(dollars * 100) as Cents;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Run a calculation on saved inputs; anything that doesn't add up is left out. */
function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

function payTile(q: string): Tile | null {
  return attempt(() => {
    const r = calculatePay(toPayInput(decodePayState(q)));
    if (r.gross <= 0) return null;
    return {
      key: "pay",
      label: "Take-home pay",
      value: money(r.periods.fortnightly.net),
      sub: "a fortnight, after tax and Medicare",
    };
  });
}

/** The saved home loan, if a loan tool has filled in enough of it. */
export function savedLoan(data: SavedData): SharedLoan | null {
  const l = data.loan;
  if (!l.balance || !l.ratePct || !l.termYears) return null;
  return {
    balance: l.balance,
    ratePct: l.ratePct,
    termYears: l.termYears,
    frequency: l.frequency ?? "monthly",
    fortnightlyMethod: l.fortnightlyMethod ?? "half-monthly",
    offset: l.offset ?? 0,
  };
}

function loanTile(loan: SharedLoan): Tile {
  const offset = loan.offset > 0 ? `, ${money(C(loan.offset))} in offset` : "";
  return {
    key: "mortgage",
    label: "Home loan",
    value: money(C(loan.balance)),
    sub: `${loan.ratePct}% with ${plural(loan.termYears, "year")} left${offset}`,
  };
}

function debtTile(q: string): Tile | null {
  return attempt(() => {
    const s = decodeDebtState(q);
    const owing = s.debts.filter((d) => d.balance > 0);
    if (!owing.length) return null;
    const total = owing.reduce((sum, d) => sum + d.balance, 0);
    const names = owing.map((d) => d.name || "Debt");
    return {
      key: "debt",
      label: "Other debts",
      value: money(C(total)),
      sub: names.length <= 2 ? names.join(" and ") : `${names.length} debts`,
    };
  });
}

function helpTile(q: string): Tile | null {
  return attempt(() => {
    const f = decodeHelp(q);
    if (f.balance <= 0) return null;
    const r = compareHelpEarly({ ...toHelpInput(f), lumpSum: 0 as Cents });
    const cleared = r.keep.clearedIn;
    return {
      key: "help",
      label: "HELP debt",
      value: money(C(f.balance)),
      sub: cleared ? `Paid off in ${cleared} at this pace` : "Not paid off on current income",
    };
  });
}

/** The "at a glance" numbers, from whatever the tools have saved. */
export function snapshot(data: SavedData): Tile[] {
  const tiles: (Tile | null)[] = [];
  if (data.tools.pay) tiles.push(payTile(data.tools.pay));
  const loan = savedLoan(data);
  if (loan) tiles.push(loanTile(loan));
  if (data.tools.debt) tiles.push(debtTile(data.tools.debt));
  if (data.tools.help) tiles.push(helpTile(data.tools.help));
  return tiles.filter((t): t is Tile => t !== null);
}

function rateIdea(data: SavedData, loan: SharedLoan | null): Idea | null {
  return attempt(() => {
    // The rate check knows the loan type; otherwise assume a variable P&I home loan.
    const form = data.tools.rates ? decodeRateCheck(data.tools.rates) : null;
    const base = form ?? (loan ? { ...decodeRateCheck(""), ...loan } : null);
    if (!base) return null;
    const r = checkRate(toRateCheckInput(base));
    const gap = r.newLoans;
    if (gap.gap < 0.001 || gap.firstYearInterestGap <= 0) return null;
    return {
      key: "rates",
      area: "Home loan",
      headline: `About ${money(gap.firstYearInterestGap)} a year`,
      text: `Your rate is ${(gap.gap * 100).toFixed(2)}% above the Reserve Bank's average for new loans like yours. That gap is what it costs you over the next year.`,
    };
  });
}

function extraIdea(loan: SharedLoan | null): Idea | null {
  const o = loan ? loanOutlook(loan) : null;
  if (!o || o.saved <= 0) return null;
  return {
    key: "mortgage",
    area: "Home loan",
    headline: `${money(o.saved)} less interest`,
    text: `An extra $${o.extra} ${o.per} on the home loan could pay it off by ${monthYear(o.more.payoffDate)} instead of ${monthYear(o.now.payoffDate)}.`,
  };
}

function debtIdea(q: string | undefined): Idea | null {
  if (!q) return null;
  return attempt(() => {
    const s = decodeDebtState(q);
    if (!s.debts.some((d) => d.balance > 0)) return null;
    const extra = s.extra > 0 ? s.extra : 100;
    const c = compareStrategies({ ...toPayoffInput(s), extraPerMonth: C(extra), order: [] });
    const best = c.avalanche;
    if (!best.paidOff) return null;
    const interest = c.minimums.totalInterest - best.totalInterest;
    if (interest <= 0) return null;
    return {
      key: "debt",
      area: "Debt",
      headline: `${money(interest)} less interest`,
      text: `Putting $${extra} a month on top of the minimums, highest rate first, clears your debts by ${monthYear(best.debtFreeDate)}.`,
    };
  });
}

function helpIdea(q: string | undefined): Idea | null {
  if (!q) return null;
  return attempt(() => {
    const f = decodeHelp(q);
    if (f.balance <= 0 || f.lumpSum <= 0) return null;
    const r = compareHelpEarly(toHelpInput(f));
    const where = f.alternative === "offset" ? "your offset" : "savings";
    if (r.advantage > 0)
      return {
        key: "help",
        area: "HELP",
        headline: `${money(r.advantage)} ahead`,
        text: `Putting ${money(C(f.lumpSum))} on your HELP debt now looks better than keeping it in ${where}.`,
      };
    return {
      key: "help",
      area: "HELP",
      headline: `Keep it in ${where}`,
      text: `Your ${money(C(f.lumpSum))} likely does more in ${where}, about ${money(-r.advantage)} more, than on your HELP debt.`,
    };
  });
}

/** Rough ways to get ahead, from saved inputs only. Empty until tools are filled in. */
export function ideas(data: SavedData, inPlan: Set<ToolKey>): Idea[] {
  const loan = inPlan.has("mortgage") || inPlan.has("rates") ? savedLoan(data) : null;
  return [
    inPlan.has("rates") ? rateIdea(data, loan) : null,
    inPlan.has("debt") ? debtIdea(data.tools.debt) : null,
    inPlan.has("mortgage") ? extraIdea(loan) : null,
    inPlan.has("help") ? helpIdea(data.tools.help) : null,
  ].filter((i): i is Idea => i !== null);
}

// ── Pictures for the dashboard ──────────────────────────────────────────────

export interface FlowPart {
  label: string;
  /** Cents a fortnight. */
  amount: Cents;
}

/** Where a fortnight's take-home pay goes. */
export interface CashFlow {
  /** Take-home a fortnight. */
  income: Cents;
  /** Income less spending, or null when there's no budget yet. */
  left: Cents | null;
  /** The biggest budget categories, then everything else. Empty without a budget. */
  parts: FlowPart[];
}

/** From the budget planner if it's filled in, else just take-home from the pay calculator. */
export function cashFlow(data: SavedData): CashFlow | null {
  const q = data.tools.budget;
  const fromBudget = q
    ? attempt((): CashFlow | null => {
        const r = planBudget(toBudgetInput(decodeBudgetState(q)));
        const v = budgetForView(r, "fortnight");
        if (v.income <= 0 && v.spend <= 0) return null;
        const cats = r.categories.filter((c) => c.year > 0).sort((a, b) => b.year - a.year);
        const parts: FlowPart[] = cats
          .slice(0, 3)
          .map((c) => ({ label: c.name, amount: perView(c.year, "fortnight") }));
        const rest = cats.slice(3).reduce((t, c) => t + c.year, 0) as Cents;
        if (rest > 0) parts.push({ label: "Everything else", amount: perView(rest, "fortnight") });
        return { income: v.income, left: v.left, parts };
      })
    : null;
  if (fromBudget) return fromBudget;
  const p = data.tools.pay;
  if (!p) return null;
  return attempt(() => {
    const r = calculatePay(toPayInput(decodePayState(p)));
    if (r.gross <= 0) return null;
    return { income: r.periods.fortnightly.net, left: null, parts: [] };
  });
}

/** The home loan as it is, and with a little extra each repayment. */
export interface LoanOutlook {
  loan: SharedLoan;
  repayment: Cents;
  /** "a month", "a fortnight" or "a week". */
  per: string;
  /** Extra dollars each repayment in the "more" run. */
  extra: number;
  now: SimulationResult;
  more: SimulationResult;
  /** Interest the extra saves. */
  saved: Cents;
}

const EXTRA = { monthly: 200, fortnightly: 100, weekly: 50 } as const;
const PER = { weekly: "a week", fortnightly: "a fortnight", monthly: "a month" } as const;

export function loanOutlook(loan: SharedLoan): LoanOutlook | null {
  return attempt(() => {
    const input = {
      balance: C(loan.balance),
      annualRate: loan.ratePct / 100,
      termMonths: Math.round(loan.termYears * 12),
      startDate: today(),
      frequency: loan.frequency,
      fortnightlyMethod: loan.fortnightlyMethod,
      offsetBalance: C(loan.offset),
    };
    const extra = EXTRA[loan.frequency];
    const now = simulateLoan(input);
    const more = simulateLoan({ ...input, extraPerPeriod: C(extra) });
    if (!now.paidOff) return null;
    return {
      loan,
      repayment: now.repayment,
      per: PER[loan.frequency],
      extra,
      now,
      more,
      saved: (now.totalInterest - more.totalInterest) as Cents,
    };
  });
}

/** One debt on the dashboard. */
export interface DebtLine {
  key: ToolKey;
  name: string;
  balance: Cents;
  /** "20.99%, cleared by Jun 2028". */
  note: string;
}

const pct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

/** Each debt from the debt planner, on the plan it's set to, and HELP. Biggest first. */
export function debtList(data: SavedData): DebtLine[] {
  const out: DebtLine[] = [];
  const q = data.tools.debt;
  if (q) {
    const lines = attempt(() => {
      const s = decodeDebtState(q);
      const input = toPayoffInput(s);
      const r = simulatePayoff({ ...input, strategy: s.strategy });
      return input.debts.flatMap((d, i): DebtLine[] => {
        if (d.balance <= 0) return [];
        const o = r.debts[i];
        const when = o?.payoffDate
          ? `cleared by ${monthYearShort(o.payoffDate)}`
          : "not cleared at this pace";
        return [
          {
            key: "debt",
            name: d.name || "Debt",
            balance: d.balance,
            note: `${pct(d.annualRate)}, ${when}`,
          },
        ];
      });
    });
    if (lines) out.push(...lines);
  }
  const h = data.tools.help;
  if (h) {
    const line = attempt((): DebtLine | null => {
      const f = decodeHelp(h);
      if (f.balance <= 0) return null;
      const r = compareHelpEarly({ ...toHelpInput(f), lumpSum: 0 as Cents });
      const cleared = r.keep.clearedIn;
      return {
        key: "help",
        name: "HELP",
        balance: C(f.balance),
        note: cleared ? `paid off in ${cleared}` : "not paid off on current income",
      };
    });
    if (line) out.push(line);
  }
  return out.sort((a, b) => b.balance - a.balance);
}
