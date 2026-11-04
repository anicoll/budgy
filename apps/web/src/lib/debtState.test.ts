import { describe, expect, it } from "vitest";
import {
  type DebtPlanState,
  decodeDebtState,
  defaultDebtState,
  encodeDebtState,
  nextId,
  syncOrder,
  toDebt,
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
