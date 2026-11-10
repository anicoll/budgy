import { describe, expect, it } from "vitest";
import { addMonths, monthsBetween, toDay } from "../dates";
import { cents } from "../money/cents";
import { compareResults, runScenarios, solveExtraRepayment } from "./scenarios";
import { type LoanInput, minimumRepayment, simulateLoan, validateLoan } from "./simulate";

const BASE: LoanInput = {
  balance: cents(50_000_000), // $500,000
  annualRate: 0.06,
  termMonths: 360,
  startDate: "2026-01-15",
  frequency: "monthly",
};

const yearsBetween = (a: string, b: string) => (toDay(b) - toDay(a)) / 365.25;

describe("minimumRepayment", () => {
  it("matches the standard monthly figure, rounded up to the cent ($500k, 6%, 30 years)", () => {
    // Exact PMT is $2,997.7526; lenders round up so the loan never runs long.
    expect(minimumRepayment(50_000_000, 0.06, 360, "monthly")).toBe(299_776);
  });

  it("half-monthly fortnightly is half the monthly repayment, rounded up", () => {
    expect(minimumRepayment(50_000_000, 0.06, 360, "fortnightly", "half-monthly")).toBe(149_888);
  });

  it("true fortnightly is lower than half-monthly", () => {
    const t = minimumRepayment(50_000_000, 0.06, 360, "fortnightly", "true");
    expect(t).toBeLessThan(149_888);
    expect(t).toBeGreaterThan(130_000);
  });

  it("handles a zero rate", () => {
    expect(minimumRepayment(36_000_00, 0, 360, "monthly")).toBe(10_000);
  });
});

describe("simulateLoan: minimum monthly repayments", () => {
  const r = simulateLoan(BASE);

  it("pays off at the end of the term, within one repayment", () => {
    expect(r.paidOff).toBe(true);
    expect(Math.abs(r.repaymentCount - 360)).toBeLessThanOrEqual(1);
    expect(Math.abs(monthsBetween(BASE.startDate, r.payoffDate) - 360)).toBeLessThanOrEqual(1);
  });

  it("total interest is close to the textbook figure ($579,190)", () => {
    // Daily accrual on real month lengths differs from the monthly textbook
    // model by a small amount; it should stay within 0.5%.
    expect(Math.abs(r.totalInterest - 57_919_000) / 57_919_000).toBeLessThan(0.005);
  });

  it("total paid = balance + interest", () => {
    expect(r.totalPaid).toBe(BASE.balance + r.totalInterest);
  });

  it("yearly rows add up and end at zero", () => {
    const interest = r.yearly.reduce((s, y) => s + y.interest, 0);
    const principal = r.yearly.reduce((s, y) => s + y.principal, 0);
    expect(interest).toBe(r.totalInterest);
    expect(principal).toBe(BASE.balance);
    expect(r.yearly.at(-1)?.closingBalance).toBe(0);
    // Leap years add a little daily interest, so a small final repayment can
    // spill into year 31, as it does with a real lender.
    expect(r.yearly.length).toBeGreaterThanOrEqual(30);
    expect(r.yearly.length).toBeLessThanOrEqual(31);
  });

  it("logs a balance on each monthly charge date", () => {
    expect(r.balances[0]).toEqual({
      date: "2026-01-15",
      balance: BASE.balance,
      interestToDate: 0,
    });
    expect(r.balances[1].date).toBe("2026-02-15");
    expect(r.balances.at(-1)?.balance).toBe(0);
  });

  it("tracks interest to date on each point, ending at the total", () => {
    expect(r.balances[1].interestToDate).toBeGreaterThan(0);
    for (let i = 1; i < r.balances.length; i++) {
      expect(r.balances[i].interestToDate).toBeGreaterThanOrEqual(r.balances[i - 1].interestToDate);
    }
    expect(r.balances.at(-1)?.interestToDate).toBe(r.totalInterest);
  });

  it("has no warnings", () => {
    expect(r.warnings).toEqual([]);
  });
});

