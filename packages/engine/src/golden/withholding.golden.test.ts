import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import {
  type WithholdingFrequency,
  type WithholdingScale,
  withholdForPay,
  withholdingTablesFor,
} from "../tax/withholding";
import sample from "./data/ato-withholding-sample-2026-27.json";
import { ATO_SCHEDULE_1_EXAMPLES, ATO_SCHEDULE_1_SAMPLE } from "./sources";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const d = (cents: number) => cents / 100;
const tables = withholdingTablesFor("2026-27");
if (!tables) throw new Error("no 2026-27 withholding tables");

const SCALES: WithholdingScale[] = [
  "noThreshold",
  "threshold",
  "foreign",
  "fullExemption",
  "halfExemption",
];
const FREQUENCIES: WithholdingFrequency[] = ["weekly", "fortnightly", "monthly"];

describe(`withholding: ${ATO_SCHEDULE_1_SAMPLE.name}`, () => {
  it("is the sample data this test was written against", () => {
    expect(sample.source).toBe(ATO_SCHEDULE_1_SAMPLE.url);
    for (const f of FREQUENCIES) expect(sample[f]).toHaveLength(48);
  });

  // Every row of the ATO's payroll sample data, at every frequency and scale.
  // These sit either side of each coefficient change, so an off-by-one in a
  // table edge or in the weekly conversion shows up here.
  for (const frequency of FREQUENCIES) {
    describe(frequency, () => {
      const rows = sample[frequency].map(([earnings, ...withheld]) => ({ earnings, withheld }));
      it.each(rows)("$earnings", ({ earnings, withheld }) => {
        const got = SCALES.map((s) => d(withholdForPay(c(earnings), frequency, tables[s])));
        expect(got).toEqual(withheld);
      });
    });
  }
});

describe(`withholding: ${ATO_SCHEDULE_1_EXAMPLES.name}`, () => {
  // The worked examples go on to take off a levy adjustment or tax offsets,
  // which the pay calculator doesn't ask about; these are the amounts before that.
  it("Jabe: $1,333.45 a week on scale 2 is $245 before the levy adjustment", () => {
    expect(d(withholdForPay(c(1_333.45), "weekly", tables.threshold))).toBe(245);
  });

  it("Prue: $1,299.30 a fortnight on scale 5 is $86 before tax offsets", () => {
    expect(d(withholdForPay(c(1_299.3), "fortnightly", tables.fullExemption))).toBe(86);
  });

  it("Tan: $5,400.33 a month on scale 2 is $940 before tax offsets", () => {
    expect(d(withholdForPay(c(5_400.33), "monthly", tables.threshold))).toBe(940);
  });
});
