import { describe, expect, it } from "vitest";
import {
  type DebtPlanState,
  decodeDebtState,
  defaultDebtState,
  encodeDebtState,
  newDebt,
  nextId,
  syncOrder,
  toConsolidation,
  toDebt,
  toTransfer,
} from "./debtState";

const FULL: DebtPlanState = {
  ...defaultDebtState("2026-11-04"),
  extra: 350.5,
  strategy: "custom",
  order: ["d3", "d1", "d2"],
  target: "2029-06-30",
};

describe("debt URL state", () => {
  it("round-trips every field", () => {
    expect(decodeDebtState(encodeDebtState(FULL))).toEqual(FULL);
  });

  it("round-trips a balance transfer and drops unknown debts from it", () => {
    const withBt: DebtPlanState = {
      ...FULL,
      transfer: { from: ["d1", "d3"], promoPct: 0, months: 18, feePct: 1.5, revertPct: 21.49 },
    };
    expect(decodeDebtState(encodeDebtState(withBt))).toEqual(withBt);
    const stale = { ...withBt, transfer: { ...withBt.transfer, from: ["d1", "d7"] } };
    expect(decodeDebtState(encodeDebtState(stale)).transfer.from).toEqual(["d1"]);
  });

  it("round-trips a buy now pay later debt and a consolidation loan", () => {
    const withBoth: DebtPlanState = {
      ...FULL,
      debts: [...FULL.debts, { ...newDebt("d4", "bnpl"), name: "Afterpay", everyDays: 7 }],
      order: ["d1", "d2", "d3", "d4"],
      consolidate: { from: ["d1", "d3"], ratePct: 8.5, months: 48, fee: 300 },
    };
    expect(decodeDebtState(encodeDebtState(withBoth))).toEqual(withBoth);
    // BNPL can't be rolled into a loan, so a stale link drops it.
    const stale = { ...withBoth, consolidate: { ...withBoth.consolidate, from: ["d1", "d4"] } };
    expect(decodeDebtState(encodeDebtState(stale)).consolidate.from).toEqual(["d1"]);
    expect(toConsolidation(FULL)).toBeNull();
    expect(toConsolidation(withBoth)).toMatchObject({
      from: ["d1", "d3"],
      termMonths: 48,
      upfrontFee: 30_000,
    });
  });

  it("still decodes a link made before BNPL and consolidation existed", () => {
    const json = JSON.stringify({
      d: [["d1", "Card", 1000, 20, 0, 50, 2, 0]],
      x: 0,
      k: 0,
      o: ["d1"],
      t: "2026-11-04",
    });
    const s = Buffer.from(json).toString("base64url");
    const out = decodeDebtState(new URLSearchParams({ v: "1", s }).toString());
    expect(out.debts[0].balance).toBe(1000);
    expect(out.debts[0].kind).toBeUndefined();
    expect(out.consolidate.from).toEqual([]);
  });

  it("turns buy now pay later into a fixed schedule at 0%", () => {
    const d = toDebt(newDebt("d4", "bnpl"));
    expect(d.annualRate).toBe(0);
    expect(d.schedule).toEqual({ instalment: 10_000, everyDays: 14 });
  });

  it("turns the transfer form into the engine's input, or null when off", () => {
    expect(toTransfer(FULL)).toBeNull();
    const t = toTransfer({ ...FULL, transfer: { ...FULL.transfer, from: ["d1"] } });
    expect(t).toMatchObject({ from: ["d1"], promoRate: 0, promoMonths: 24, feePercent: 0.02 });
  });

  it("falls back for junk, a wrong version or no debts", () => {
    const fb = defaultDebtState("2026-01-01");
    expect(decodeDebtState("s=%%%", fb)).toEqual(fb);
    const q = new URLSearchParams(encodeDebtState(FULL));
    q.set("v", "2");
    expect(decodeDebtState(q.toString(), fb)).toEqual(fb);
    expect(decodeDebtState(encodeDebtState({ ...FULL, debts: [] }), fb)).toEqual(fb);
  });

  it("repairs duplicate ids and a stale custom order", () => {
    const dup = { ...FULL, debts: [FULL.debts[0], FULL.debts[0]], order: ["d9"] };
    const out = decodeDebtState(encodeDebtState(dup));
    expect(new Set(out.debts.map((d) => d.id)).size).toBe(2);
    expect(out.order).toEqual(out.debts.map((d) => d.id));
  });
});

describe("debt helpers", () => {
  it("converts a card's percentage minimum and a loan's fixed minimum", () => {
    const [card, car] = FULL.debts.map(toDebt);
    expect(card.minimum).toEqual({ type: "percent", percent: 0.02, floor: 2_500 });
    expect(card.annualRate).toBeCloseTo(0.2099);
    expect(car.minimum).toEqual({ type: "fixed", amount: 45_000 });
    expect(car.balance).toBe(1_800_000);
  });

  it("keeps the custom order in step with the list", () => {
    expect(syncOrder(["d2", "d9"], FULL.debts)).toEqual(["d2", "d1", "d3"]);
    expect(nextId(FULL.debts)).toBe("d4");
  });
});