describe("simulateLoan: repayment frequency", () => {
  const monthly = simulateLoan(BASE);

  it("half-monthly fortnightly finishes years early and saves interest", () => {
    const f = simulateLoan({ ...BASE, frequency: "fortnightly" });
    const years = yearsBetween(BASE.startDate, f.payoffDate);
    expect(years).toBeGreaterThan(24);
    expect(years).toBeLessThan(27);
    expect(f.totalInterest).toBeLessThan(monthly.totalInterest - 10_000_000);
  });

  // A year has about 26.09 fortnights (52.18 weeks), so true fortnightly and
  // weekly repayments finish a few months inside the term.
  it("true fortnightly finishes a few months early", () => {
    const f = simulateLoan({ ...BASE, frequency: "fortnightly", fortnightlyMethod: "true" });
    const years = yearsBetween(BASE.startDate, f.payoffDate);
    expect(years).toBeGreaterThan(29.4);
    expect(years).toBeLessThan(30);
  });

  it("weekly repayments land every 7 days and finish a few months early", () => {
    const w = simulateLoan({ ...BASE, frequency: "weekly" });
    const years = yearsBetween(BASE.startDate, w.payoffDate);
    expect(years).toBeGreaterThan(29.4);
    expect(years).toBeLessThan(30);
    expect(toDay(w.payoffDate) - toDay(BASE.startDate)).toBe(w.repaymentCount * 7);
  });
});

describe("simulateLoan: changes", () => {
  const base = simulateLoan(BASE);

  it("extra repayments shorten the loan and save interest", () => {
    const e = simulateLoan({ ...BASE, extraPerPeriod: cents(50_000) });
    expect(e.payoffDate < base.payoffDate).toBe(true);
    expect(e.totalInterest).toBeLessThan(base.totalInterest);
    expect(e.repayment).toBe(299_776 + 50_000);
  });

  it("an offset saves about the same as paying the same amount into the loan", () => {
    const offset = simulateLoan({ ...BASE, offsetBalance: cents(5_000_000) });
    const lump = simulateLoan({
      ...BASE,
      lumpSums: [{ date: "2026-01-16", amount: cents(5_000_000) }],
    });
    expect(offset.totalInterest).toBeLessThan(base.totalInterest);
    expect(Math.abs(offset.totalInterest - lump.totalInterest) / lump.totalInterest).toBeLessThan(
      0.01,
    );
  });

  it("monthly offset deposits save more than a fixed offset", () => {
    const fixed = simulateLoan({ ...BASE, offsetBalance: cents(1_000_000) });
    const growing = simulateLoan({
      ...BASE,
      offsetBalance: cents(1_000_000),
      offsetMonthlyDeposit: cents(50_000),
    });
    expect(growing.totalInterest).toBeLessThan(fixed.totalInterest);
  });

  it("an offset larger than the balance means no interest", () => {
    const r = simulateLoan({ ...BASE, offsetBalance: cents(60_000_000) });
    expect(r.totalInterest).toBe(0);
  });

  it("a yearly lump sum repeats each year", () => {
    const r = simulateLoan({
      ...BASE,
      lumpSums: [{ date: "2026-07-01", amount: cents(1_000_000), repeatYearly: true }],
    });
    const lumps = r.events.filter((e) => e.type === "lump-sum");
    expect(lumps.length).toBeGreaterThan(5);
    expect(lumps[1].date).toBe("2027-07-01");
  });

  it("a rate rise raises a minimum repayment and records it", () => {
    const r = simulateLoan({ ...BASE, rateChanges: [{ date: "2027-01-01", annualRate: 0.065 }] });
    const raised = r.events.find((e) => e.type === "repayment-raised");
    expect(raised).toBeDefined();
    if (raised?.type === "repayment-raised") expect(raised.to).toBeGreaterThan(raised.from);
    expect(Math.abs(monthsBetween(BASE.startDate, r.payoffDate) - 360)).toBeLessThanOrEqual(1);
    expect(r.totalInterest).toBeGreaterThan(base.totalInterest);
  });

  it("a rate cut keeps the higher repayment, so the loan finishes early", () => {
    const r = simulateLoan({ ...BASE, rateChanges: [{ date: "2027-01-01", annualRate: 0.05 }] });
    expect(r.events.some((e) => e.type === "repayment-raised")).toBe(false);
    expect(r.payoffDate < base.payoffDate).toBe(true);
  });

  it("with followMinimum, a rate cut lowers the repayment to the new minimum", () => {
    const cut = [{ date: "2027-01-01", annualRate: 0.05 }];
    const keep = simulateLoan({ ...BASE, rateChanges: cut });
    const follow = simulateLoan({ ...BASE, rateChanges: cut, followMinimum: true });
    const lowered = follow.events.find((e) => e.type === "repayment-lowered");
    expect(lowered).toBeDefined();
    if (lowered?.type === "repayment-lowered") expect(lowered.to).toBeLessThan(lowered.from);
    // Paying the lower minimum runs to the full term and costs more interest than keeping on.
    expect(Math.abs(monthsBetween(BASE.startDate, follow.payoffDate) - 360)).toBeLessThanOrEqual(1);
    expect(follow.totalInterest).toBeGreaterThan(keep.totalInterest);
  });

  it("followMinimum leaves a repayment you set alone", () => {
    const r = simulateLoan({
      ...BASE,
      repayment: cents(350_000),
      followMinimum: true,
      rateChanges: [{ date: "2027-01-01", annualRate: 0.05 }],
    });
    expect(r.events.some((e) => e.type === "repayment-lowered")).toBe(false);
  });

  it("a repayment above the minimum is kept when rates rise a little", () => {
    const r = simulateLoan({
      ...BASE,
      repayment: cents(350_000),
      rateChanges: [{ date: "2027-01-01", annualRate: 0.0625 }],
    });
    expect(r.events.some((e) => e.type === "repayment-raised")).toBe(false);
  });
});

