import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { type DutyInput, stampDuty } from "../property/duty";
import { NSW_DUTY_1_35M, QLD_HOME_950K } from "./cases";
import {
  NSW_TRANSFER_DUTY,
  QLD_HOME_CONCESSION,
  QLD_TRANSFER_DUTY,
  VIC_GENERAL_RATES,
} from "./sources";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;
const duty = (input: Omit<DutyInput, "price">, price: number) =>
  d(stampDuty({ ...input, price: c(price) }).total);

const investor = { buyer: "investor", property: "existing" } as const;

describe(`NSW: ${NSW_TRANSFER_DUTY.name}`, () => {
  it("auction example (Yamba): $1,350,000 pays $55,537", () => {
    expect(duty({ state: "NSW", ...investor }, NSW_DUTY_1_35M.input.price)).toBe(
      NSW_DUTY_1_35M.expected.duty,
    );
    // A home buyer who isn't buying their first home pays the same.
    expect(duty({ state: "NSW", buyer: "ownerOccupier", property: "existing" }, 1_350_000)).toBe(
      55_537,
    );
  });

  it("pre-auction offer (Balmain): $4,000,000 pays $203,237 with premium duty", () => {
    expect(duty({ state: "NSW", ...investor }, 4_000_000)).toBe(203_237);
  });

  it("family transfer (Nowra): vacant land at $450,000 pays $14,437", () => {
    expect(duty({ state: "NSW", buyer: "ownerOccupier", property: "land" }, 450_000)).toBe(14_437);
  });
});

describe(`VIC: ${VIC_GENERAL_RATES.name}`, () => {
  // The table's band edges, worked from its own wording.
  it.each([
    [25_000, 350], // 1.4% of $25,000
    [130_000, 2_870], // $350 + 2.4% of $105,000
    [960_000, 52_670], // $2,870 + 6% of $830,000
    [960_001, 52_800.06], // then 5.5% of the whole value
    [2_000_000, 110_000],
    [2_500_000, 142_500], // $110,000 + 6.5% of $500,000
  ] as const)("$%d pays $%d", (price, expected) => {
    expect(duty({ state: "VIC", ...investor }, price)).toBe(expected);
  });
});

describe(`QLD: ${QLD_TRANSFER_DUTY.name}`, () => {
  it("calculation example: an $850,000 investment pays $31,275", () => {
    expect(duty({ state: "QLD", ...investor }, 850_000)).toBe(31_275);
  });
});

describe(`QLD: ${QLD_HOME_CONCESSION.name}`, () => {
  it("home concession example: a $950,000 next home pays $28,600", () => {
    expect(
      duty(
        { state: "QLD", buyer: "ownerOccupier", property: "existing" },
        QLD_HOME_950K.input.price,
      ),
    ).toBe(QLD_HOME_950K.expected.duty);
  });

  it("first home concession example: a $795,000 first home pays $19,890", () => {
    expect(duty({ state: "QLD", buyer: "firstHome", property: "existing" }, 795_000)).toBe(19_890);
  });
});
