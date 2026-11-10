import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { compareLeases } from "./compare";
import { calculateNovatedLease, type NovatedLeaseInput } from "./novated";

const c = (d: number) => Math.round(d * 100) as Cents;
const base: NovatedLeaseInput = {
  pay: { year: "2026-27", salary: c(130_000) },
  car: "ev",
  price: c(52_000),
  onRoadCosts: c(3_000),
  start: "2026-12-01",
  termYears: 3,
  rate: 0.075,
  managementFee: c(500),
  running: {
    energy: c(680),
    registration: c(900),
    insurance: c(1_500),
    tyres: 0 as Cents,
    maintenance: c(300),
  },
};
const petrol: NovatedLeaseInput = {
  ...base,
  car: "ice",
  price: c(46_000),
  running: { ...base.running, energy: c(2_700), maintenance: c(650) },
};

describe("compareLeases", () => {
  const ev = calculateNovatedLease(base);
  const ice = calculateNovatedLease(petrol);
  it("finds the electric car cheaper in take-home pay despite the higher price", () => {
    const r = compareLeases(ev, ice, 26, [base.price, petrol.price]);
    expect(ev.fbt.treatment).toBe("exempt");
    expect(ice.fbt.treatment).toBe("taxed");
    expect(r.cheaper).toBe(0);
    expect(r.priceGap).toBe(c(6_000));
    expect(r.perPaySaving).toBe(Math.round((ice.years[0].cost - ev.years[0].cost) / 26));
    expect(r.totalSaving).toBe(Math.abs(ev.lease.total - ice.lease.total));
  });
  it("is symmetric", () => {
    const r = compareLeases(ice, ev, 26, [petrol.price, base.price]);
    expect(r.cheaper).toBe(1);
    expect(r.priceGap).toBe(c(6_000));
  });
  it("says neither when the cars are the same", () => {
    expect(compareLeases(ev, ev, 26, [base.price, base.price]).cheaper).toBeNull();
  });
  it("loses the exemption over the luxury car tax limit", () => {
    const pricey = calculateNovatedLease({ ...base, price: c(100_000) });
    expect(pricey.fbt.reason).toBe("ev-over-cap");
    expect(pricey.fbt.treatment).toBe("taxed");
  });
});