describe("simulateLoan: edge cases", () => {
  it("warns when the repayment is below the minimum and the loan runs past its term", () => {
    const r = simulateLoan({ ...BASE, repayment: cents(260_000) });
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
    expect(r.paidOff).toBe(true);
  });

  it("stops at 100 years when the repayment doesn't cover interest", () => {
    const r = simulateLoan({ ...BASE, repayment: cents(200_000) });
    expect(r.paidOff).toBe(false);
    expect(r.warnings.some((w) => w.includes("100 years"))).toBe(true);
  });

  it("start on the 31st clamps monthly dates to short months", () => {
    const r = simulateLoan({ ...BASE, startDate: "2026-01-31" });
    expect(r.balances[1].date).toBe("2026-02-28");
    expect(r.balances[2].date).toBe("2026-03-31");
  });

  it("a short loan pays off on schedule", () => {
    const r = simulateLoan({ ...BASE, balance: cents(1_200_000), termMonths: 12 });
    expect(r.repaymentCount).toBe(12);
    expect(r.payoffDate).toBe(addMonths(BASE.startDate, 12));
  });

  it("rejects bad input with clear messages", () => {
    const errors = validateLoan({ ...BASE, annualRate: 0.5, startDate: "2026-13-01" });
    expect(errors).toContain("rate must be between 0 and 20%");
    expect(errors).toContain("start date must be YYYY-MM-DD");
    expect(() => simulateLoan({ ...BASE, balance: cents(0) })).toThrow(RangeError);
  });
});

