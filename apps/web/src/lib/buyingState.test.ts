import { buyingCosts } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  type BuyingForm,
  buyingLinkFor,
  decodeBuying,
  defaultBuying,
  encodeBuying,
  toBuyingInput,
} from "./buyingState";

const FULL: BuyingForm = {
  state: "WA",
  price: 720_000,
  deposit: 36_000,
  buyer: "ownerOccupier",
  property: "land",
  foreign: true,
  homeGuarantee: true,
  lmiOnLoan: true,
  conveyancing: 1_500,
  inspections: 0,
  loanFees: 395,
  other: 1_200,
  view: "compare",
};

describe("buying costs URL state", () => {
  it("round-trips every field", () => {
    expect(decodeBuying(encodeBuying(FULL))).toEqual(FULL);
  });

  it("round-trips the defaults", () => {
    expect(decodeBuying(encodeBuying(defaultBuying()), FULL)).toEqual(defaultBuying());
  });

  it("falls back on a missing version or bad values", () => {
    const fb = defaultBuying();
    expect(decodeBuying("", fb)).toBe(fb);
    const f = decodeBuying("v=1&s=XX&p=-5&b=nobody&k=castle", fb);
    expect(f.state).toBe("NSW");
    expect(f.price).toBe(850_000);
    expect(f.buyer).toBe("firstHome");
    expect(f.property).toBe("existing");
  });

  it("feeds the engine, capping the deposit at the price", () => {
    const r = buyingCosts(toBuyingInput({ ...defaultBuying(), deposit: 2_000_000 }));
    expect(r.loan).toBe(0);
    expect(r.lmi.premium).toBe(0);
    expect(r.fees.mortgage).toBe(0);
  });
});

describe("link from the borrowing tool", () => {
  it("fills in the price and deposit and keeps the rest", () => {
    const saved = encodeBuying({
      ...defaultBuying(),
      state: "QLD",
      buyer: "investor",
      view: "compare",
    });
    const q = buyingLinkFor(712_345, 90_000, saved).split("?")[1];
    const f = decodeBuying(q);
    expect(f).toMatchObject({
      price: 712_000,
      deposit: 90_000,
      state: "QLD",
      buyer: "investor",
      view: "costs",
    });
  });

  it("starts from the defaults and caps the deposit at the price", () => {
    const f = decodeBuying(buyingLinkFor(500_000, 600_000).split("?")[1]);
    expect(f).toMatchObject({ ...defaultBuying(), price: 500_000, deposit: 500_000 });
  });
});
