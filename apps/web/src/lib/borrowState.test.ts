import { borrowingPower } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  type BorrowForm,
  decodeBorrow,
  defaultBorrow,
  encodeBorrow,
  toBorrowInput,
} from "./borrowState";
import { b64urlEncode } from "./state";

describe("borrow state", () => {
  it("round-trips through the URL", () => {
    const f: BorrowForm = {
      ...defaultBorrow(),
      people: [{ salary: 90_000, bonus: 5_000, rent: 20_000, help: true }],
      homeLoans: [{ balance: 300_000, termYears: 22 }],
      otherCommitments: 400,
      deposit: undefined,
    };
    expect(decodeBorrow(encodeBorrow(f))).toEqual(f);
  });

  it("round-trips a comfortable repayment and old links still decode", () => {
    const f: BorrowForm = { ...defaultBorrow(), comfort: 1_400, comfortFreq: "fortnightly" };
    expect(decodeBorrow(encodeBorrow(f))).toEqual(f);
    const old = b64urlEncode(JSON.stringify({ p: [[90_000, null, null, null, null, 0]], r: 6 }));
    const g = decodeBorrow(`v=1&s=${old}`);
    expect(g.comfort).toBeUndefined();
    expect(g.comfortFreq).toBe("monthly");
    expect(decodeBorrow(encodeBorrow(defaultBorrow()))).toEqual(defaultBorrow());
  });

  it("falls back on broken or hostile links", () => {
    const fb = defaultBorrow();
    expect(decodeBorrow("", fb)).toEqual(fb);
    expect(decodeBorrow("v=1&s=!!!", fb)).toEqual(fb);
    expect(decodeBorrow("v=9&s=e30", fb)).toEqual(fb);
    const bad = b64urlEncode(
      JSON.stringify({ p: [[-5, "x"], [1], [2]], d: 99, r: 80, t: 0, h: [[1, 100]] }),
    );
    const f = decodeBorrow(`v=1&s=${bad}`, fb);
    expect(f.people).toHaveLength(2);
    expect(f.people[0].salary).toBe(0);
    expect(f.dependants).toBe(fb.dependants);
    expect(f.ratePct).toBe(fb.ratePct);
    expect(f.termYears).toBe(fb.termYears);
    expect(f.homeLoans[0].termYears).toBe(25);
  });

  it("converts to engine cents and the financial year", () => {
    const input = toBorrowInput(defaultBorrow(), "2026-11-04");
    expect(input.year).toBe("2026-27");
    expect(input.applicants[0].salary).toBe(11_000_000);
    expect(input.rate).toBeCloseTo(0.06);
    expect(borrowingPower(input).maxLoan).toBeGreaterThan(0);
  });
});
