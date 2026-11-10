import { projectSuper } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import { b64urlDecode, b64urlEncode } from "./state";
import {
  decodeSuperState,
  defaultPension,
  defaultSuperState,
  encodeSuperState,
  newAccount,
  nextId,
  type SuperState,
  toSuperInput,
} from "./superState";

const FULL: SuperState = {
  people: [
    {
      id: "p1",
      name: "Jo ☕",
      age: 41,
      retireAge: 65,
      salary: 123_456.78,
      employerPct: 15,
      accounts: [
        { ...newAccount("p1a1", "Main", true), balance: 210_000, sacrifice: 400 },
        {
          ...newAccount("p1a2", "Old job"),
          balance: 12_000,
          returnPct: 6.2,
          feeFixed: 78,
          feePct: 0.85,
          afterTax: 100,
        },
      ],
    },
    { id: "p2", name: "Kim", age: 70, retireAge: 67, salary: 0, accounts: [newAccount("p2a1")] },
  ],
  wageGrowthPct: 3.2,
  inflationPct: 2.7,
  incomeUntil: 92,
  startDate: "2026-11-04",
  extraPerWeek: 75,
  pension: { homeowner: false, savings: 40_000, otherAssets: 15_500, otherIncome: 120 },
};

describe("super URL state", () => {
  it("round-trips every field", () => {
    expect(decodeSuperState(encodeSuperState(FULL))).toEqual(FULL);
  });

  it("keeps a link from before the Age Pension, with its defaults", () => {
    const q = new URLSearchParams(encodeSuperState(FULL));
    const c = JSON.parse(b64urlDecode(q.get("s") ?? ""));
    delete c.a;
    q.set("s", b64urlEncode(JSON.stringify(c)));
    expect(decodeSuperState(q.toString()).pension).toEqual(defaultPension());
  });

  it("falls back for junk, a wrong version or no people", () => {
    const fb = defaultSuperState("2026-01-01");
    expect(decodeSuperState("s=%%%", fb)).toEqual(fb);
    const q = new URLSearchParams(encodeSuperState(FULL));
    q.set("v", "3");
    expect(decodeSuperState(q.toString(), fb)).toEqual(fb);
    expect(decodeSuperState(encodeSuperState({ ...FULL, people: [] }), fb)).toEqual(fb);
  });

  it("round-trips the compare-fees section, and old links have none", () => {
    expect(decodeSuperState(encodeSuperState(FULL)).fees).toBeUndefined();
    const fees = { a: { fixed: 78, pct: 1.1 }, b: { fixed: 52, pct: 0.65 } };
    expect(decodeSuperState(encodeSuperState({ ...FULL, fees })).fees).toEqual(fees);
    expect(decodeSuperState(encodeSuperState({ ...FULL, fees }))).toEqual({ ...FULL, fees });
  });

  it("ignores a damaged compare-fees key and clamps wild values", () => {
    const raw = JSON.parse(
      Buffer.from(
        new URLSearchParams(encodeSuperState(FULL)).get("s") ?? "",
        "base64url",
      ).toString(),
    );
    const enc = (c: unknown) =>
      new URLSearchParams({
        v: "1",
        s: Buffer.from(JSON.stringify({ ...raw, c })).toString("base64url"),
      }).toString();
    expect(decodeSuperState(enc([1, 2])).fees).toBeUndefined();
    expect(decodeSuperState(enc("x")).fees).toBeUndefined();
    expect(decodeSuperState(enc([1, null, 2, 3])).fees).toBeUndefined();
    expect(decodeSuperState(enc([-5, 99, 10, 0.5])).fees).toEqual({
      a: { fixed: 0, pct: 5 },
      b: { fixed: 10, pct: 0.5 },
    });
  });

  it("repairs duplicate ids and gives a person with no funds one", () => {
    const dup = { ...FULL, people: [FULL.people[1], { ...FULL.people[1], accounts: [] }] };
    const out = decodeSuperState(encodeSuperState(dup));
    expect(new Set(out.people.map((p) => p.id)).size).toBe(2);
    expect(out.people[1].accounts).toHaveLength(1);
    expect(nextId("p", ["p1", "p2"])).toBe("p3");
  });
});

describe("toSuperInput", () => {
  it("converts monthly dollars to yearly cents and percent to rates", () => {
    const input = toSuperInput(FULL);
    const [jo] = input.people;
    expect(jo.salary).toBe(12_345_678);
    expect(jo.employerRate).toBeCloseTo(0.15);
    expect(jo.accounts[0].salarySacrifice).toBe(480_000);
    expect(jo.accounts[1]).toMatchObject({ afterTax: 120_000, adminFeeFixed: 7_800 });
    expect(jo.accounts[1].adminFeePct).toBeCloseTo(0.0085);
    expect(input.people[1].employerRate).toBeUndefined();
    expect(() => projectSuper(input)).not.toThrow();
  });

  it("the example household runs", () => {
    const r = projectSuper(toSuperInput(defaultSuperState("2026-11-04")));
    expect(r.people).toHaveLength(2);
    expect(r.householdIncomePerYear).toBeGreaterThan(0);
  });
});
