import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import {
  computeBudgetSummary,
  computeEnvelopeSummary,
  computeZeroSumSummary,
  envelopeCategoryStatus,
  envelopeProgressRatio,
} from "./summary";
import type { BackendAccount, BackendCategory } from "./types";

const cat = (overrides: Partial<BackendCategory> = {}): BackendCategory => ({
  id: "c1",
  budgetId: "b1",
  name: "Groceries",
  budgeted: cents(50000),
  balance: cents(30000),
  targetLimit: cents(40000),
  ...overrides,
});

const acc = (overrides: Partial<BackendAccount> = {}): BackendAccount => ({
  id: "a1",
  budgetId: "b1",
  name: "Checking",
  balance: cents(100000),
  ...overrides,
});

describe("computeZeroSumSummary", () => {
  it("sums account balances and category balances", () => {
    const summary = computeZeroSumSummary(
      [acc({ balance: cents(100000) }), acc({ id: "a2", balance: cents(50000) })],
      [cat({ balance: cents(30000) }), cat({ id: "c2", balance: cents(20000) })],
    );

    expect(summary.kind).toBe("zero_sum");
    expect(summary.totalAvailableFunds).toBe(cents(150000));
    expect(summary.totalAssignedFunds).toBe(cents(50000));
    expect(summary.readyToAssign).toBe(cents(100000));
  });
});

describe("computeEnvelopeSummary", () => {
  it("counts category statuses", () => {
    const summary = computeEnvelopeSummary([
      cat({ balance: cents(50000), targetLimit: cents(40000) }),
      cat({ id: "c2", balance: cents(10000), targetLimit: cents(40000) }),
      cat({ id: "c3", balance: cents(-1000), targetLimit: cents(40000) }),
    ]);

    expect(summary.kind).toBe("envelope");
    expect(summary.totalBalance).toBe(cents(59000));
    expect(summary.onTrack).toBe(1);
    expect(summary.watch).toBe(1);
    expect(summary.overspent).toBe(1);
  });
});

describe("computeBudgetSummary", () => {
  it("delegates by method", () => {
    const zeroSum = computeBudgetSummary("zero_sum", [acc()], [cat()]);
    expect(zeroSum.kind).toBe("zero_sum");

    const envelope = computeBudgetSummary("envelope", [acc()], [cat()]);
    expect(envelope.kind).toBe("envelope");
  });
});

describe("envelopeCategoryStatus", () => {
  it("marks overspent when balance is negative", () => {
    expect(envelopeCategoryStatus(cat({ balance: cents(-1) }))).toBe("overspent");
  });

  it("marks watch when below target", () => {
    expect(envelopeCategoryStatus(cat({ balance: cents(10000), targetLimit: cents(40000) }))).toBe(
      "watch",
    );
  });

  it("marks on track when at or above target", () => {
    expect(envelopeCategoryStatus(cat({ balance: cents(40000), targetLimit: cents(40000) }))).toBe(
      "on_track",
    );
  });
});

describe("envelopeProgressRatio", () => {
  it("returns balance divided by target", () => {
    expect(envelopeProgressRatio(cat({ balance: cents(20000), targetLimit: cents(40000) }))).toBe(
      0.5,
    );
  });

  it("returns 1 when target is zero and balance is non-negative", () => {
    expect(envelopeProgressRatio(cat({ balance: cents(0), targetLimit: cents(0) }))).toBe(1);
  });
});
