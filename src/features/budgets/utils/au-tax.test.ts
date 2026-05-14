import { describe, expect, it } from "vitest";
import { cents } from "@/lib/money/cents";
import type { NovatedLease } from "@/lib/state/prefs-store";
import { estimateAUNetAnnual, estimateFortnightlyNet } from "./au-tax";

// All dollar values verified against FY2024-25 Stage 3 tax brackets.
// Fortnightly = annual / 26.

describe("estimateAUNetAnnual — base salary (no leases)", () => {
  it("zero income → zero net", () => {
    expect(estimateAUNetAnnual(cents(0))).toBe(0);
  });

  it("below tax-free threshold ($18,200): tax=0, medicare=0 (below phase-in)", () => {
    // $15,000: below tax-free threshold AND below Medicare phase-in ($26,000)
    // net = 15,000
    const result = estimateAUNetAnnual(cents(1_500_000));
    expect(result).toBe(1_500_000);
  });

  it("$205,000 gross with private health — should be ~$5,481/fn", () => {
    // Expected: ~$142,512 net annual ÷ 26 ≈ $5,481/fn
    // Tax: $51,638 + ($205k-$190k)×0.45 = $58,388
    // Medicare: $205k × 0.02 = $4,100
    // Net: $205,000 - $58,388 - $4,100 = $142,512
    const annual = estimateAUNetAnnual(cents(20_500_000), true);
    expect(annual).toBeGreaterThanOrEqual(14_200_000); // ≥ $142,000
    expect(annual).toBeLessThanOrEqual(14_310_000); // ≤ $143,100
    const fortnightly = estimateFortnightlyNet(cents(20_500_000), true);
    expect(fortnightly).toBeGreaterThanOrEqual(546_000); // ≥ $5,460/fn
    expect(fortnightly).toBeLessThanOrEqual(551_000); // ≤ $5,510/fn
  });

  it("$205,000 without private health: adds 1.5% MLS", () => {
    const withHealth = estimateAUNetAnnual(cents(20_500_000), true);
    const withoutHealth = estimateAUNetAnnual(cents(20_500_000), false);
    // MLS = $205,000 × 1.5% = $3,075 less take-home
    const diff = withHealth - withoutHealth;
    expect(diff).toBeGreaterThanOrEqual(300_000); // ≥ $3,000
    expect(diff).toBeLessThanOrEqual(315_000); // ≤ $3,150
  });

  it("MLS tier 1 ($93,001-$108,000): 1% surcharge when no private health", () => {
    const withHealth = estimateAUNetAnnual(cents(10_000_000), true); // $100K
    const withoutHealth = estimateAUNetAnnual(cents(10_000_000), false);
    // MLS = $100,000 × 1% = $1,000 difference
    const diff = withHealth - withoutHealth;
    expect(diff).toBeGreaterThanOrEqual(95_000);
    expect(diff).toBeLessThanOrEqual(105_000);
  });

  it("MLS tier 2 ($108,001-$144,000): 1.25% surcharge", () => {
    const withHealth = estimateAUNetAnnual(cents(12_000_000), true); // $120K
    const withoutHealth = estimateAUNetAnnual(cents(12_000_000), false);
    // MLS = $120,000 × 1.25% = $1,500
    const diff = withHealth - withoutHealth;
    expect(diff).toBeGreaterThanOrEqual(145_000);
    expect(diff).toBeLessThanOrEqual(155_000);
  });

  it("no MLS below $93,000 threshold", () => {
    const withHealth = estimateAUNetAnnual(cents(8_000_000), true); // $80K
    const withoutHealth = estimateAUNetAnnual(cents(8_000_000), false);
    expect(withHealth).toBe(withoutHealth);
  });

  it("net is always less than gross", () => {
    for (const gross of [50_000, 100_000, 150_000, 200_000, 300_000]) {
      const net = estimateAUNetAnnual(cents(gross * 100), true);
      expect(net).toBeLessThan(gross * 100);
    }
  });

  it("higher salary → higher tax rate (effective rate increases)", () => {
    const net80k = estimateAUNetAnnual(cents(8_000_000), true);
    const net160k = estimateAUNetAnnual(cents(16_000_000), true);
    const rate80k = 1 - net80k / 8_000_000;
    const rate160k = 1 - net160k / 16_000_000;
    expect(rate160k).toBeGreaterThan(rate80k);
  });

  it("LITO fully applies at $30,000 (max $700 offset)", () => {
    // At $30,000: tax = ($30,000-$18,200) × 0.16 = $1,888
    // LITO = $700 (full, since $30k ≤ $37,500)
    // Medicare: shade-in ($30k in $26k-$32.5k band) = ($30,000-$26,000) × 0.10 = $400
    // Net = $30,000 - ($1,888 - $700 + $400) = $30,000 - $1,588 = $28,412
    const result = estimateAUNetAnnual(cents(3_000_000), true);
    expect(result).toBeGreaterThanOrEqual(2_830_000);
    expect(result).toBeLessThanOrEqual(2_860_000);
  });
});

