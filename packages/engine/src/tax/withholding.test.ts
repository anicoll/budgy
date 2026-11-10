import { describe, expect, it } from "vitest";
import type { Cents } from "../money/cents";
import { calculatePay } from "./pay";
import {
  weeklyFromTable,
  whmWithholding,
  withholdForPay,
  withholdingTablesFor,
} from "./withholding";

const c = (dollars: number) => Math.round(dollars * 100) as Cents;
const t = withholdingTablesFor("2026-27");
if (!t) throw new Error("2026-27 withholding tables missing");

describe("ATO withholding formulas", () => {
  // The worked examples in Schedule 1, before the offsets and Medicare
  // variations they go on to apply.
  it("weekly: $1,333.45 on scale 2 withholds $245", () => {
    expect(weeklyFromTable(1333, t.threshold)).toBe(245);
    expect(withholdForPay(c(1333.45), "weekly", t.threshold)).toBe(c(245));
  });

  it("fortnightly: $1,299.30 on scale 5 withholds $86", () => {
    expect(withholdForPay(c(1299.3), "fortnightly", t.fullExemption)).toBe(c(86));
  });

  it("monthly: $5,400.33 on scale 2 withholds $940", () => {
    expect(withholdForPay(c(5400.33), "monthly", t.threshold)).toBe(c(940));
  });

  it("withholds nothing under the threshold", () => {
    expect(withholdForPay(c(361), "weekly", t.threshold)).toBe(0);
    expect(withholdForPay(0 as Cents, "monthly", t.threshold)).toBe(0);
  });

  it("study loan component", () => {
    expect(withholdForPay(c(1336), "weekly", t.loanThreshold)).toBe(0);
    // 0.15 × 1,923.99 − 200.5615 = 88.04
    expect(withholdForPay(c(1923.08), "weekly", t.loanThreshold)).toBe(c(88));
    // 10% of everything at the top
    expect(withholdForPay(c(4000), "weekly", t.loanThreshold)).toBe(c(400));
  });

  it("working holiday makers on the year's pay", () => {
    // 6,750 + 0.3 × 5,000 = 8,250 over 26 fortnights
    expect(whmWithholding(c(50_000), 26, t.whm)).toBe(c(317));
  });
});

describe("pay slips in calculatePay", () => {
  it("$100,000 fortnightly: $868 tax withheld, $48 back at tax time", () => {
    const r = calculatePay({ year: "2026-27", salary: c(100_000) });
    const f = r.withholding?.fortnightly;
    expect(f?.gross).toBe(c(3_846.15));
    expect(f?.tax).toBe(c(868));
    expect(f?.net).toBe(c(2_978.15));
    expect(f?.yearWithheld).toBe(c(22_568));
    expect(f?.atTaxTime).toBe(c(48));
  });

  it("no tax-free threshold withholds more, then refunds it", () => {
    const yes = calculatePay({ year: "2026-27", salary: c(30_000) });
    const no = calculatePay({ year: "2026-27", salary: c(30_000), taxFreeThreshold: false });
    expect(no.totalTax).toBe(yes.totalTax);
    expect(no.withholding?.weekly.tax).toBeGreaterThan(yes.withholding?.weekly.tax ?? 0);
    expect(no.withholding?.weekly.atTaxTime).toBeGreaterThan(
      yes.withholding?.weekly.atTaxTime ?? 0,
    );
  });

  it("deductions come back at tax time", () => {
    const r = calculatePay({ year: "2026-27", salary: c(100_000), deductions: c(2_000) });
    expect(r.taxableIncome).toBe(c(98_000));
    // 30% tax + 2% Medicare on $2,000 = $640 more back
    expect(r.withholding?.fortnightly.atTaxTime).toBe(c(48 + 640));
  });

  it("work deductions leave the pay slip alone and only move the tax-time result", () => {
    const base = calculatePay({ year: "2026-27", salary: c(100_000) });
    const claimed = calculatePay({ year: "2026-27", salary: c(100_000), deductions: c(2_000) });
    for (const f of ["weekly", "fortnightly", "monthly"] as const) {
      expect(claimed.withholding?.[f].tax).toBe(base.withholding?.[f].tax);
      expect(claimed.withholding?.[f].net).toBe(base.withholding?.[f].net);
      expect(claimed.withholding?.[f].yearWithheld).toBe(base.withholding?.[f].yearWithheld);
    }
    expect(claimed.totalTax).toBeLessThan(base.totalTax);
    expect(claimed.withholding?.fortnightly.atTaxTime).toBe(
      (base.withholding?.fortnightly.atTaxTime ?? 0) + (base.totalTax - claimed.totalTax),
    );
  });

  it("clamps work deductions between $0 and income", () => {
    const base = calculatePay({ year: "2026-27", salary: c(50_000) });
    expect(() =>
      calculatePay({ year: "2026-27", salary: c(50_000), deductions: -c(3_000) as never }),
    ).toThrow(RangeError);
    expect(base.deductions).toBe(0);
    const huge = calculatePay({ year: "2026-27", salary: c(50_000), deductions: c(80_000) });
    expect(huge.deductions).toBe(c(50_000));
    expect(huge.taxableIncome).toBe(0);
    expect(huge.warnings.map((w) => w.kind)).toContain("deductions-too-big");
    expect(huge.withholding?.fortnightly.tax).toBe(base.withholding?.fortnightly.tax);
  });

  it("has no tables for years the ATO hasn't published", () => {
    expect(calculatePay({ year: "2027-28", salary: c(100_000) }).withholding).toBeNull();
    expect(calculatePay({ year: "2025-26", salary: c(100_000) }).withholding).toBeNull();
  });
});
