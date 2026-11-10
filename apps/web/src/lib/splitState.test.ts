import { splitLoan } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  decodeSplitState,
  defaultSplitState,
  encodeSplitState,
  leaverSharePrefill,
  nextBorrowerId,
  type SplitState,
  splitFromBaseLoan,
  toCoBorrowInput,
} from "./splitState";
import { defaultState } from "./state";

const FULL: SplitState = {
  loan: {
    balance: 512_345.67,
    ratePct: 5.89,
    termYears: 27,
    frequency: "fortnightly",
    fortnightlyMethod: "true",
    startDate: "2026-03-31",
    propertyValue: 900_000,
  },
  borrowers: [
    {
      id: "p1",
      name: "Jo ☕",
      sharePct: 60,
      deposit: 100_000,
      extra: 250,
      offset: 20_000,
      offsetDeposit: 500,
      lumpSum: { amount: 5_000, date: "2027-07-01", yearly: true },
      frequency: "weekly",
    },
    { id: "p2", name: "Kim", sharePct: 40, deposit: 0 },
  ],
};

describe("split URL state", () => {
  it("round-trips every field", () => {
    expect(decodeSplitState(encodeSplitState(FULL))).toEqual(FULL);
  });

  it("falls back for junk, a wrong version or fewer than two borrowers", () => {
    const fb = defaultSplitState("2026-01-01");
    expect(decodeSplitState("s=%%%", fb)).toEqual(fb);
    const q = new URLSearchParams(encodeSplitState(FULL));
    q.set("v", "9");
    expect(decodeSplitState(q.toString(), fb)).toEqual(fb);
    expect(
      decodeSplitState(encodeSplitState({ ...FULL, borrowers: [FULL.borrowers[0]] }), fb),
    ).toEqual(fb);
  });

  it("repairs duplicate ids", () => {
    const dup = { ...FULL, borrowers: [FULL.borrowers[1], FULL.borrowers[1]] };
    const out = decodeSplitState(encodeSplitState(dup));
    expect(new Set(out.borrowers.map((b) => b.id)).size).toBe(2);
    expect(nextBorrowerId(out.borrowers)).not.toBe(out.borrowers[1].id);
  });
});

describe("split helpers", () => {
  it("converts dollars to engine input", () => {
    const input = toCoBorrowInput(FULL);
    expect(input.balance).toBe(51_234_567);
    expect(input.termMonths).toBe(324);
    expect(input.propertyValue).toBe(90_000_000);
    expect(input.parties[0]).toMatchObject({
      deposit: 10_000_000,
      extraPerPeriod: 25_000,
      offsetBalance: 2_000_000,
      lumpSums: [{ date: "2027-07-01", amount: 500_000, repeatYearly: true }],
      frequency: "weekly",
    });
    expect(input.parties[1].extraPerPeriod).toBeUndefined();
  });

  it("starts a 50/50 split from the mortgage tool's loan, keeping its offset", () => {
    const base = { ...defaultState("2026-11-04").base, offset: 30_000 };
    const s = splitFromBaseLoan(base);
    expect(s.loan.balance).toBe(base.balance);
    expect(s.borrowers.map((b) => b.sharePct)).toEqual([50, 50]);
    expect(s.borrowers[0].offset).toBe(30_000);
    expect(() => splitLoan(toCoBorrowInput(s))).not.toThrow();
  });

  it("the example runs", () => {
    const r = splitLoan(toCoBorrowInput(defaultSplitState("2026-11-04")));
    expect(r.parties[0].interestSaved).toBeGreaterThan(0);
  });

  it("round-trips buy-out inputs, blank or filled", () => {
    const filled = {
      ...FULL,
      buyout: { keeperId: "p2", value: 820_000, owing: 480_000, sharePct: 45 },
    };
    expect(decodeSplitState(encodeSplitState(filled))).toEqual(filled);
    const blank = { ...FULL, buyout: { keeperId: "p1" } };
    expect(decodeSplitState(encodeSplitState(blank)).buyout).toEqual({
      keeperId: "p1",
      value: undefined,
      owing: undefined,
      sharePct: undefined,
    });
  });

  it("decodes old links with no buy-out, and ignores a keeper who isn't a borrower", () => {
    expect(decodeSplitState(encodeSplitState(FULL)).buyout).toBeUndefined();
    const bad = { ...FULL, buyout: { keeperId: "p99" } };
    expect(decodeSplitState(encodeSplitState(bad)).buyout).toBeUndefined();
  });

  it("prefills the leaver's share from the ownership split", () => {
    expect(leaverSharePrefill([0.5476, 0.4524], 1)).toBe(45.2);
    expect(leaverSharePrefill(undefined, 0)).toBeUndefined();
  });
});
