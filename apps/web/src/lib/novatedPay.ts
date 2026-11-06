import { calculateNovatedLease } from "@budgy/engine";
import type { BudgetState } from "./budgetState";
import { decodeLeaseState, toLeaseInput } from "./leaseState";
import type { LeaseInPay, PayState } from "./payState";
import { parseProfile } from "./profile";
import type { SavedData } from "./saved";

/**
 * A novated lease changes take-home pay: the rentals and running costs come
 * out before tax, the employee contribution comes out after tax, and the
 * leftover taxable value shows on the income statement. The lease calculator
 * works those out; this carries them into the pay calculator and the budget,
 * so take-home pay is the same everywhere.
 */

const dollars = (cents: number) => Math.round(cents) / 100;

/** What the lease saved on this device takes out of pay in its first year. */
export function leaseInPay(leaseQuery: string | undefined): LeaseInPay | null {
  if (!leaseQuery) return null;
  try {
    const bad = {} as ReturnType<typeof decodeLeaseState>;
    const lease = decodeLeaseState(leaseQuery, bad);
    if (lease === bad) return null;
    const first = calculateNovatedLease(toLeaseInput(lease)).years[0];
    if (!first) return null;
    return {
      preTax: dollars(first.preTax),
      postTax: dollars(first.postTax),
      fringe: dollars(first.reportable),
    };
  } catch {
    return null;
  }
}

const sameLease = (a: LeaseInPay | null, b: LeaseInPay | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.preTax === b.preTax &&
    a.postTax === b.postTax &&
    a.fringe === b.fringe);

/** Someone said on the home page that they have a novated lease. */
export const saysHasLease = (data: SavedData) => parseProfile(data.profile)?.lease === "have";

/**
 * Bring a pay up to date with the lease saved on this device. The lease comes
 * in when the person said they have one, or already included it; it stays out
 * once they've turned it off. With no lease saved, what's there is kept.
 */
export function withSavedLease(pay: PayState, data: SavedData): PayState {
  if (pay.leaseOff) return pay.lease ? { ...pay, lease: null } : pay;
  const lease = leaseInPay(data.tools.lease);
  if (!lease || !(pay.lease || saysHasLease(data))) return pay;
  return sameLease(pay.lease, lease) ? pay : { ...pay, lease };
}

/** Include or leave out the saved lease, as the person picks. */
export function toggleLease(pay: PayState, on: boolean, data: SavedData): PayState {
  if (!on) return { ...pay, lease: null, leaseOff: true };
  return { ...pay, leaseOff: false, lease: leaseInPay(data.tools.lease) ?? pay.lease };
}

/** The lease is yours, so it goes on the first person's pay in a budget. */
export function withBudgetLease(s: BudgetState, data: SavedData): BudgetState {
  const [first, ...rest] = s.people;
  if (!first || first.mode !== "salary") return s;
  const pay = withSavedLease(first.pay, data);
  return pay === first.pay ? s : { ...s, people: [{ ...first, pay }, ...rest] };
}
