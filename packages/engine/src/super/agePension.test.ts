import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { AGE_PENSION_RULES, agePension, deemedIncomeYear, validateAgePension } from "./agePension";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;

describe("agePension", () => {
  it("pays the full rate with few assets", () => {
    const r = agePension({
      couple: false,
      homeowner: true,
      assets: c(20_000),
      financialAssets: c(20_000),
    });
    expect(r.each).toBe(c(1_237.7));
    expect(r.limitedBy).toBe("full");
    const couple = agePension({
      couple: true,
      homeowner: true,
      assets: c(50_000),
      financialAssets: c(50_000),
    });
    expect(couple.fortnight).toBe(c(1_866));
    expect(couple.each).toBe(c(933));
  });

  it("cuts out at the published assets cut-off points", () => {
    // Single homeowner cut-off: $745,750. Couple homeowner: $1,121,000.
    const nearSingle = (assets: number) =>
      agePension({ couple: false, homeowner: true, assets: c(assets), financialAssets: 0 as Cents })
        .fortnight;
    expect(nearSingle(744_000)).toBeGreaterThan(0);
    expect(nearSingle(746_000)).toBe(0);
    const nearCouple = (assets: number) =>
      agePension({ couple: true, homeowner: true, assets: c(assets), financialAssets: 0 as Cents })
        .fortnight;
    expect(nearCouple(1_120_000)).toBeGreaterThan(0);
    expect(nearCouple(1_122_000)).toBe(0);
  });

  it("takes $3 a fortnight per $1,000 over the assets limit", () => {
    const r = agePension({
      couple: false,
      homeowner: true,
      assets: c(433_000),
      financialAssets: 0 as Cents,
    });
    expect(r.fortnight).toBe(c(1_237.7 - 300));
    expect(r.limitedBy).toBe("assets");
  });

  it("cuts out near the published income cut-off points", () => {
    // Single: $2,701.40 a fortnight. Couple combined: $4,128.00.
    const single = (inc: number) =>
      agePension({
        couple: false,
        homeowner: true,
        assets: 0 as Cents,
        financialAssets: 0 as Cents,
        otherIncomeFortnight: c(inc),
      }).fortnight;
    expect(single(2_700)).toBeGreaterThan(0);
    expect(single(2_702)).toBe(0);
    const couple = (inc: number) =>
      agePension({
        couple: true,
        homeowner: true,
        assets: 0 as Cents,
        financialAssets: 0 as Cents,
        otherIncomeFortnight: c(inc),
      }).fortnight;
    expect(couple(4_126)).toBeGreaterThan(0);
    expect(couple(4_130)).toBe(0);
  });

  it("deems financial assets at the two rates", () => {
    expect(deemedIncomeYear(c(66_800), false)).toBe(c(1_169));
    expect(deemedIncomeYear(c(166_800), false)).toBe(c(1_169 + 3_750));
  });

  it("lets the lower of the two tests set the rate", () => {
    const r = agePension({
      couple: false,
      homeowner: true,
      assets: c(500_000),
      financialAssets: c(500_000),
    });
    expect(r.fortnight).toBe(Math.min(r.byIncomeTest, r.byAssetsTest));
  });

  it("validates", () => {
    expect(
      validateAgePension({ couple: false, homeowner: true, assets: c(10), financialAssets: c(20) }),
    ).toHaveLength(1);
    expect(AGE_PENSION_RULES.age).toBe(67);
  });
});
