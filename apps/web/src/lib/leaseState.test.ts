import { calculateNovatedLease } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  altCar,
  decodeLeaseState,
  defaultLeaseState,
  encodeLeaseState,
  type LeaseState,
  leaseStateFromPay,
  switchQuoteAmounts,
  toLeaseInput,
  withAltCar,
} from "./leaseState";
import { defaultPayState, encodePayState } from "./payState";
import { b64urlEncode } from "./state";

const FULL: LeaseState = {
  ...defaultLeaseState("2026-11-04"),
  salary: 145_000,
  year: "2027-28",
  studyLoan: true,
  hospitalCover: false,
  car: "phev",
  price: 72_500,
  onRoads: 4_200,
  start: "2027-02-15",
  termYears: 5,
  ratePct: 8.25,
  residualPct: 30,
  fee: 650,
  establishmentFee: 214.63,
  financedFees: 29.95,
  otherMonthly: 28.44,
  inAdvance: true,
  quoteAmounts: true,
  energy: 1_400,
  rego: 950,
  insurance: 1_800,
  servicing: 900,
  loanPct: undefined,
  savingsPct: 5,
  show: "monthly",
  quoteFinanced: 70_000,
  quoteResidual: 21_000,
  quoteRental: 1_234.56,
};

describe("lease URL state", () => {
  it("round-trips every field", () => {
    expect(decodeLeaseState(encodeLeaseState(FULL))).toEqual(FULL);
    const d = defaultLeaseState("2026-11-04");
    expect(decodeLeaseState(encodeLeaseState(d))).toEqual(d);
  });

  it("falls back on bad or foreign links", () => {
    const d = defaultLeaseState("2026-11-04");
    expect(decodeLeaseState("v=1&n=%%%", d)).toEqual(d);
    expect(decodeLeaseState("v=9&n=e30", d)).toEqual(d);
    expect(decodeLeaseState(encodePayState(defaultPayState()), d)).toEqual(d);
  });

  it("clamps out-of-range values", () => {
    const q = encodeLeaseState({ ...FULL, termYears: 9, ratePct: 99, price: -5, start: "nope" });
    const s = decodeLeaseState(q, defaultLeaseState("2026-11-04"));
    expect(s.termYears).toBe(5);
    expect(s.ratePct).toBe(30);
    expect(s.price).toBe(1);
    expect(s.start).toBe("2026-11-04");
  });
});

describe("switchQuoteAmounts", () => {
  it("turns yearly amounts with GST into monthly ones without, and back", () => {
    const d = { ...defaultLeaseState("2026-11-04"), insurance: 2_640, rego: 900 };
    const q = switchQuoteAmounts(d, true);
    expect(q.insurance).toBe(200);
    expect(q.rego).toBe(75);
    expect(switchQuoteAmounts(q, false).insurance).toBe(2_640);
    // The engine packages the same amount either way: $2,640 with GST is $200 a month without.
    expect(toLeaseInput(q).running.insurance).toBe(
      Math.round(toLeaseInput(d).running.insurance / 1.1),
    );
  });

  it("decodes links made before the quote fields existed", () => {
    const old = new URLSearchParams({
      v: "1",
      n: b64urlEncode(JSON.stringify({ p: [90_000] })),
    }).toString();
    const s = decodeLeaseState(old, defaultLeaseState("2026-11-04"));
    expect(s.salary).toBe(90_000);
    expect(s.quoteAmounts).toBe(false);
    expect(s.financedFees).toBe(0);
  });
});

describe("leaseStateFromPay", () => {
  it("takes salary, year, HELP and hospital cover from the pay calculator", () => {
    const pay = {
      ...defaultPayState("2026-11-04"),
      amount: 4_000,
      per: "fortnight" as const,
      studyLoan: true,
      hospitalCover: false,
    };
    const s = leaseStateFromPay(encodePayState(pay), "2026-11-04");
    expect(s.salary).toBe(104_000);
    expect(s.studyLoan).toBe(true);
    expect(s.hospitalCover).toBe(false);
    expect(leaseStateFromPay(null, "2026-11-04")).toEqual(defaultLeaseState("2026-11-04"));
  });
});

describe("toLeaseInput", () => {
  it("converts to cents and rates the engine accepts", () => {
    const input = toLeaseInput(FULL);
    expect(input.price).toBe(7_250_000);
    expect(input.rate).toBeCloseTo(0.0825);
    expect(input.residualRate).toBeCloseTo(0.3);
    expect(input.loanRate).toBeUndefined();
    expect(input.running.maintenance).toBe(1_080_000); // a month, as on a quote
    expect(input.otherCharges).toBe(341_28);
    expect(() => calculateNovatedLease(input)).not.toThrow();
  });

  it("round-trips a second car, and old links decode without one", () => {
    const alt = { car: "ice" as const, price: 46_000, energy: 2_700, servicing: 650 };
    expect(decodeLeaseState(encodeLeaseState({ ...FULL, alt })).alt).toEqual(alt);
    expect(decodeLeaseState(encodeLeaseState(FULL)).alt).toBeUndefined();
    const junk = new URLSearchParams(encodeLeaseState(FULL));
    const o = JSON.parse(atob((junk.get("n") ?? "").replace(/-/g, "+").replace(/_/g, "/")));
    o.e = [99, 1, 1, 1];
    junk.set(
      "n",
      btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    );
    expect(decodeLeaseState(junk.toString()).alt).toBeUndefined();
  });

  it("offers an example second car opposite the first, and swaps it into the form", () => {
    const ev = { ...FULL, car: "ev" as const, alt: undefined };
    expect(altCar(ev).car).toBe("ice");
    expect(altCar({ ...ev, car: "ice" }).car).toBe("ev");
    const typed = { car: "phev" as const, price: 50_000, energy: 1, servicing: 2 };
    expect(withAltCar({ ...FULL, alt: typed })).toMatchObject(typed);
    expect(withAltCar({ ...FULL, alt: typed }).alt).toBeUndefined();
  });
});
