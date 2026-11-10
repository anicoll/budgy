import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { buyingCosts, ratesAdjustment } from "./costs";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

describe("moving in costs and rates adjustment", () => {
  const base = {
    state: "NSW" as const,
    price: c(850_000),
    deposit: c(85_000),
    buyer: "firstHome" as const,
    property: "existing" as const,
    other: { conveyancing: c(1_800), inspections: c(600), loanFees: c(0), other: c(0) },
  };

  it("pro-rates annual rates by the days left", () => {
    const r = ratesAdjustment({ council: c(2_190), water: c(730), daysLeft: 73 });
    expect(r.council).toBe(c(438));
    expect(r.water).toBe(c(146));
    expect(r.total).toBe(c(584));
  });

  it("clamps days and ignores missing or negative amounts", () => {
    expect(ratesAdjustment({ council: c(3_650), daysLeft: 1_000 }).total).toBe(c(3_660));
    expect(ratesAdjustment({ council: c(3_650), daysLeft: -5 }).total).toBe(0);
    expect(ratesAdjustment({ council: c(-100), daysLeft: 30 }).total).toBe(0);
    expect(ratesAdjustment({ daysLeft: 30 }).total).toBe(0);
    expect(ratesAdjustment({ council: c(1_000), daysLeft: Number.NaN }).total).toBe(0);
  });

  it("adds both to the total and leaves stamp duty alone", () => {
    const plain = buyingCosts(base);
    const full = buyingCosts({
      ...base,
      movingIn: { removalist: c(1_500), connections: c(300), buffer: c(200) },
      rates: { council: c(1_825), water: c(365), daysLeft: 100 },
    });
    expect(full.movingIn).toBe(c(2_000));
    expect(full.rates.total).toBe(c(600));
    expect(full.costs - plain.costs).toBe(c(2_600));
    expect(full.cashNeeded - plain.cashNeeded).toBe(c(2_600));
    expect(full.duty).toEqual(plain.duty);
  });

  it("is unchanged when neither is given", () => {
    const plain = buyingCosts(base);
    expect(plain.movingIn).toBe(0);
    expect(plain.rates.total).toBe(0);
  });
});
