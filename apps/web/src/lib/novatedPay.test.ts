import { calculateNovatedLease, calculatePay, planBudget } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import { defaultBudgetState, toBudgetInput } from "./budgetState";
import { defaultLeaseState, encodeLeaseState, toLeaseInput } from "./leaseState";
import { leaseInPay, toggleLease, withBudgetLease, withSavedLease } from "./novatedPay";
import { defaultPayState, toPayInput } from "./payState";
import { defaultProfile, storeProfile } from "./profile";
import { emptySaved, type SavedData } from "./saved";

const ON = "2026-11-04";
// A petrol car, so part of the lease is paid after tax.
const LEASE = { ...defaultLeaseState(ON), car: "ice" as const, price: 45_000 };
const leaseQuery = encodeLeaseState(LEASE);

const saved = (over: Partial<SavedData> = {}, has = true): SavedData => ({
  ...emptySaved(),
  tools: { lease: leaseQuery },
  profile: storeProfile({ ...defaultProfile(), lease: has ? "have" : "no" }),
  ...over,
});

describe("novated lease in pay", () => {
  it("takes the lease calculator's first year", () => {
    const first = calculateNovatedLease(toLeaseInput(LEASE)).years[0];
    const l = leaseInPay(leaseQuery);
    expect(l).toEqual({
      preTax: first.preTax / 100,
      postTax: first.postTax / 100,
      fringe: first.reportable / 100,
    });
    expect(l?.postTax).toBeGreaterThan(0);
    expect(leaseInPay(undefined)).toBeNull();
    expect(leaseInPay("v=1&n=%%%")).toBeNull();
  });

  it("lowers take-home pay by what the lease calculator says it costs", () => {
    const pay = { ...defaultPayState(ON), amount: LEASE.salary };
    const withLease = withSavedLease(pay, saved());
    const before = calculatePay(toPayInput(pay));
    const after = calculatePay(toPayInput(withLease));
    const first = calculateNovatedLease(toLeaseInput(LEASE)).years[0];
    expect(Math.abs(before.net - after.net - first.cost)).toBeLessThanOrEqual(2);
    expect(after.afterTax).toBe(first.postTax);
  });

  it("comes in when you said you have one, or already included it", () => {
    const pay = defaultPayState(ON);
    expect(withSavedLease(pay, saved()).lease).not.toBeNull();
    expect(withSavedLease(pay, saved({}, false))).toBe(pay);
    const included = { ...pay, lease: { preTax: 1, postTax: 0, fringe: 0 } };
    expect(withSavedLease(included, saved({}, false)).lease).toEqual(leaseInPay(leaseQuery));
    // No lease saved: what's there stays.
    expect(withSavedLease(included, saved({ tools: {} }))).toBe(included);
  });

  it("stays out once turned off, and back in when turned on", () => {
    const data = saved();
    const off = toggleLease(withSavedLease(defaultPayState(ON), data), false, data);
    expect(off.lease).toBeNull();
    expect(withSavedLease(off, data).lease).toBeNull();
    const on = toggleLease(off, true, data);
    expect(on.leaseOff).toBe(false);
    expect(on.lease).toEqual(leaseInPay(leaseQuery));
  });

  it("flows into the budget's income for the first person", () => {
    const s = defaultBudgetState(ON);
    const before = planBudget(toBudgetInput(s)).incomeYear;
    const adjusted = withBudgetLease(s, saved());
    expect(adjusted.people[0].pay.lease).toEqual(leaseInPay(leaseQuery));
    expect(planBudget(toBudgetInput(adjusted)).incomeYear).toBeLessThan(before);
    const takeHome = {
      ...s,
      people: [{ ...s.people[0], mode: "takehome" as const }],
    };
    expect(withBudgetLease(takeHome, saved())).toBe(takeHome);
  });
});