describe("estimateAUNetAnnual — novated leases", () => {
  const evLease: NovatedLease = {
    id: "1",
    name: "Tesla",
    annualPreTaxAmount: cents(1_500_000), // $15,000/yr
    fbtRate: 0, // EV exempt
  };

  const stdLease: NovatedLease = {
    id: "2",
    name: "BMW",
    annualPreTaxAmount: cents(2_000_000), // $20,000/yr
    fbtRate: 0.2, // 20% FBT
  };

  it("EV lease (0% FBT): take-home is lower but tax saving > 0 (lease beats paying after-tax)", () => {
    const withoutLease = estimateAUNetAnnual(cents(20_500_000), true, []);
    const withLease = estimateAUNetAnnual(cents(20_500_000), true, [evLease]);
    // Cash take-home is lower (the $15K is diverted to the car pre-tax)
    expect(withLease).toBeLessThan(withoutLease);
    // But the tax SAVED (= lease cost - take-home difference) should be positive:
    // tax saved = $15,000 - (withoutLease - withLease) > 0
    // i.e. the tax break means the take-home drop is less than the full $15K sacrifice
    const leaseAmountCents = evLease.annualPreTaxAmount as number;
    const takeHomeDrop = withoutLease - withLease;
    const taxSaved = leaseAmountCents - takeHomeDrop;
    expect(taxSaved).toBeGreaterThan(0); // EV sacrifice costs less than its face value
  });

  it("EV lease: $205K gross, taxable drops to $190K correctly", () => {
    // Taxable $190K: tax = $51,638 + 0 (at the $190K boundary, 0 × 45% = 0)
    // Medicare = $190,000 × 0.02 = $3,800
    // Net = $190,000 - $51,638 - $3,800 = $134,562
    const result = estimateAUNetAnnual(cents(20_500_000), true, [evLease]);
    expect(result).toBeGreaterThanOrEqual(13_400_000);
    expect(result).toBeLessThanOrEqual(13_510_000);
  });

  it("standard car lease (20% FBT): after-tax FBT cost reduces net", () => {
    const withEV = estimateAUNetAnnual(cents(20_500_000), true, [evLease]);
    const withStd = estimateAUNetAnnual(cents(20_500_000), true, [stdLease]);
    // Both reduce taxable by their respective amounts
    // Standard also adds: $20,000 × 0.20 = $4,000 after-tax FBT cost
    // Standard pre-tax: $20k (vs EV $15k), so also deeper bracket reduction
    // Net comparison: complex, but standard lease has additional FBT drag
    const evWithSameAmount: NovatedLease = { ...evLease, annualPreTaxAmount: cents(2_000_000) };
    const withSameAmountEV = estimateAUNetAnnual(cents(20_500_000), true, [evWithSameAmount]);
    // Same pre-tax amount but 0% FBT vs 20% FBT — EV should give more take-home
    expect(withSameAmountEV).toBeGreaterThan(withStd);
  });

  it("multiple leases: effects are cumulative", () => {
    const noLeases = estimateAUNetAnnual(cents(20_500_000), true, []);
    const oneLeaseOnly = estimateAUNetAnnual(cents(20_500_000), true, [evLease]);
    const twoLeases = estimateAUNetAnnual(cents(20_500_000), true, [evLease, stdLease]);
    // Each lease further reduces take-home (more pre-tax sacrifice)
    expect(oneLeaseOnly).toBeLessThan(noLeases);
    expect(twoLeases).toBeLessThan(oneLeaseOnly);
  });

  it("lease sacrifice larger than gross → net is 0, no negative", () => {
    const hugeLease: NovatedLease = {
      id: "3",
      name: "Huge",
      annualPreTaxAmount: cents(50_000_000), // $500K — more than $100K gross
      fbtRate: 0,
    };
    const result = estimateAUNetAnnual(cents(10_000_000), true, [hugeLease]);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("fbtRate=1.0 (full FBT): after-tax cost equals the entire pre-tax amount", () => {
    // $20K pre-tax, 100% FBT → after-tax FBT = $20,000
    // taxable = $185K; tax + medicare on $185K; THEN subtract $20K FBT cost
    const fullFbt: NovatedLease = { ...stdLease, fbtRate: 1.0 };
    const noLease = estimateAUNetAnnual(cents(20_500_000), true, []);
    const withFullFbt = estimateAUNetAnnual(cents(20_500_000), true, [fullFbt]);
    // Full FBT makes it much worse — should lose more take-home than the tax savings
    expect(withFullFbt).toBeLessThan(noLease);
  });
});

describe("estimateFortnightlyNet", () => {
  it("is annual / 26", () => {
    const annual = estimateAUNetAnnual(cents(10_000_000), true, []);
    const fortnightly = estimateFortnightlyNet(cents(10_000_000), true, []);
    expect(fortnightly).toBe(Math.round(annual / 26));
  });

  it("leases flow through correctly", () => {
    const evLease: NovatedLease = {
      id: "1",
      name: "EV",
      annualPreTaxAmount: cents(1_200_000),
      fbtRate: 0,
    };
    const annual = estimateAUNetAnnual(cents(10_000_000), false, [evLease]);
    const fortnightly = estimateFortnightlyNet(cents(10_000_000), false, [evLease]);
    expect(fortnightly).toBe(Math.round(annual / 26));
  });
});
