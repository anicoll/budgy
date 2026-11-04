import { compareSuperOrMortgage, validateSuperOrMortgage } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  applySomLoan,
  compareYears,
  decodeSomState,
  defaultSomState,
  encodeSomState,
  readSomLoan,
  type SomState,
  spareMonthly,
  toSomInput,
} from "./superMortgageState";

const FULL: SomState = {
  people: [
    {
      id: "p1",
      name: "Jo ☕",
      age: 41,
      retireAge: 65,
      salary: 123_456.78,
      sacrificing: 2_000,
      superBalance: 210_000,
      help: true,
      privateCover: false,
    },
    {
      id: "p2",
      name: "Kim",
      age: 45,
      retireAge: 60,
      salary: 60_000,
      sacrificing: 0,
      superBalance: 0,
      help: false,
      privateCover: true,
    },
  ],
  loan: {
    balance: 512_345,
    ratePct: 5.89,
    termYears: 22,
    frequency: "fortnightly",
    offset: 20_000,
  },
  spare: 150,
  sparePer: "week",
  superReturnPct: 6.5,
  inflationPct: 2.7,
  compareTo: "p2",
  startDate: "2026-11-04",
};

describe("super or mortgage state", () => {
  it("round-trips through the URL", () => {
    expect(decodeSomState(encodeSomState(FULL))).toEqual(FULL);
    const years = { ...FULL, compareTo: undefined, compareYears: 12 };
    expect(decodeSomState(encodeSomState(years))).toEqual(years);
  });

  it("falls back on bad or missing data", () => {
    const fb = defaultSomState("2026-11-04");
    expect(decodeSomState("", fb)).toBe(fb);
    expect(decodeSomState("v=1&s=nope", fb)).toBe(fb);
    expect(decodeSomState("v=9&s=e30", fb)).toBe(fb);
  });

  it("turns spare cash into a monthly amount", () => {
    expect(spareMonthly({ spare: 120, sparePer: "week" })).toBe(52_000);
    expect(spareMonthly({ spare: 12_000, sparePer: "year" })).toBe(100_000);
  });

  it("compares until the chosen person retires, or a number of years", () => {
    expect(compareYears(FULL)).toBe(15);
    expect(compareYears({ ...FULL, compareTo: undefined })).toBe(24);
    expect(compareYears({ ...FULL, compareYears: 7 })).toBe(7);
  });

  it("shares the loan with the other tools", () => {
    const moved = applySomLoan(FULL, { balance: 400_000, ratePct: 6.1 });
    expect(readSomLoan(moved)).toMatchObject({ balance: 400_000, ratePct: 6.1, termYears: 22 });
  });

  it("makes engine input the engine accepts", () => {
    const input = toSomInput(defaultSomState("2026-11-04"));
    expect(validateSuperOrMortgage(input)).toEqual([]);
    expect(compareSuperOrMortgage(input).options).toHaveLength(3);
    expect(validateSuperOrMortgage(toSomInput(FULL))).toEqual([]);
  });
});
