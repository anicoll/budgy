import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { buyingCosts, estimateLmi, governmentFees } from "./costs";
import { type DutyInput, dutyByState, ntDuty, stampDuty } from "./duty";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;

const duty = (over: Partial<DutyInput> & Pick<DutyInput, "state">, price: number) =>
  stampDuty({ buyer: "investor", property: "existing", ...over, price: c(price) });

// Hand-worked from each revenue office's 2026-27 table.
describe("general rates", () => {
  it.each([
    ["NSW", 800_000, 30_187], // matches Revenue NSW 2026-27 scale
    ["NSW", 850_000, 32_437],
    ["NSW", 10_000, 125],
    ["NSW", 1_000, 20], // minimum duty
    ["NSW", 4_000_000, 203_237], // premium property duty
    ["VIC", 850_000, 46_070],
    ["VIC", 1_000_000, 55_000], // 5.5% of the whole value
    ["VIC", 2_500_000, 142_500],
    ["QLD", 850_000, 31_275],
    ["QLD", 5_000, 0],
    ["SA", 850_000, 40_580],
    ["WA", 850_000, 34_890.5],
    ["TAS", 850_000, 33_435],
    ["TAS", 2_000, 50],
    ["ACT", 850_000, 28_100],
    ["ACT", 1_500_000, 68_100], // 4.54% of the whole value
    ["NT", 850_000, 42_075],
    ["NT", 4_000_000, 230_000],
  ] as const)("%s on $%d is $%d", (state, price, expected) => {
    expect(d(duty({ state }, price).total)).toBe(expected);
  });

  it("NT uses its formula up to $525,000", () => {
    expect(d(ntDuty(c(500_000)))).toBe(23_928.6);
  });

  it("rounds the excess up to the next $100", () => {
    // $387,001 is one $100 unit into the 4.5% band.
    expect(d(duty({ state: "NSW" }, 387_001).total)).toBe(11_606.5);
  });
});

describe("concessions", () => {
  it("NSW first home buyers pay nothing to $800,000 and phase in to $1,000,000", () => {
    expect(d(duty({ state: "NSW", buyer: "firstHome" }, 800_000).total)).toBe(0);
    const mid = duty({ state: "NSW", buyer: "firstHome" }, 850_000);
    expect(d(mid.total)).toBe(9_796.75); // a quarter of the full duty at $1M ($39,187)
    expect(d(mid.saving)).toBe(22_640.25);
    expect(mid.concession).toBe("First Home Buyers Assistance Scheme");
    expect(d(duty({ state: "NSW", buyer: "firstHome" }, 1_000_000).total)).toBe(39_187);
    expect(d(duty({ state: "NSW", buyer: "firstHome", property: "land" }, 350_000).total)).toBe(0);
  });

  it("VIC first home buyers: exempt to $600,000, sliding to $750,000", () => {
    expect(d(duty({ state: "VIC", buyer: "firstHome" }, 600_000).total)).toBe(0);
    expect(d(duty({ state: "VIC", buyer: "firstHome" }, 700_000).total)).toBe(24_713.33);
    expect(d(duty({ state: "VIC", buyer: "firstHome" }, 760_000).total)).toBe(
      d(duty({ state: "VIC" }, 760_000).total),
    );
  });

  it("VIC principal place of residence rate up to $550,000", () => {
    expect(d(duty({ state: "VIC", buyer: "ownerOccupier" }, 500_000).total)).toBe(21_970);
    expect(d(duty({ state: "VIC", buyer: "ownerOccupier" }, 600_000).total)).toBe(
      d(duty({ state: "VIC" }, 600_000).total),
    );
  });

  it("QLD home concession and first home deduction", () => {
    expect(d(duty({ state: "QLD", buyer: "ownerOccupier" }, 850_000).total)).toBe(24_100);
    expect(d(duty({ state: "QLD", buyer: "firstHome" }, 700_000).total)).toBe(0);
    expect(d(duty({ state: "QLD", buyer: "firstHome" }, 750_000).total)).toBe(10_925);
    expect(d(duty({ state: "QLD", buyer: "firstHome" }, 850_000).total)).toBe(24_100);
    expect(d(duty({ state: "QLD", buyer: "firstHome", property: "new" }, 2_000_000).total)).toBe(0);
    expect(d(duty({ state: "QLD", buyer: "firstHome", property: "land" }, 600_000).total)).toBe(0);
  });

  it("SA first home relief is for new homes and land only", () => {
    expect(d(duty({ state: "SA", buyer: "firstHome", property: "new" }, 850_000).total)).toBe(0);
    expect(d(duty({ state: "SA", buyer: "firstHome" }, 850_000).total)).toBe(40_580);
  });

  it("WA first home owner rate", () => {
    expect(d(duty({ state: "WA", buyer: "firstHome" }, 600_000).total)).toBe(0);
    expect(d(duty({ state: "WA", buyer: "firstHome" }, 700_000).total)).toBe(16_150);
    // Never more than the general rate.
    expect(d(duty({ state: "WA", buyer: "firstHome" }, 800_000).total)).toBe(32_300);
    expect(d(duty({ state: "WA", buyer: "firstHome" }, 850_000).total)).toBe(34_890.5);
    expect(d(duty({ state: "WA", buyer: "firstHome", property: "land" }, 500_000).total)).toBe(
      10_070,
    );
  });

  it("TAS has no first home concession after 30 June 2026", () => {
    const r = duty({ state: "TAS", buyer: "firstHome" }, 600_000);
    expect(r.saving).toBe(0);
    expect(r.notes[0]).toMatch(/ended/);
  });

  it("ACT first home buyers pay nothing; owner-occupiers get the lower scale", () => {
    expect(d(duty({ state: "ACT", buyer: "firstHome" }, 2_000_000).total)).toBe(0);
    expect(d(duty({ state: "ACT", buyer: "ownerOccupier" }, 850_000).total)).toBe(25_108);
  });

  it("foreign buyers pay the surcharge and lose concessions", () => {
    const r = duty({ state: "NSW", buyer: "firstHome", foreign: true }, 850_000);
    expect(d(r.duty)).toBe(32_437);
    expect(d(r.foreignSurcharge)).toBe(76_500);
    expect(d(r.total)).toBe(108_937);
    expect(duty({ state: "ACT", foreign: true }, 850_000).foreignSurcharge).toBe(0);
  });

  it("explains the working", () => {
    const r = duty({ state: "NSW", buyer: "firstHome" }, 850_000);
    expect(r.steps.map((s) => d(s.amount))).toEqual([32_437, 9_796.75, 9_796.75]);
    expect(r.rulesYear).toBe("2026-27");
    expect(r.sources.length).toBeGreaterThan(0);
  });
});

