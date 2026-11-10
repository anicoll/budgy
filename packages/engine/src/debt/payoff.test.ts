import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  compareStrategies,
  type Debt,
  minimumDue,
  type PayoffInput,
  priorityOrder,
  simulatePayoff,
  solveExtraPerMonth,
  validateDebts,
  withBalanceTransfer,
} from "./payoff";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const fixed = (dollars: number) => ({ type: "fixed" as const, amount: c(dollars) });

const card: Debt = {
  id: "card",
  name: "Credit card",
  balance: c(4_000),
  annualRate: 0.2099,
  minimum: { type: "percent", percent: 0.02, floor: c(25) },
};
const car: Debt = {
  id: "car",
  name: "Car loan",
  balance: c(18_000),
  annualRate: 0.089,
  minimum: fixed(450),
};
const personal: Debt = {
  id: "personal",
  name: "Personal loan",
  balance: c(1_500),
  annualRate: 0.129,
  minimum: fixed(120),
};

const base = (over: Partial<PayoffInput> = {}): PayoffInput => ({
  debts: [card, car, personal],
  extraPerMonth: c(300),
  strategy: "avalanche",
  startDate: "2026-11-04",
  ...over,
});

describe("minimumDue", () => {
  it("uses the larger of the percentage and the floor, capped at the balance", () => {
    const rule = { type: "percent" as const, percent: 0.02, floor: c(25) };
    expect(minimumDue(rule, c(4_000))).toBe(c(80));
    expect(minimumDue(rule, c(500))).toBe(c(25));
    expect(minimumDue(rule, c(10))).toBe(c(10));
    expect(minimumDue(fixed(450), c(100))).toBe(c(100));
    expect(minimumDue(fixed(450), 0)).toBe(0);
  });
});

describe("simulatePayoff", () => {
  it("pays a 0% debt in balance / minimum months with no interest", () => {
    const r = simulatePayoff({
      debts: [{ id: "a", name: "A", balance: c(1_000), annualRate: 0, minimum: fixed(100) }],
      extraPerMonth: 0 as Cents,
      strategy: "avalanche",
      startDate: "2026-01-31",
    });
    expect(r.months).toBe(10);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(c(1_000));
    expect(r.debtFreeDate).toBe("2026-11-30");
    expect(r.timeline).toHaveLength(11);
  });

  it("matches the textbook payment count: $10k at 12% paying $200 takes 70 months", () => {
    // n = -ln(1 - rP/A) / ln(1 + r) = ln 2 / ln 1.01 = 69.66
    const r = simulatePayoff({
      debts: [{ id: "a", name: "A", balance: c(10_000), annualRate: 0.12, minimum: fixed(200) }],
      extraPerMonth: 0 as Cents,
      strategy: "snowball",
      startDate: "2026-01-01",
    });
    expect(r.months).toBe(70);
    expect(r.totalPaid).toBe(r.totalInterest + c(10_000));
    expect(r.timeline[1].interest).toBe(c(100));
  });

  it("orders avalanche by rate and snowball by balance", () => {
    expect(simulatePayoff(base()).priority).toEqual(["card", "personal", "car"]);
    expect(simulatePayoff(base({ strategy: "snowball" })).priority).toEqual([
      "personal",
      "card",
      "car",
    ]);
  });

  it("follows a custom order and puts unlisted debts last", () => {
    const r = simulatePayoff(base({ strategy: "custom", order: ["car"] }));
    expect(r.priority).toEqual(["car", "card", "personal"]);
  });

  it("keeps paying the same budget each month after a debt is cleared (rollover)", () => {
    const r = simulatePayoff(base());
    expect(r.monthlyBudget).toBe(c(80 + 450 + 120 + 300));
    const full = r.timeline.slice(1, -1);
    for (const m of full) expect(m.paid).toBe(r.monthlyBudget);
    expect(r.timeline.at(-1)?.paid).toBeLessThanOrEqual(r.monthlyBudget);
  });

  it("clears the target debt first", () => {
    const r = simulatePayoff(base());
    const at = (id: string) => r.debts.find((d) => d.id === id)?.months ?? Infinity;
    expect(at("card")).toBeLessThan(at("car"));
    const s = simulatePayoff(base({ strategy: "snowball" }));
    const sAt = (id: string) => s.debts.find((d) => d.id === id)?.months ?? Infinity;
    expect(sAt("personal")).toBeLessThan(sAt("card"));
  });

  it("avalanche costs no more interest than snowball, and both beat minimums", () => {
    const all = compareStrategies(base());
    expect(all.avalanche.totalInterest).toBeLessThanOrEqual(all.snowball.totalInterest);
    expect(all.snowball.totalInterest).toBeLessThan(all.minimums.totalInterest);
    expect(all.avalanche.months).toBeLessThan(all.minimums.months);
    expect(all.custom).toBeUndefined();
    expect(compareStrategies({ ...base(), order: ["car"] }).custom?.strategy).toBe("custom");
  });

  it("minimums ignores the extra and lets percentage minimums shrink", () => {
    const r = simulatePayoff(base({ strategy: "minimums" }));
    // The card's 2% is taken after the month's interest: 2% of $4,070 = $81.40.
    expect(r.timeline[1].paid).toBe(c(81.4 + 450 + 120));
    expect(r.monthlyBudget).toBe(c(80 + 450 + 120));
    const cardOnly = simulatePayoff({ ...base({ strategy: "minimums" }), debts: [card] });
    // 2% of a card at 21% shrinks slowly: well over a decade.
    expect(cardOnly.months).toBeGreaterThan(12 * 12);
    expect(cardOnly.paidOff).toBe(true);
  });

  it("flags a minimum that doesn't cover the interest", () => {
    const stuck: Debt = { ...car, id: "stuck", name: "Stuck", minimum: fixed(100) };
    const r = simulatePayoff(base({ strategy: "minimums", debts: [stuck] }));
    expect(r.paidOff).toBe(false);
    expect(r.months).toBe(1200);
    expect(r.debts[0].payoffDate).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/never shrinks/);
    // With an extra it gets paid.
    expect(simulatePayoff(base({ debts: [stuck], extraPerMonth: c(200) })).paidOff).toBe(true);
  });

  it("treats a $0 debt as already cleared", () => {
    const r = simulatePayoff(base({ debts: [{ ...personal, balance: 0 as Cents }, car] }));
    expect(r.debts[0].months).toBe(0);
    expect(r.debts[0].payoffDate).toBe("2026-11-04");
  });
});

