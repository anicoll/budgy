import { checkSacrifice } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  activePeople,
  decodeSacrificeState,
  defaultSacrificeState,
  encodeSacrificeState,
  newPerson,
  type SacrificeState,
  toSacrificeInput,
} from "./sacrificeState";

const FULL: SacrificeState = {
  year: "2027-28",
  mode: "household",
  show: "monthly",
  budget: 7_500,
  people: [
    {
      ...newPerson("p1", "Jo ☕", 145_000),
      employerPct: 15,
      current: 2_000,
      personal: 1_000,
      extra: 4_000,
      extraFund: "p1f2",
      unusedCaps: 9_000,
      studyLoan: true,
      hospitalCover: false,
      funds: [
        { id: "p1f1", name: "Main", balance: 210_000 },
        { id: "p1f2", name: "Old job", balance: 12_000 },
      ],
    },
    newPerson("p2", "Kim", 60_000),
  ],
};

describe("sacrifice URL state", () => {
  it("round-trips everything", () => {
    expect(decodeSacrificeState(encodeSacrificeState(FULL))).toEqual(FULL);
  });

  it("falls back on junk", () => {
    const fb = defaultSacrificeState("2026-11-04");
    expect(decodeSacrificeState("", fb)).toBe(fb);
    expect(decodeSacrificeState("v=1&s=nope", fb)).toBe(fb);
    expect(decodeSacrificeState("v=9&s=e30", fb)).toBe(fb);
  });

  it("defaults to this financial year", () => {
    expect(defaultSacrificeState("2026-11-04").year).toBe("2026-27");
    expect(defaultSacrificeState("2031-01-01").year).toBe("2026-27");
  });
});

describe("toSacrificeInput", () => {
  it("puts the extra in the chosen fund and what's in place in the first", () => {
    const input = toSacrificeInput(FULL);
    const [jo] = input.people;
    expect(jo.funds[0].salarySacrifice).toBe(200_000);
    expect(jo.funds[0].personalDeductible).toBe(100_000);
    expect(jo.funds[0].extra).toBe(0);
    expect(jo.funds[1].extra).toBe(400_000);
    expect(jo.pay.superRate).toBe(0.15);
    expect(jo.pay.hospitalCover).toBe(false);
    expect(input.householdBudget).toBe(750_000);
    expect(() => checkSacrifice(input)).not.toThrow();
  });

  it("covers only the first person in 'just me'", () => {
    const me = { ...FULL, mode: "me" as const };
    expect(activePeople(me)).toHaveLength(1);
    expect(toSacrificeInput(me).householdBudget).toBeUndefined();
  });
});
