import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calcMinRepayment } from "./amortise";
import { loanForRepayment, repaymentToBalance } from "./inverse";

const c = (d: number) => Math.round(d * 100) as Cents;

describe("loanForRepayment", () => {
  it("matches the known example", () => {
    // $3,200 a month at 6% over 27 years is about $512,833.
    expect(loanForRepayment(c(3200), 0.06, 27, "monthly") / 100).toBeCloseTo(512_833, 0);
  });

  it.each(["monthly", "fortnightly", "weekly"] as const)(
    "round-trips with calcMinRepayment (%s)",
    (f) => {
      const loan = c(640_000);
      const repay = calcMinRepayment(loan, 0.0625, 30, f);
      const back = loanForRepayment(repay, 0.0625, 30, f);
      expect(Math.abs(back - loan)).toBeLessThan(repay * 0.5 + 100);
    },
  );

  it("supports less at a higher rate or a shorter term", () => {
    const a = loanForRepayment(c(3000), 0.06, 30);
    expect(loanForRepayment(c(3000), 0.09, 30)).toBeLessThan(a);
    expect(loanForRepayment(c(3000), 0.06, 25)).toBeLessThan(a);
  });

  it("handles a zero rate and bad input", () => {
    expect(loanForRepayment(c(1000), 0, 10, "monthly")).toBe(c(120_000));
    expect(loanForRepayment(c(0), 0.06, 30)).toBe(0);
    expect(loanForRepayment(c(1000), 0.06, 0)).toBe(0);
    expect(loanForRepayment(c(1000), -0.01, 30)).toBe(0);
  });

  it("agrees with repaymentToBalance", () => {
    expect(loanForRepayment(c(2500), 0.055, 30, "fortnightly")).toBe(
      repaymentToBalance(c(2500), 0.055, 30, "fortnightly"),
    );
  });
});
