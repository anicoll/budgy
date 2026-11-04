import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calcMinRepayment } from "../mortgage/amortise";
import { calculatePay } from "../tax/pay";
import {
  type BorrowingInput,
  borrowingLevers,
  borrowingPower,
  borrowingRange,
  EXPENSE_BENCHMARK,
  expenseFloor,
  LENDER_PROFILES,
  validateBorrowing,
} from "./power";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const base = (over: Partial<BorrowingInput> = {}): BorrowingInput => ({
  year: "2026-27",
  applicants: [{ salary: c(100_000) }],
  dependants: 0,
  livingExpenses: c(2_000),
  rate: 0.06,
  termYears: 30,
  ...over,
});

describe("expense floor", () => {
  it("rises with household size and income", () => {
    expect(expenseFloor(1, 0, c(50_000))).toBe(EXPENSE_BENCHMARK.single);
    expect(expenseFloor(2, 0, c(50_000))).toBe(EXPENSE_BENCHMARK.couple);
    expect(expenseFloor(2, 2, c(50_000))).toBe(
      EXPENSE_BENCHMARK.couple + 2 * EXPENSE_BENCHMARK.perDependant,
    );
    expect(expenseFloor(1, 0, c(100_000))).toBe(c(1_550 * 1.2));
    expect(expenseFloor(1, 0, c(400_000))).toBeGreaterThan(expenseFloor(1, 0, c(250_000)));
  });
});

describe("borrowing power", () => {
  it("services the surplus at the rate plus the 3% buffer", () => {
    const r = borrowingPower(base());
    const net = calculatePay({ year: "2026-27", salary: c(100_000) }).net;
    expect(r.assessmentRate).toBeCloseTo(0.09);
    expect(r.monthly.income).toBe(Math.round(net / 12));
    expect(r.monthly.expenses).toBe(c(2_000)); // above the $1,860 floor
    expect(r.monthly.surplus).toBe(r.monthly.income - c(2_000));
    // The surplus repays the loan at the assessment rate, to within a cent of rounding.
    expect(Math.abs(r.assessedRepayment - r.monthly.surplus)).toBeLessThanOrEqual(1);
    expect(r.repayment).toBe(calcMinRepayment(r.maxLoan, 0.06, 30, "monthly"));
    // About $554k for a single on $100k spending $2,000 a month.
    expect(r.maxLoan / 100).toBeGreaterThan(530_000);
    expect(r.maxLoan / 100).toBeLessThan(580_000);
    expect(r.warnings).toEqual([]);
  });

  it("uses the floor when declared spending is lower", () => {
    const r = borrowingPower(base({ livingExpenses: c(800) }));
    expect(r.monthly.expenses).toBe(expenseFloor(1, 0, c(100_000)));
    expect(r.warnings).toContainEqual({ kind: "expenses-floored", floor: r.monthly.expenseFloor });
  });

  it("counts card limits whether used or not", () => {
    const without = borrowingPower(base());
    const withCard = borrowingPower(base({ cardLimits: c(10_000) }));
    expect(withCard.monthly.cards).toBe(c(380));
    expect(withCard.maxLoan).toBeLessThan(without.maxLoan - c(40_000));
  });

  it("assesses other home loans at the assessment rate", () => {
    const r = borrowingPower(base({ homeLoans: [{ balance: c(200_000), termYears: 25 }] }));
    expect(r.monthly.homeLoans).toBe(calcMinRepayment(c(200_000), 0.09, 25, "monthly"));
  });

  it("shades overtime, bonus and rent by policy", () => {
    const input = base({ applicants: [{ salary: c(80_000), overtime: c(20_000) }] });
    const cautious = borrowingPower(input, LENDER_PROFILES.cautious);
    const generous = borrowingPower(input, LENDER_PROFILES.generous);
    expect(cautious.applicants[0].assessed).toBe(c(90_000));
    expect(generous.applicants[0].assessed).toBe(c(100_000));
    expect(cautious.applicants[0].gross).toBe(c(100_000));
    expect(cautious.maxLoan).toBeLessThan(generous.maxLoan);
  });

  it("lends more to a couple, less with dependants", () => {
    const one = borrowingPower(base());
    const two = borrowingPower(
      base({ applicants: [{ salary: c(100_000) }, { salary: c(70_000) }] }),
    );
    const kids = borrowingPower(
      base({ applicants: [{ salary: c(100_000) }, { salary: c(70_000) }], dependants: 2 }),
    );
    expect(two.maxLoan).toBeGreaterThan(one.maxLoan);
    expect(kids.maxLoan).toBeLessThan(two.maxLoan);
  });

  it("takes HELP repayments out of income", () => {
    const help = borrowingPower(base({ applicants: [{ salary: c(100_000), studyLoan: true }] }));
    expect(help.maxLoan).toBeLessThan(borrowingPower(base()).maxLoan);
  });

  it("caps at the lender's debt-to-income limit", () => {
    const r = borrowingPower(base({ livingExpenses: c(0), rate: 0.01 }), LENDER_PROFILES.cautious);
    expect(r.serviceableLoan).toBeGreaterThan(r.maxLoan);
    expect(r.maxLoan).toBe(c(600_000));
    expect(r.dti).toBeCloseTo(6);
    expect(r.warnings.some((w) => w.kind === "dti-capped")).toBe(true);
  });

  it("returns nothing when there's no surplus", () => {
    const r = borrowingPower(base({ livingExpenses: c(10_000) }));
    expect(r.maxLoan).toBe(0);
    expect(r.repayment).toBe(0);
    expect(r.warnings).toContainEqual({ kind: "no-surplus" });
  });

  it("adds the deposit for a price", () => {
    const r = borrowingPower(base({ deposit: c(100_000) }));
    expect(r.price).toBe(r.maxLoan + c(100_000));
    expect(borrowingPower(base()).price).toBeNull();
  });

  it("orders the range", () => {
    const { low, typical, high } = borrowingRange(
      base({ applicants: [{ salary: c(90_000), bonus: c(15_000) }], cardLimits: c(5_000) }),
    );
    expect(low.maxLoan).toBeLessThan(typical.maxLoan);
    expect(typical.maxLoan).toBeLessThan(high.maxLoan);
  });
});

describe("levers", () => {
  it("ranks what helps most", () => {
    const levers = borrowingLevers(
      base({
        cardLimits: c(15_000),
        loanRepayments: c(600),
        loanBalances: c(20_000),
        termYears: 25,
      }),
    );
    const kinds = levers.map((l) => l.lever);
    expect(kinds).toContain("close-cards");
    expect(kinds).toContain("clear-loans");
    expect(kinds).toContain("longer-term");
    expect(kinds[kinds.length - 1]).toBe("rate-up");
    for (let i = 1; i < levers.length; i++)
      expect(levers[i].change).toBeLessThanOrEqual(levers[i - 1].change);
  });
});

describe("validation", () => {
  it("rejects bad input", () => {
    expect(validateBorrowing(base())).toEqual([]);
    expect(validateBorrowing(base({ applicants: [] }))).not.toEqual([]);
    expect(validateBorrowing(base({ rate: -0.01 }))).not.toEqual([]);
    expect(validateBorrowing(base({ termYears: 0 }))).not.toEqual([]);
    expect(validateBorrowing(base({ dependants: 1.5 }))).not.toEqual([]);
    expect(() => borrowingPower(base({ cardLimits: c(-1) }))).toThrow(RangeError);
  });
});
