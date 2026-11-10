import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  dueDatesIn,
  type PayPeriodBill,
  type PayPeriodInput,
  payDate,
  payPeriodAround,
  planPayPeriod,
  validatePayPeriod,
} from "./payPeriod";

const c = (d: number) => Math.round(d * 100) as Cents;
const bill = (b: Partial<PayPeriodBill> & Pick<PayPeriodBill, "id">): PayPeriodBill => ({
  label: b.id,
  amount: c(100),
  frequency: "month",
  ...b,
});
const input = (o: Partial<PayPeriodInput> = {}): PayPeriodInput => ({
  payEvery: "fortnight",
  lastPay: "2026-11-06",
  today: "2026-11-10",
  income: c(3_000),
  bills: [],
  ...o,
});

describe("pay periods", () => {
  it("finds the fortnight you're in", () => {
    expect(payPeriodAround("2026-11-06", "fortnight", "2026-11-10")).toEqual({
      start: "2026-11-06",
      next: "2026-11-20",
    });
    // On a pay day, a new pay starts.
    expect(payPeriodAround("2026-11-06", "fortnight", "2026-11-20").start).toBe("2026-11-20");
    // Long after the last pay date, and before it.
    expect(payPeriodAround("2026-01-02", "fortnight", "2026-11-10").start).toBe("2026-11-06");
    expect(payPeriodAround("2026-11-06", "fortnight", "2026-10-31")).toEqual({
      start: "2026-10-23",
      next: "2026-11-06",
    });
  });

  it("finds the week you're in", () => {
    expect(payPeriodAround("2026-11-06", "week", "2026-11-12")).toEqual({
      start: "2026-11-06",
      next: "2026-11-13",
    });
  });

  it("keeps the day of month for monthly pay, clamped in short months", () => {
    expect(payDate("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(payDate("2026-01-31", "month", 2)).toBe("2026-03-31");
    expect(payPeriodAround("2026-01-31", "month", "2026-03-05")).toEqual({
      start: "2026-02-28",
      next: "2026-03-31",
    });
    expect(payPeriodAround("2026-11-15", "month", "2027-01-02")).toEqual({
      start: "2026-12-15",
      next: "2027-01-15",
    });
  });

  it("counts the days", () => {
    const r = planPayPeriod(input());
    expect(r).toMatchObject({
      start: "2026-11-06",
      next: "2026-11-20",
      days: 14,
      dayOf: 5,
      daysLeft: 10,
    });
    expect(planPayPeriod(input({ today: "2026-11-06" })).daysLeft).toBe(14);
    expect(planPayPeriod(input({ today: "2026-11-19" })).daysLeft).toBe(1);
  });
});

describe("bill dates", () => {
  it("steps weekly and fortnightly bills from any anchor, earlier or later", () => {
    expect(dueDatesIn("2026-11-08", "week", "2026-11-06", "2026-11-20")).toEqual([
      "2026-11-08",
      "2026-11-15",
    ]);
    expect(dueDatesIn("2026-12-25", "fortnight", "2026-11-06", "2026-11-20")).toEqual([
      "2026-11-13",
    ]);
    expect(dueDatesIn("2026-01-01", "week", "2026-11-06", "2026-11-13")).toHaveLength(1);
  });

  it("steps monthly bills, clamping the day", () => {
    expect(dueDatesIn("2026-11-15", "month", "2026-11-06", "2026-11-20")).toEqual(["2026-11-15"]);
    expect(dueDatesIn("2026-11-15", "month", "2026-11-16", "2026-12-14")).toEqual([]);
    expect(dueDatesIn("2026-01-31", "month", "2026-02-20", "2026-03-05")).toEqual(["2026-02-28"]);
    expect(dueDatesIn("2027-03-01", "month", "2026-11-06", "2026-12-06")).toEqual(["2026-12-01"]);
  });
});

describe("planning a pay", () => {
  it("puts dated bills on their dates, in order, and leaves the rest", () => {
    const r = planPayPeriod(
      input({
        bills: [
          bill({ id: "rent", amount: c(1_170), nextDue: "2026-11-15" }),
          bill({ id: "phone", amount: c(145), nextDue: "2026-11-08" }),
        ],
      }),
    );
    expect(r.items.map((i) => [i.id, i.date])).toEqual([
      ["phone", "2026-11-08"],
      ["rent", "2026-11-15"],
    ]);
    expect(r.datedTotal).toBe(c(1_315));
    expect(r.left).toBe(c(1_685));
    expect(r.perDay).toBe(c(168.5));
  });

  it("leaves a dated bill out of a pay it doesn't fall in", () => {
    const r = planPayPeriod(input({ bills: [bill({ id: "rent", nextDue: "2026-11-25" })] }));
    expect(r.items).toEqual([]);
    expect(r.left).toBe(c(3_000));
  });

  it("counts a weekly bill twice in a fortnight", () => {
    const r = planPayPeriod(
      input({
        bills: [bill({ id: "gym", amount: c(20), frequency: "week", nextDue: "2026-11-07" })],
      }),
    );
    expect(r.items.map((i) => i.date)).toEqual(["2026-11-07", "2026-11-14"]);
    expect(r.datedTotal).toBe(c(40));
  });

  it("spreads undated bills evenly", () => {
    const r = planPayPeriod(input({ bills: [bill({ id: "net", amount: c(100) })] }));
    expect(r.items[0]).toMatchObject({ kind: "spread", amount: Math.round(120_000 / 26) });
    // Weekly groceries in a fortnight come to two weeks.
    const g = planPayPeriod(
      input({ bills: [bill({ id: "food", amount: c(200), frequency: "week" })] }),
    );
    expect(g.spreadTotal).toBe(c(400));
  });

  it("sets aside quarterly and yearly bills pro rata, dated or not", () => {
    const r = planPayPeriod(
      input({
        bills: [
          bill({ id: "power", amount: c(390), frequency: "quarter", nextDue: "2026-12-15" }),
          bill({ id: "rego", amount: c(1_300), frequency: "year" }),
        ],
      }),
    );
    expect(r.items.map((i) => [i.id, i.kind, i.amount])).toEqual([
      ["power", "setAside", c(60)],
      ["rego", "setAside", c(50)],
    ]);
    expect(r.items[0].nextDue).toBe("2026-12-15");
    expect(r.setAsideTotal).toBe(c(110));
  });

  it("sets aside over weekly and monthly pays too", () => {
    const q = (payEvery: "week" | "month") =>
      planPayPeriod(
        input({ payEvery, bills: [bill({ id: "p", amount: c(520), frequency: "quarter" })] }),
      ).setAsideTotal;
    expect(q("week")).toBe(c(40));
    expect(q("month")).toBe(c(173.33));
  });

  it("shows a shortfall and no per-day figure", () => {
    const r = planPayPeriod(
      input({
        income: c(100),
        bills: [bill({ id: "rent", amount: c(500), nextDue: "2026-11-12" })],
      }),
    );
    expect(r.left).toBe(c(-400));
    expect(r.perDay).toBe(0);
  });

  it("works for monthly pay", () => {
    const r = planPayPeriod(
      input({
        payEvery: "month",
        lastPay: "2026-10-28",
        bills: [bill({ id: "rent", amount: c(2_000), nextDue: "2026-11-01" })],
      }),
    );
    expect(r).toMatchObject({ start: "2026-10-28", next: "2026-11-28", days: 31 });
    expect(r.datedTotal).toBe(c(2_000));
  });

  it("skips zero-dollar lines", () => {
    expect(planPayPeriod(input({ bills: [bill({ id: "z", amount: 0 as Cents })] })).items).toEqual(
      [],
    );
  });

  it("rejects bad input", () => {
    expect(validatePayPeriod(input({ lastPay: "nope" }))).toHaveLength(1);
    expect(
      validatePayPeriod(input({ bills: [bill({ id: "x", nextDue: "2026-13-40" })] })),
    ).toHaveLength(1);
    expect(() => planPayPeriod(input({ lastPay: "" }))).toThrow(RangeError);
  });
});
