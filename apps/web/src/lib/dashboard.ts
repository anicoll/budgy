import {
  type Cents,
  calculatePay,
  checkRate,
  compareHelpEarly,
  compareStrategies,
  simulateLoan,
} from "@budgy/engine";
import { decodeDebtState, toPayoffInput } from "./debtState";
import { money, monthYear } from "./format";
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
  if (!loan) return null;
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
    const extra = loan.frequency === "monthly" ? 200 : loan.frequency === "fortnightly" ? 100 : 50;
    const now = simulateLoan(input);
    const more = simulateLoan({ ...input, extraPerPeriod: C(extra) });
    const saved = now.totalInterest - more.totalInterest;
    if (saved <= 0) return null;
    const per = { weekly: "week", fortnightly: "fortnight", monthly: "month" }[loan.frequency];
    return {
      key: "mortgage",
      area: "Home loan",
      headline: `${money(saved)} less interest`,
      text: `An extra $${extra} a ${per} on the home loan could pay it off by ${monthYear(more.payoffDate)} instead of ${monthYear(now.payoffDate)}.`,
    };
  });
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
