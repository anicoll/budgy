import { calculatePay } from "@budgy/engine";
import type { BorrowForm } from "./borrowState";
import { type BudgetState, newPerson as newBudgetPerson } from "./budgetState";
import type { HelpForm } from "./helpState";
import type { LeaseState } from "./leaseState";
import { annualise, fromAnnual, type PayState, toPayInput } from "./payState";
import { newPerson as newSacrificePerson, type SacrificeState } from "./sacrificeState";
import type { SharedPerson } from "./saved";
import type { SplitState } from "./splitState";
import { newSomPerson, type SomState } from "./superMortgageState";
import type { SuperState } from "./superState";

/**
 * The people a plan is for, shared by every tool that asks about them, the
 * way the home loan is: change a salary or a name in one tool and the others
 * open with it. Person 1 is "you", person 2 your partner.
 *
 * Each tool says how its own inputs map onto the shared people (`read`) and
 * back (`apply`). `apply` only fills in what's shared; a fresh tool (nothing
 * saved yet) is also sized to the household from the home page answers.
 */

export interface PeopleContext {
  /** Nothing saved for this tool yet. */
  fresh: boolean;
  /** 1 or 2 from the home page answers, or null if they haven't been given. */
  household: 1 | 2 | null;
}

export interface PeopleMap<T> {
  read: (state: T) => SharedPerson[];
  apply: (state: T, people: SharedPerson[], ctx: PeopleContext) => T;
}

/** Names that are ours, not the person's: never shared, and replaced when we know better. */
const PLACEHOLDERS = new Set(["", "you", "partner", "alex", "sam", "person 1", "person 2"]);
export const isPlaceholderName = (name: string | undefined) =>
  PLACEHOLDERS.has((name ?? "").trim().toLowerCase());

export const defaultName = (i: number) =>
  i === 0 ? "You" : i === 1 ? "Partner" : `Person ${i + 1}`;

/** A name worth sharing, or nothing. */
const shareName = (name: string) => (isPlaceholderName(name) ? undefined : name.trim());

