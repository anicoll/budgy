import { describe, expect, it } from "vitest";
import { averageRateHistory, gapChange, type RateHistoryPoint } from "./rateHistory";
import { RBA_HOUSING_HISTORY, type RbaHousingHistory } from "./rbaHistory";
import { type RateSeries, RBA_HOUSING_RATES } from "./rbaRates";

const pt = (month: string, n: number, o: number): RateHistoryPoint => ({
  month,
  new: n,
  outstanding: o,
});

describe("RBA history data", () => {
  it("has at least five years for every series, all the same length", () => {
    const lengths = new Set<number>();
    for (const purpose of Object.values(RBA_HOUSING_HISTORY.rates))
      for (const h of Object.values(purpose)) {
        lengths.add(h.new.length);
        lengths.add(h.outstanding.length);
        for (const v of [...h.new, ...h.outstanding]) expect(v).toBeGreaterThan(0.005);
      }
    expect(lengths.size).toBe(1);
    expect([...lengths][0]).toBeGreaterThanOrEqual(61);
  });

  it("ends on the month and values of the latest snapshot", () => {
    for (const purpose of ["owner-occupier", "investor"] as const)
      for (const series of Object.keys(RBA_HOUSING_RATES.rates[purpose]) as RateSeries[]) {
        const last = averageRateHistory(purpose, series, 1).at(-1);
        expect(last).toEqual({
          month: RBA_HOUSING_RATES.month,
          ...RBA_HOUSING_RATES.rates[purpose][series],
        });
      }
  });
});

describe("averageRateHistory", () => {
  it("returns months + 1 points ending on the latest month", () => {
    const p = averageRateHistory("owner-occupier", "variable", 12);
    expect(p).toHaveLength(13);
    expect(p[12].month).toBe(RBA_HOUSING_RATES.month);
    expect(p[0].month).toBe("2025-08");
  });

  it("steps one calendar month at a time across year ends", () => {
    const months = averageRateHistory("investor", "all", 24).map((x) => x.month);
    expect(months[months.indexOf("2025-12") + 1]).toBe("2026-01");
  });

  it("is capped to what the history has", () => {
    const p = averageRateHistory("owner-occupier", "variable", 10_000);
    expect(p).toHaveLength(RBA_HOUSING_HISTORY.rates["owner-occupier"].variable.new.length);
  });

  it("works on a short custom history", () => {
    const data = {
      first: "2025-11",
      rates: {
        "owner-occupier": { variable: { new: [0.06, 0.059], outstanding: [0.062, 0.061] } },
      },
    } as unknown as RbaHousingHistory;
    expect(averageRateHistory("owner-occupier", "variable", 36, data)).toEqual([
      pt("2025-11", 0.06, 0.062),
      pt("2025-12", 0.059, 0.061),
    ]);
  });
});

describe("gapChange", () => {
  it("is null with fewer than two points", () => {
    expect(gapChange([pt("2026-01", 0.06, 0.06)], 0.064, "new")).toBeNull();
    expect(gapChange([], 0.064, "new")).toBeNull();
  });

  it("widens when averages fall and your rate stays flat", () => {
    const g = gapChange([pt("2025-01", 0.061, 0.065), pt("2026-01", 0.058, 0.062)], 0.064, "new");
    expect(g).toEqual({ from: 0.003, to: 0.006, direction: "widened" });
  });

  it("narrows when averages rise", () => {
    const g = gapChange(
      [pt("2025-01", 0.05, 0.05), pt("2026-01", 0.06, 0.06)],
      0.064,
      "outstanding",
    );
    expect(g).toEqual({ from: 0.014, to: 0.004, direction: "narrowed" });
  });

  it("can cross from above to below", () => {
    const g = gapChange([pt("2025-01", 0.06, 0.06), pt("2026-01", 0.07, 0.07)], 0.065, "new");
    expect(g).toEqual({ from: 0.005, to: -0.005, direction: "narrowed" });
  });

  it("calls a tiny move the same", () => {
    const g = gapChange([pt("2025-01", 0.06, 0.06), pt("2026-01", 0.0602, 0.06)], 0.064, "new");
    expect(g?.direction).toBe("same");
  });
});
