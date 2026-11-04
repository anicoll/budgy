import { planBudget } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  adoptPay,
  budgetLinkFromPay,
  decodeBudgetState,
  defaultBudgetState,
  encodeBudgetState,
  FROM_PAY_PARAM,
  newPerson,
  toBudgetInput,
} from "./budgetState";
import { defaultPayState, encodePayState } from "./payState";

const strip = <T>(v: T): T => JSON.parse(JSON.stringify(v, (k, x) => (k === "id" ? undefined : x)));

describe("budget URL state", () => {
  it("round-trips everything but the React ids", () => {
    const s = defaultBudgetState("2026-11-04");
    s.people.push({
      ...newPerson("Alex", "2026-11-04"),
      mode: "takehome",
      takeHome: 2_250,
      takeHomePer: "fortnight",
    });
    s.people[0].pay = { ...s.people[0].pay, amount: 95_000, studyLoan: true, sacrifice: 4_000 };
    s.other = [{ id: "o", label: "Rent from the granny flat", amount: 350, per: "week" }];
    s.categories[0].lines[0].amount = 3_450;
    s.categories[1].bucket = "want";
    s.view = "fortnight";
    expect(strip(decodeBudgetState(encodeBudgetState(s)))).toEqual(strip(s));
  });

  it("falls back on junk, wrong versions and missing data", () => {
    const fb = defaultBudgetState("2026-11-04");
    expect(decodeBudgetState("", fb)).toBe(fb);
    expect(decodeBudgetState("v=9&b=xx", fb)).toBe(fb);
    expect(decodeBudgetState("v=1&b=!!!", fb)).toBe(fb);
  });

  it("clamps amounts and caps list sizes from a hostile link", () => {
    const b = Buffer.from(
      JSON.stringify({
        p: [["A", 1, null, -5, 99]],
        o: [],
        c: Array.from({ length: 50 }, () => ["X", 7, [["Big", 1e12, 2]]]),
        w: 9,
      }),
    ).toString("base64url");
    const s = decodeBudgetState(`v=1&b=${b}`);
    expect(s.people[0].takeHome).toBe(0);
    expect(s.people[0].takeHomePer).toBe("fortnight");
    expect(s.categories).toHaveLength(20);
    expect(s.categories[0].bucket).toBe("want");
    expect(s.categories[0].lines[0].amount).toBe(10_000_000);
    expect(() => planBudget(toBudgetInput(s))).not.toThrow();
  });
});

describe("carrying pay over from the pay calculator", () => {
  const pay = { ...defaultPayState("2026-11-04"), amount: 120_000, studyLoan: true };

  it("takes a link's pay over saved budget pay", () => {
    const s = defaultBudgetState("2026-11-04");
    const search = new URL(budgetLinkFromPay(pay), "https://x.test/pay").search;
    const out = adoptPay(s, search, undefined, false);
    expect(out.people[0].mode).toBe("salary");
    expect(out.people[0].pay.amount).toBe(120_000);
    expect(out.people[0].pay.studyLoan).toBe(true);
  });

  it("starts a first visit from the saved pay calculator", () => {
    const s = defaultBudgetState("2026-11-04");
    expect(adoptPay(s, "", encodePayState(pay), true).people[0].pay.amount).toBe(120_000);
    // Not on a return visit: the budget's own pay stands.
    expect(adoptPay(s, "", encodePayState(pay), false)).toBe(s);
  });

  it("ignores a broken pay param", () => {
    const s = defaultBudgetState("2026-11-04");
    expect(adoptPay(s, `?${FROM_PAY_PARAM}=nonsense`, undefined, false)).toBe(s);
  });

  it("gives the same take-home as the pay calculator", () => {
    const s = adoptPay(defaultBudgetState("2026-11-04"), "", encodePayState(pay), true);
    const r = planBudget(toBudgetInput(s));
    expect(r.incomeYear).toBeGreaterThan(0);
    expect(r.income[0].pay?.salary).toBe(12_000_000);
  });
});