describe("scenarios", () => {
  it("compares scenarios against the base", () => {
    const { base, scenarios } = runScenarios(BASE, [
      { extraPerPeriod: cents(20_000) },
      { offsetBalance: cents(2_000_000) },
    ]);
    expect(scenarios).toHaveLength(2);
    for (const s of scenarios) {
      expect(s.vsBase.interestSaved).toBeGreaterThan(0);
      expect(s.vsBase.daysSaved).toBeGreaterThan(0);
      expect(s.vsBase).toEqual(compareResults(base, s.result));
    }
  });

  it("solves the extra repayment needed to finish by a date", () => {
    const target = "2046-01-15"; // 20 years instead of 30
    const extra = solveExtraRepayment(BASE, target);
    expect(extra).not.toBeNull();
    const at = simulateLoan({ ...BASE, extraPerPeriod: extra ?? cents(0) });
    const below = simulateLoan({
      ...BASE,
      extraPerPeriod: ((extra ?? 0) - 100) as typeof extra & number,
    });
    expect(at.payoffDate <= target).toBe(true);
    expect(below.payoffDate > target).toBe(true);
  });

  it("returns 0 when the loan already finishes in time", () => {
    expect(solveExtraRepayment(BASE, "2060-01-01")).toBe(0);
  });
});

describe("simulateLoan: interest-only period", () => {
  const plain = simulateLoan(BASE);
  const io = simulateLoan({ ...BASE, interestOnlyMonths: 60 });
  const at = (r: typeof io, iso: string) => r.balances.find((b) => b.date === iso)?.balance ?? 0;

  it("costs more total interest than straight principal and interest", () => {
    expect(io.totalInterest).toBeGreaterThan(plain.totalInterest);
  });

  it("pays interest only at the start, then jumps to the P&I minimum over the rest of the term", () => {
    // $500k at 6% is $2,500 a month of interest.
    expect(io.repayment).toBe(250_000);
    const expected = minimumRepayment(50_000_000, 0.06, 300, "monthly");
    // Worked out on the balance at the time, which drifts a little from the start.
    expect(Math.abs((io.afterInterestOnly?.repayment ?? 0) - expected)).toBeLessThan(500);
    expect(io.afterInterestOnly?.repayment).toBeGreaterThan(io.repayment);
    expect(io.afterInterestOnly?.date).toBe(addMonths(BASE.startDate, 60));
    const ev = io.events.find((e) => e.type === "interest-only-ends");
    expect(ev).toMatchObject({ from: 250_000 });
  });

  it("keeps the balance about flat while interest only, then pays it down", () => {
    const end = at(io, addMonths(BASE.startDate, 60));
    // Months differ in length, so allow some drift.
    expect(Math.abs(end - BASE.balance)).toBeLessThan(150_000);
    expect(at(io, addMonths(BASE.startDate, 120))).toBeLessThan(end);
  });

  it("still pays off by the end of the term", () => {
    expect(io.paidOff).toBe(true);
    expect(Math.abs(io.repaymentCount - 360)).toBeLessThanOrEqual(1);
  });

  it("extras and offset still reduce the balance during the period", () => {
    const d = addMonths(BASE.startDate, 36);
    const withExtra = simulateLoan({
      ...BASE,
      interestOnlyMonths: 60,
      extraPerPeriod: cents(50_000),
    });
    expect(at(withExtra, d)).toBeLessThan(at(io, d) - 1_000_000);
    const withOffset = simulateLoan({
      ...BASE,
      interestOnlyMonths: 60,
      offsetBalance: cents(100_000),
    });
    expect(withOffset.totalInterest).toBeLessThan(io.totalInterest);
    expect(at(withOffset, d)).toBeLessThan(at(io, d));
  });

  it("zero months matches no interest-only period", () => {
    expect(simulateLoan({ ...BASE, interestOnlyMonths: 0 })).toEqual(plain);
  });

  it("follows a rate change while interest only", () => {
    const r = simulateLoan({
      ...BASE,
      interestOnlyMonths: 60,
      rateChanges: [{ date: "2027-01-15", annualRate: 0.07 }],
    });
    expect(r.events.some((e) => e.type === "repayment-raised")).toBe(true);
    expect(r.paidOff).toBe(true);
  });

  it("rejects an interest-only period as long as the term", () => {
    expect(validateLoan({ ...BASE, interestOnlyMonths: 360 })).toHaveLength(1);
    expect(validateLoan({ ...BASE, interestOnlyMonths: -1 })).toHaveLength(1);
  });
});