describe("validateDebts", () => {
  it("rejects bad input", () => {
    expect(validateDebts([])).toContain("add at least one debt");
    expect(validateDebts([car, car])).toContain("debt ids must be unique");
    expect(validateDebts([{ ...car, minimum: fixed(0) }]).join()).toMatch(/minimum/);
    expect(validateDebts([{ ...car, annualRate: 2 }]).join()).toMatch(/rate/);
    expect(validateDebts([car], -1 as Cents).join()).toMatch(/negative/);
    expect(() => simulatePayoff(base({ startDate: "2026-02-30" }))).toThrow(/start date/);
    expect(validateDebts([card, car, personal])).toEqual([]);
  });
});

describe("priorityOrder", () => {
  it("breaks ties by input order", () => {
    const a = { ...car, id: "a" };
    const b = { ...car, id: "b" };
    expect(priorityOrder([a, b], "avalanche")).toEqual([0, 1]);
    expect(priorityOrder([a, b], "snowball")).toEqual([0, 1]);
  });
});

describe("solveExtraPerMonth", () => {
  it("finds the smallest whole-dollar extra that hits the date", () => {
    const input = base({ extraPerMonth: 0 as Cents });
    const target = "2029-11-04";
    const extra = solveExtraPerMonth(input, target);
    expect(extra).not.toBeNull();
    const at = (x: number) => simulatePayoff({ ...input, extraPerMonth: x as Cents }).debtFreeDate;
    expect(at(extra as number) <= target).toBe(true);
    expect(at((extra as number) - 100) > target).toBe(true);
  });

  it("returns 0 when already on track and null when impossible", () => {
    expect(solveExtraPerMonth(base(), "2099-01-01")).toBe(0);
    expect(solveExtraPerMonth(base(), "2026-11-04")).toBeNull();
    expect(solveExtraPerMonth(base({ strategy: "minimums" }), "2030-01-01")).toBeNull();
  });
});

