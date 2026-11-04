import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  checkSacrifice,
  listoFor,
  maxExtra,
  type SacrificeFund,
  type SacrificePerson,
  sacrificeEffect,
  sacrificeForTakeHome,
  splitBudget,
  usableCarryForward,
  validateSacrifice,
} from "./sacrifice";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const Y = "2026-27";

const fund = (over: Partial<SacrificeFund> = {}): SacrificeFund => ({
  id: "f1",
  name: "Fund",
  balance: c(100_000),
  salarySacrifice: 0 as Cents,
  personalDeductible: 0 as Cents,
  extra: 0 as Cents,
  ...over,
});

const person = (salary: number, over: Partial<SacrificePerson> = {}): SacrificePerson => ({
  id: "p1",
  name: "Alex",
  pay: { salary: c(salary) },
  funds: [fund()],
  ...over,
});

describe("sacrificeEffect", () => {
  it("$10k on $100k: costs $6,800 take-home and adds $8,500 to super", () => {
    const e = sacrificeEffect(person(100_000), Y, c(10_000));
    // Taxable 100k → 90k: tax 20,520 → 17,520, Medicare 2,000 → 1,800.
    expect(e.taxSaved).toBe(c(3_200));
    expect(e.takeHomeCost).toBe(c(6_800));
    expect(e.contributionsTax).toBe(c(1_500));
    expect(e.division293).toBe(0);
    expect(e.intoSuper).toBe(c(8_500));
    expect(e.netGain).toBe(c(1_700));
    expect(e.superPerDollar).toBeCloseTo(1.25, 6);
    expect(e.after.concessional).toBe(c(22_000));
    expect(e.after.headroom).toBe(c(10_500));
  });

  it("adds what's already sacrificed and claimed to the concessional total", () => {
    const p = person(100_000, {
      funds: [
        fund({ salarySacrifice: c(5_000) }),
        fund({ id: "f2", personalDeductible: c(3_000) }),
      ],
    });
    const e = sacrificeEffect(p, Y, c(1_000));
    expect(e.before.concessional).toBe(c(20_000));
    expect(e.after.concessional).toBe(c(21_000));
    // Taxable 100k − 5k sacrifice − 3k deduction = 92k, still the 30% bracket.
    expect(e.before.pay.taxableIncome).toBe(c(92_000));
    expect(e.takeHomeCost).toBe(c(680));
  });

  it("adds Division 293 tax on the extra above $250k", () => {
    const e = sacrificeEffect(person(260_000), Y, c(1_300));
    expect(e.before.division293).toBe(c(4_680));
    expect(e.division293).toBe(c(195));
    expect(e.intoSuper).toBe(c(1_300 - 195 - 195));
    expect(e.after.headroom).toBe(0);
  });

  it("is not worth it under the tax-free threshold, even with LISTO", () => {
    const e = sacrificeEffect(person(20_000), Y, c(1_000));
    expect(e.taxSaved).toBe(0);
    expect(e.takeHomeCost).toBe(c(1_000));
    // LISTO: 15% of 2,400 = 360 → capped at 500 with the extra.
    expect(e.before.listo).toBe(c(360));
    expect(e.listoChange).toBe(c(140));
    expect(e.intoSuper).toBe(c(990));
    expect(e.netGain).toBe(c(-10));
  });
});

describe("caps", () => {
  it("fills the cap less employer super", () => {
    expect(maxExtra(person(100_000), Y)).toBe(c(20_500));
    // Employer super stops at the maximum contribution base: $32,499.60.
    expect(maxExtra(person(300_000), Y)).toBe(c(0.4));
  });

  it("adds carried-forward cap only under a $500k balance", () => {
    const under = person(100_000, {
      unusedCaps: c(20_000),
      funds: [fund({ balance: c(300_000) })],
    });
    expect(usableCarryForward(under)).toBe(c(20_000));
    expect(maxExtra(under, Y)).toBe(c(40_500));
    const over = person(100_000, { unusedCaps: c(20_000), funds: [fund({ balance: c(600_000) })] });
    expect(usableCarryForward(over)).toBe(0);
    const r = checkSacrifice({ year: Y, people: [over] });
    expect(r.people[0].warnings).toContainEqual({
      kind: "carry-forward-blocked",
      balance: c(600_000),
    });
  });

  it("LISTO is 15% up to $500, and nil above $37,000", () => {
    expect(listoFor(c(30_000), c(2_000))).toBe(c(300));
    expect(listoFor(c(37_000), c(5_000))).toBe(c(500));
    expect(listoFor(c(37_001), c(5_000))).toBe(0);
  });
});

describe("sacrificeForTakeHome", () => {
  it("finds the sacrifice that costs a given take-home", () => {
    expect(sacrificeForTakeHome(person(100_000), Y, c(6_800))).toBe(c(10_000));
    expect(sacrificeForTakeHome(person(100_000), Y, 0 as Cents)).toBe(0);
    // More than the cap allows: stops at the cap.
    expect(sacrificeForTakeHome(person(100_000), Y, c(50_000))).toBe(c(20_500));
  });
});

describe("checkSacrifice", () => {
  it("suggests filling the cap and stopping at the 37% bracket edge", () => {
    const r = checkSacrifice({ year: Y, people: [person(145_000)] });
    const [fill, edge] = r.people[0].suggestions;
    expect(fill.kind).toBe("fill-cap");
    expect(fill.extra).toBe(c(32_500 - 17_400));
    expect(edge.kind).toBe("bracket-edge");
    expect(edge.extra).toBe(c(10_000));
    expect(edge.taxableIncome).toBe(c(135_000));
    expect(edge.effect.taxSaved).toBe(c(3_900));
    expect(edge.effect.takeHomeCost).toBe(c(6_100));
  });

  it("warns over the cap and adds up the household", () => {
    const r = checkSacrifice({
      year: Y,
      people: [
        person(100_000, { funds: [fund({ extra: c(25_000) })] }),
        person(80_000, { id: "p2", name: "Sam", funds: [fund({ extra: c(5_000) })] }),
      ],
    });
    expect(r.people[0].warnings).toContainEqual({ kind: "over-cap", over: c(4_500) });
    expect(r.total.extra).toBe(c(30_000));
    expect(r.total.takeHomeCost).toBe(
      (r.people[0].effect.takeHomeCost + r.people[1].effect.takeHomeCost) as Cents,
    );
    expect(r.budgetSplit).toBeNull();
    expect(r.rulesCarriedForward).toBe(false);
  });

  it("splits a household budget to whoever gets the most super per dollar", () => {
    const people = [person(180_000), person(60_000, { id: "p2", name: "Sam" })];
    const split = splitBudget(people, Y, c(5_000));
    expect(split[1].extra).toBe(0);
    expect(split[0].takeHomeCost).toBeLessThanOrEqual(c(5_000));
    expect(split[0].takeHomeCost).toBeGreaterThan(c(4_900));
    const r = checkSacrifice({ year: Y, people, householdBudget: c(5_000) });
    expect(r.budgetSplit).toEqual(split);
  });

  it("rejects bad input", () => {
    expect(validateSacrifice({ year: Y, people: [] })).not.toHaveLength(0);
    const five = Array.from({ length: 5 }, (_, i) => person(50_000, { id: `p${i}` }));
    expect(validateSacrifice({ year: Y, people: five }).join(" ")).toMatch(/At most 4/);
    expect(() =>
      checkSacrifice({ year: Y, people: [person(1, { funds: [fund({ extra: -1 as Cents })] })] }),
    ).toThrow(RangeError);
  });
});