/** The shared name, else our placeholder for that place (replacing old ones like "Alex"). */
function nameFor(current: string, shared: SharedPerson | undefined, i: number): string {
  if (shared?.name) return shared.name;
  return isPlaceholderName(current) ? defaultName(i) : current;
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Keep only fields that are set, so a tool never clears what another knows. */
function compact(p: SharedPerson): SharedPerson {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as SharedPerson;
}

/** Fit a list to the household size on a fresh open; otherwise leave it. */
function sized<T>(list: T[], ctx: PeopleContext, make: (i: number) => T, min = 1): T[] {
  if (!ctx.fresh || ctx.household === null) return list;
  const want = Math.max(min, ctx.household);
  if (list.length > want) return list.slice(0, want);
  const out = [...list];
  while (out.length < want) out.push(make(out.length));
  return out;
}

// ── Pay calculator ──────────────────────────────────────────────────────────

/** Base salary a year, before tax and without employer super. */
export function paySalary(s: PayState): number | undefined {
  try {
    return Math.round(calculatePay(toPayInput(s)).salary / 100);
  } catch {
    return undefined;
  }
}

/** Put a yearly base salary on the pay calculator, keeping how it's entered. */
export function withPaySalary(s: PayState, salary: number): PayState {
  const now = paySalary(s);
  if (now !== undefined && same(now, salary)) return s;
  const typed = s.includesSuper ? salary * (1 + (s.superPct ?? 12) / 100) : salary;
  return { ...s, amount: fromAnnual(typed, s.per, s.hoursPerWeek) };
}

function payPerson(s: PayState): SharedPerson {
  return compact({
    salary: annualise(s.amount, s.per, s.hoursPerWeek) > 0 ? paySalary(s) : undefined,
    help: s.studyLoan,
    hospitalCover: s.hospitalCover,
  });
}

function applyPay(s: PayState, p: SharedPerson | undefined): PayState {
  if (!p) return s;
  let out = p.salary !== undefined ? withPaySalary(s, p.salary) : s;
  if (p.help !== undefined) out = { ...out, studyLoan: p.help };
  if (p.hospitalCover !== undefined) out = { ...out, hospitalCover: p.hospitalCover };
  return out;
}

export const PAY_PEOPLE: PeopleMap<PayState> = {
  read: (s) => [payPerson(s)],
  apply: (s, people) => applyPay(s, people[0]),
};

// ── Budget planner ──────────────────────────────────────────────────────────

export const BUDGET_PEOPLE: PeopleMap<BudgetState> = {
  read: (s) =>
    s.people.map((p) =>
      compact({ name: shareName(p.name), ...(p.mode === "salary" ? payPerson(p.pay) : {}) }),
    ),
  apply: (s, people, ctx) => {
    const list = sized(s.people, ctx, (i) => newBudgetPerson(defaultName(i)));
    return {
      ...s,
      people: list.map((p, i) => ({
        ...p,
        name: nameFor(p.name, people[i], i),
        pay: p.mode === "salary" ? applyPay(p.pay, people[i]) : p.pay,
      })),
    };
  },
};

// ── Salary sacrifice ────────────────────────────────────────────────────────

export const SACRIFICE_PEOPLE: PeopleMap<SacrificeState> = {
  read: (s) =>
    s.people.map((p) =>
      compact({
        name: shareName(p.name),
        salary: p.salary,
        help: p.studyLoan,
        hospitalCover: p.hospitalCover,
      }),
    ),
  apply: (s, people, ctx) => {
    const list = sized(s.people, ctx, (i) => newSacrificePerson(`p${i + 1}`, defaultName(i)));
    const mode =
      ctx.fresh && ctx.household !== null ? (list.length > 1 ? "household" : "me") : s.mode;
    return {
      ...s,
      mode,
      people: list.map((p, i) => {
        const sh = people[i];
        return {
          ...p,
          name: nameFor(p.name, sh, i),
          salary: sh?.salary ?? p.salary,
          studyLoan: sh?.help ?? p.studyLoan,
          hospitalCover: sh?.hospitalCover ?? p.hospitalCover,
        };
      }),
    };
  },
};

// ── Super or mortgage ───────────────────────────────────────────────────────

export const SOM_PEOPLE: PeopleMap<SomState> = {
  read: (s) =>
    s.people.map((p) =>
      compact({
        name: shareName(p.name),
        salary: p.salary,
        age: p.age,
        superBalance: p.superBalance,
        help: p.help,
        hospitalCover: p.privateCover,
      }),
    ),
  apply: (s, people, ctx) => {
    const list = sized(s.people, ctx, (i) => newSomPerson(`p${i + 1}`, defaultName(i)));
    return {
      ...s,
      people: list.map((p, i) => {
        const sh = people[i];
        return {
          ...p,
          name: nameFor(p.name, sh, i),
          salary: sh?.salary ?? p.salary,
          age: sh?.age ?? p.age,
          superBalance: sh?.superBalance ?? p.superBalance,
          help: sh?.help ?? p.help,
          privateCover: sh?.hospitalCover ?? p.privateCover,
        };
      }),
    };
  },
};

// ── Super at retirement ─────────────────────────────────────────────────────

export const SUPER_PEOPLE: PeopleMap<SuperState> = {
  read: (s) =>
    s.people.map((p) =>
      compact({
        name: shareName(p.name),
        salary: p.salary,
        age: p.age,
        superBalance: p.accounts.reduce((sum, a) => sum + a.balance, 0),
      }),
    ),
  apply: (s, people, ctx) => {
    const list = sized(s.people, ctx, (i) => ({
      ...s.people[0],
      id: `p${i + 1}`,
      accounts: s.people[0].accounts.map((a, j) => ({ ...a, id: `p${i + 1}a${j + 1}` })),
    }));
    return {
      ...s,
      people: list.map((p, i) => {
        const sh = people[i];
        // A balance only maps cleanly onto someone with one fund.
        const accounts =
          sh?.superBalance !== undefined && p.accounts.length === 1
            ? [{ ...p.accounts[0], balance: sh.superBalance }]
            : p.accounts;
        return {
          ...p,
          name: nameFor(p.name, sh, i),
          salary: sh?.salary ?? p.salary,
          age: sh?.age ?? p.age,
          accounts,
        };
      }),
    };
  },
};

// ── How much can I borrow? ──────────────────────────────────────────────────

export const BORROW_PEOPLE: PeopleMap<BorrowForm> = {
  read: (f) => f.people.map((p) => compact({ salary: p.salary, help: p.help })),
  apply: (f, people, ctx) => {
    const list = sized(f.people, ctx, () => ({ salary: 60_000, help: false }));
    return {
      ...f,
      people: list.map((p, i) => ({
        ...p,
        salary: people[i]?.salary ?? p.salary,
        help: people[i]?.help ?? p.help,
      })),
    };
  },
};

// ── Co-borrower split: names only, and always two or more ───────────────────

export const SPLIT_PEOPLE: PeopleMap<SplitState> = {
  read: (s) => s.borrowers.map((b) => compact({ name: shareName(b.name) })),
  apply: (s, people) => ({
    ...s,
    borrowers: s.borrowers.map((b, i) => ({ ...b, name: nameFor(b.name, people[i], i) })),
  }),
};

// ── One person: HELP early and the novated lease ────────────────────────────

export const HELP_PEOPLE: PeopleMap<HelpForm> = {
  read: (f) => [compact({ salary: f.income })],
  apply: (f, people) => ({ ...f, income: people[0]?.salary ?? f.income }),
};

export const LEASE_PEOPLE: PeopleMap<LeaseState> = {
  read: (s) => [compact({ salary: s.salary, help: s.studyLoan, hospitalCover: s.hospitalCover })],
  apply: (s, people) => {
    const p = people[0];
    if (!p) return s;
    return {
      ...s,
      salary: p.salary ?? s.salary,
      studyLoan: p.help ?? s.studyLoan,
      hospitalCover: p.hospitalCover ?? s.hospitalCover,
    };
  },
};