describe("promo rates and balance transfers", () => {
  const promoCard: Debt = {
    ...card,
    id: "bt",
    name: "Transfer card",
    annualRate: 0.2199,
    promo: { annualRate: 0, months: 12 },
  };

  it("charges no interest during a 0% promo, then the ongoing rate", () => {
    const r = simulatePayoff({
      debts: [{ ...promoCard, minimum: fixed(100) }],
      extraPerMonth: 0 as Cents,
      strategy: "avalanche",
      startDate: "2026-11-04",
    });
    for (const m of r.timeline.slice(1, 13)) expect(m.interest).toBe(0);
    expect(r.timeline[13].interest).toBeGreaterThan(0);
    const out = r.debts[0];
    expect(out.owingWhenPromoEnds).toBe(c(4_000 - 1_200));
    expect(out.promoEndDate).toBe("2027-11-04");
    expect(r.warnings.some((w) => w.includes("still owing when the promo rate ends"))).toBe(true);
  });

  it("reports nothing owing when the promo debt is cleared in time", () => {
    const r = simulatePayoff({
      debts: [{ ...promoCard, minimum: fixed(400) }],
      extraPerMonth: 0 as Cents,
      strategy: "avalanche",
      startDate: "2026-11-04",
    });
    expect(r.debts[0].owingWhenPromoEnds).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it("avalanche leaves a 0% debt until its promo ends", () => {
    const r = simulatePayoff(base({ debts: [promoCard, personal], extraPerMonth: c(200) }));
    // The personal loan (12.9%) outranks the card while it's at 0%.
    expect(r.priority).toEqual(["personal", "bt"]);
    const personalOut = r.debts.find((d) => d.id === "personal");
    expect(personalOut?.months).toBeLessThanOrEqual(6);
  });

  it("leaves results unchanged for debts without a promo", () => {
    const a = simulatePayoff(base());
    const b = simulatePayoff(base({ debts: [card, car, personal].map((d) => ({ ...d })) }));
    expect(b).toEqual(a);
    expect(a.debts.every((d) => d.owingWhenPromoEnds === undefined)).toBe(true);
  });

  it("validates the promo", () => {
    expect(validateDebts([{ ...promoCard, promo: { annualRate: 0, months: 0 } }])).toContain(
      "Transfer card: promo must last 1 to 120 months",
    );
  });

  it("moves debts onto one transfer card with the fee added", () => {
    const moved = withBalanceTransfer(base({ order: ["card", "car", "personal"] }), {
      from: ["card", "personal"],
      name: "New card",
      promoRate: 0,
      promoMonths: 24,
      revertRate: 0.2199,
      feePercent: 0.02,
      minimum: { type: "percent", percent: 0.02, floor: c(25) },
    });
    expect(moved.debts.map((d) => d.id)).toEqual(["bt-card", "car"]);
    expect(moved.debts[0].balance).toBe(c(5_500 * 1.02));
    expect(moved.order).toEqual(["bt-card", "car"]);
    const r = simulatePayoff(moved);
    const before = simulatePayoff(base());
    expect(r.totalInterest).toBeLessThan(before.totalInterest);
  });
});

describe("buy now pay later", () => {
  const bnpl: Debt = {
    id: "bnpl",
    name: "Afterpay",
    balance: c(400),
    annualRate: 0,
    minimum: fixed(100),
    schedule: { instalment: c(100), everyDays: 14 },
  };

  it("lands four fortnightly instalments in months 1, 1, 2, 2 with no interest", () => {
    const r = simulatePayoff({
      debts: [bnpl],
      extraPerMonth: c(0),
      strategy: "avalanche",
      startDate: "2026-11-04",
    });
    expect(r.months).toBe(2);
    expect(r.timeline.map((m) => m.paid)).toEqual([0, c(200), c(200)]);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(c(400));
  });

  it("is paid on schedule and never receives extra, whatever the strategy", () => {
    for (const strategy of ["avalanche", "snowball", "custom"] as const) {
      const r = simulatePayoff(
        base({ debts: [bnpl, car], strategy, order: ["bnpl", "car"], extraPerMonth: c(1_000) }),
      );
      expect(r.debts[0].months).toBe(2);
      expect(r.priority).toEqual(["car"]);
    }
  });

  it("sits outside the monthly budget and doesn't roll over when it finishes", () => {
    const r = simulatePayoff(base({ debts: [bnpl, car], extraPerMonth: c(100) }));
    expect(r.monthlyBudget).toBe(c(550));
    expect(r.timeline[1].paid).toBe(c(750));
    expect(r.timeline[3].paid).toBe(c(550));
  });

  it("takes a smaller last instalment and rejects bad schedules", () => {
    const odd = { ...bnpl, balance: c(250) };
    const r = simulatePayoff({
      debts: [odd],
      extraPerMonth: c(0),
      strategy: "snowball",
      startDate: "2026-11-04",
    });
    expect(r.totalPaid).toBe(c(250));
    expect(r.paidOff).toBe(true);
    expect(validateDebts([{ ...bnpl, schedule: { instalment: c(0), everyDays: 14 } }])).not.toEqual(
      [],
    );
    expect(validateDebts([{ ...bnpl, annualRate: 0.1 }])).not.toEqual([]);
  });
});
