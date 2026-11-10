import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { leaveScenario, validateLeave } from "./leaving";
import { calculateNovatedLease, type NovatedLeaseInput } from "./novated";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

const input: NovatedLeaseInput = {
  pay: { year: "2026-27", salary: c(120_000) },
  car: "ice",
  price: c(40_000),
  onRoadCosts: c(2_000),
  start: "2026-12-01",
  termYears: 3,
  rate: 0.075,
  managementFee: c(500),
  running: {
    energy: c(2_000),
    registration: c(900),
    insurance: c(1_500),
    tyres: c(300),
    maintenance: c(400),
  },
};
const result = calculateNovatedLease(input);

describe("leaveScenario", () => {
  it("costs more from after-tax pay than the packaged lease does now", () => {
    const s = leaveScenario(input, result, 24);
    expect(s.personalTotal).toBeGreaterThan(s.currentTotal);
    expect(s.extra).toBe(s.personalTotal - s.currentTotal);
    expect(s.personal.fortnightly).toBeGreaterThan(s.current.fortnightly);
  });

  it("adds GST back to everything packaged except registration", () => {
    const s = leaveScenario(input, result, 12);
    const pkg = result.years[0].packageCost;
    expect(s.personal.yearly).toBeCloseTo((pkg - c(900)) * 1.1 + c(900), -1);
  });

  it("spreads the same total over each pay frequency", () => {
    const s = leaveScenario(input, result, 18);
    expect(s.personal.monthly * 18).toBeCloseTo(s.personalTotal, -2);
    expect(s.personal.weekly * 52).toBeCloseTo(s.personal.yearly, -2);
    expect(s.personal.fortnightly * 26).toBeCloseTo(s.personal.yearly, -2);
  });

  it("reports the whole current cost when the full term is left", () => {
    const s = leaveScenario(input, result, result.months);
    expect(s.currentTotal).toBe(result.totals.cost);
  });

  it("keeps the residual as a separate amount still due at the end", () => {
    const s = leaveScenario(input, result, 6);
    expect(s.residualWithGst).toBe(result.residualWithGst);
    expect(s.residualWithGst).toBeGreaterThan(0);
  });

  it("rejects months outside the term", () => {
    expect(validateLeave(result, 0)).not.toEqual([]);
    expect(validateLeave(result, 37)).not.toEqual([]);
    expect(validateLeave(result, 1.5)).not.toEqual([]);
    expect(() => leaveScenario(input, result, 0)).toThrow(RangeError);
  });
});
