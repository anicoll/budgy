import { describe, expect, it } from "vitest";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "./period";

const ANCHOR = "2024-01-01"; // Monday

describe("currentPeriodRange", () => {
  it("weekly: returns the 7-day window containing the ref date", () => {
    const range = currentPeriodRange("weekly", ANCHOR, new Date("2024-01-10T00:00:00"));
    expect(range.from).toBe("2024-01-08");
    expect(range.to).toBe("2024-01-14");
  });

  it("fortnightly: returns the 14-day window containing the ref date", () => {
    const range = currentPeriodRange("fortnightly", ANCHOR, new Date("2024-01-10T00:00:00"));
    expect(range.from).toBe("2024-01-01");
    expect(range.to).toBe("2024-01-14");
  });

  it("fortnightly: second fortnight starts on day 15", () => {
    const range = currentPeriodRange("fortnightly", ANCHOR, new Date("2024-01-16T00:00:00"));
    expect(range.from).toBe("2024-01-15");
    expect(range.to).toBe("2024-01-28");
  });

  it("monthly: returns start-of-month to end-of-month", () => {
    const range = currentPeriodRange("monthly", ANCHOR, new Date("2024-02-14T00:00:00"));
    expect(range.from).toBe("2024-02-01");
    expect(range.to).toBe("2024-02-29"); // 2024 is a leap year
  });

  it("yearly: returns full calendar year", () => {
    const range = currentPeriodRange("yearly", ANCHOR, new Date("2024-06-15T00:00:00"));
    expect(range.from).toBe("2024-01-01");
    expect(range.to).toBe("2024-12-31");
  });
});

describe("shiftBudgetPeriod", () => {
  it("shifts weekly by ±1", () => {
    const base = { from: "2024-01-08", to: "2024-01-14" };
    const next = shiftBudgetPeriod("weekly", ANCHOR, base, 1);
    expect(next.from).toBe("2024-01-15");
    expect(next.to).toBe("2024-01-21");

    const prev = shiftBudgetPeriod("weekly", ANCHOR, base, -1);
    expect(prev.from).toBe("2024-01-01");
    expect(prev.to).toBe("2024-01-07");
  });

  it("shifts monthly by ±1", () => {
    const base = { from: "2024-01-01", to: "2024-01-31" };
    const next = shiftBudgetPeriod("monthly", ANCHOR, base, 1);
    expect(next.from).toBe("2024-02-01");

    const prev = shiftBudgetPeriod("monthly", ANCHOR, base, -1);
    expect(prev.from).toBe("2023-12-01");
  });

  it("shifts fortnightly by ±1 without drift", () => {
    const base = currentPeriodRange("fortnightly", ANCHOR, new Date("2024-01-01T00:00:00"));
    expect(base.from).toBe("2024-01-01");

    const next = shiftBudgetPeriod("fortnightly", ANCHOR, base, 1);
    expect(next.from).toBe("2024-01-15");

    const back = shiftBudgetPeriod("fortnightly", ANCHOR, next, -1);
    expect(back.from).toBe("2024-01-01");
  });
});

describe("formatPeriodLabel", () => {
  it("formats monthly as month + year", () => {
    const label = formatPeriodLabel({ from: "2024-03-01", to: "2024-03-31" }, "monthly");
    expect(label).toContain("March");
    expect(label).toContain("2024");
  });

  it("formats weekly as date range", () => {
    const label = formatPeriodLabel({ from: "2024-01-08", to: "2024-01-14" }, "weekly");
    expect(label).toMatch(/8.*Jan|Jan.*8/);
  });
});
