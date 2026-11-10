import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { annualFee, compareFundFees, type FundFees } from "./feeCompare";
import type { SuperAccount, SuperInput } from "./project";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const fees = (fixed: number, pct: number): FundFees => ({ fixed: c(fixed), pct });

const account = (over: Partial<SuperAccount> = {}): SuperAccount => ({
  id: "a1",
  name: "Fund",
  balance: c(90_000),
  returnPct: 0.07,
  adminFeeFixed: c(78),
  adminFeePct: 0.011,
  salarySacrifice: 0 as Cents,
  afterTax: 0 as Cents,
  receivesEmployer: true,
  ...over,
});

const input = (accounts: SuperAccount[] = [account()]): SuperInput => ({
  people: [
    { id: "p1", name: "Alex", age: 37, retireAge: 67, salary: c(95_000), accounts },
    {
      id: "p2",
      name: "Sam",
      age: 40,
      retireAge: 67,
      salary: c(80_000),
      accounts: [account({ id: "b1" })],
    },
  ],
  startDate: "2026-07-01",
  wageGrowth: 0.035,
  inflation: 0.025,
  incomeUntilAge: 90,
});

describe("annualFee", () => {
  it("adds the dollar fee to a percent of the balance", () => {
    // $78 + 1.10% of $90,000 = $1,068.
    expect(annualFee(fees(78, 0.011), c(90_000))).toBe(c(1_068));
    expect(annualFee(fees(0, 0), c(90_000))).toBe(0);
  });
});

describe("compareFundFees", () => {
  it("is zero when both funds charge the same", () => {
    const r = compareFundFees(input(), "p1", "a1", fees(78, 0.011), fees(78, 0.011));
    expect(r?.difference).toBe(0);
    expect(r?.a).toBe(r?.b);
  });

  it("lower fees end with more, by the same amount either way round", () => {
    const hi = fees(78, 0.011);
    const lo = fees(52, 0.0065);
    const fwd = compareFundFees(input(), "p1", "a1", hi, lo);
    const back = compareFundFees(input(), "p1", "a1", lo, hi);
    expect(fwd?.difference).toBeGreaterThan(0);
    expect(back?.difference).toBe(-(fwd?.difference ?? 0));
    expect(fwd?.b).toBe(back?.a);
  });

  it("matches projecting with each fee set directly", () => {
    const hi = fees(78, 0.011);
    const r = compareFundFees(input(), "p1", "a1", hi, fees(0, 0));
    // With no fees at all the account only loses contributions tax.
    expect(r?.difference).toBeGreaterThan(c(20_000));
    const same = compareFundFees(
      input([account({ adminFeeFixed: hi.fixed, adminFeePct: hi.pct })]),
      "p1",
      "a1",
      hi,
      hi,
    );
    expect(same?.a).toBe(r?.a);
  });

  it("a bigger fee gap over more years costs more", () => {
    const short = input();
    short.people[0].retireAge = 50;
    const a = compareFundFees(short, "p1", "a1", fees(78, 0.011), fees(52, 0.0065));
    const b = compareFundFees(input(), "p1", "a1", fees(78, 0.011), fees(52, 0.0065));
    expect((b?.difference ?? 0) > (a?.difference ?? 0)).toBe(true);
  });

  it("leaves a person's other accounts alone", () => {
    const other = account({
      id: "a2",
      name: "Old fund",
      balance: c(20_000),
      receivesEmployer: false,
    });
    const one = compareFundFees(input(), "p1", "a1", fees(78, 0.011), fees(52, 0.0065));
    const two = compareFundFees(
      input([account(), other]),
      "p1",
      "a1",
      fees(78, 0.011),
      fees(52, 0.0065),
    );
    // Same gap to within the other account's own growth, which does not change.
    expect(Math.abs((two?.difference ?? 0) - (one?.difference ?? 0))).toBeLessThanOrEqual(2);
  });

  it("is null for an unknown person or account, or bad input", () => {
    expect(compareFundFees(input(), "zz", "a1", fees(0, 0), fees(0, 0))).toBeNull();
    expect(compareFundFees(input(), "p1", "zz", fees(0, 0), fees(0, 0))).toBeNull();
    expect(compareFundFees(input(), "p1", "a1", fees(0, 0), fees(0, -1))).toBeNull();
  });
});