describe("every state", () => {
  it("sorts cheapest first", () => {
    const rows = dutyByState({ price: c(850_000), buyer: "firstHome", property: "existing" });
    expect(rows.map((r) => r.state)).toEqual(["ACT", "NSW", "QLD", "TAS", "WA", "SA", "NT", "VIC"]);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].total).toBeGreaterThanOrEqual(rows[i - 1].total);
  });

  it("duty never goes negative or above general + surcharge", () => {
    for (const buyer of ["firstHome", "ownerOccupier", "investor"] as const) {
      for (const property of ["existing", "new", "land"] as const) {
        for (let price = 0; price <= 3_000_000; price += 37_500) {
          for (const r of dutyByState({ price: c(price), buyer, property })) {
            expect(r.duty).toBeGreaterThanOrEqual(0);
            expect(r.duty).toBeLessThanOrEqual(r.generalDuty);
          }
        }
      }
    }
  });
});

describe("fees and LMI", () => {
  it("government fees follow the published scales", () => {
    expect(d(governmentFees("VIC", c(850_000)).transfer)).toBe(2_094);
    expect(d(governmentFees("QLD", c(850_000)).transfer)).toBe(3_367.56);
    expect(d(governmentFees("SA", c(550_000)).transfer)).toBe(5_603);
    expect(d(governmentFees("SA", c(1_065_000)).transfer)).toBe(11_063);
    expect(governmentFees("NSW", c(850_000), false).mortgage).toBe(0);
  });

  it("LMI only above 80% LVR, not over 95%", () => {
    expect(estimateLmi(c(850_000), c(680_000)).premium).toBe(0);
    expect(d(estimateLmi(c(850_000), c(765_000)).premium)).toBe(16_830);
    expect(estimateLmi(c(850_000), c(830_000)).available).toBe(false);
  });

  it("adds up the cash needed", () => {
    const r = buyingCosts({
      state: "NSW",
      price: c(850_000),
      buyer: "firstHome",
      property: "existing",
      deposit: c(85_000),
      other: { conveyancing: c(1_800), inspections: c(600), loanFees: c(0), other: c(0) },
    });
    expect(d(r.loan)).toBe(765_000);
    expect(r.homeGuaranteeEligible).toBe(true);
    expect(d(r.costs)).toBe(9_796.75 + 16_830 + 182.73 * 2 + 2_400);
    expect(r.cashNeeded).toBe(c(85_000) + r.costs);

    const hgs = buyingCosts({
      state: "NSW",
      price: c(850_000),
      buyer: "firstHome",
      property: "existing",
      deposit: c(85_000),
      homeGuarantee: true,
      other: { conveyancing: c(0), inspections: c(0), loanFees: c(0), other: c(0) },
    });
    expect(hgs.lmi.premium).toBe(0);
  });

  it("LMI on the loan is not paid upfront", () => {
    const r = buyingCosts({
      state: "VIC",
      price: c(700_000),
      buyer: "ownerOccupier",
      property: "existing",
      deposit: c(70_000),
      lmiOnLoan: true,
      other: { conveyancing: c(0), inspections: c(0), loanFees: c(0), other: c(0) },
    });
    expect(r.lmi.premium).toBeGreaterThan(0);
    expect(r.lmiUpfront).toBe(0);
    expect(r.homeGuaranteeEligible).toBe(false);
  });
});
