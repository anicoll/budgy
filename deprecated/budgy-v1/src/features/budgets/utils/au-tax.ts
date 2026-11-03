import type { Cents } from "@/lib/money/cents";
import type { NovatedLease } from "@/lib/state/prefs-store";

/**
 * AU income tax estimate — FY2024-25 (Stage 3 cuts, resident, PAYG employee).
 *
 * Includes:
 *   - FY2024-25 income tax brackets (Stage 3 cuts effective 1 July 2024)
 *   - Low Income Tax Offset (LITO, up to $700)
 *   - Medicare Levy (2%)
 *   - Medicare Levy Surcharge (MLS) if no private hospital cover:
 *       $93,001-$108,000 = 1.0%, $108,001-$144,000 = 1.25%, >$144,000 = 1.5%
 *   - Novated leases: pre-tax sacrifice reduces taxable income; fbtRate adds after-tax cost
 *
 * Excludes: HECS/HELP, family thresholds, other salary packaging.
 * Good enough for a budget pre-fill — user should adjust to their actual payslip.
 *
 * All intermediate values are in dollars; result returned as Cents.
 */
export function estimateAUNetAnnual(
  grossCents: Cents,
  hasPrivateHealth = false,
  novatedLeases: NovatedLease[] = [],
): Cents {
  if (grossCents <= 0) return 0 as Cents;

  const gross = grossCents / 100;

  // Novated lease pre-tax sacrifice reduces taxable income (all values in dollars here)
  const preTaxSacrifice = novatedLeases.reduce((s, l) => s + l.annualPreTaxAmount / 100, 0);
  const taxable = Math.max(0, gross - preTaxSacrifice);

  // ── FY2024-25 income tax brackets (Stage 3 cuts) ──────────────────────────
  let tax = 0;
  if (taxable <= 18_200) {
    tax = 0;
  } else if (taxable <= 45_000) {
    tax = (taxable - 18_200) * 0.16;
  } else if (taxable <= 135_000) {
    tax = 4_288 + (taxable - 45_000) * 0.3;
  } else if (taxable <= 190_000) {
    tax = 31_288 + (taxable - 135_000) * 0.37;
  } else {
    tax = 51_638 + (taxable - 190_000) * 0.45;
  }

  // ── Low Income Tax Offset (on taxable income after sacrifice) ─────────────
  let lito = 0;
  if (taxable <= 37_500) {
    lito = 700;
  } else if (taxable <= 45_000) {
    lito = 700 - (taxable - 37_500) * 0.05;
  } else if (taxable <= 66_667) {
    lito = 325 - (taxable - 45_000) * 0.015;
  }

  // ── Medicare Levy (2% of taxable income, phase-in for low earners) ────────
  let medicare = 0;
  if (taxable > 32_500) {
    medicare = taxable * 0.02;
  } else if (taxable > 26_000) {
    medicare = (taxable - 26_000) * 0.1;
  }

  // ── Medicare Levy Surcharge (singles, no private hospital cover) ──────────
  let mls = 0;
  if (!hasPrivateHealth) {
    if (taxable > 144_000) {
      mls = taxable * 0.015;
    } else if (taxable > 108_000) {
      mls = taxable * 0.0125;
    } else if (taxable > 93_000) {
      mls = taxable * 0.01;
    }
  }

  // ── After-tax FBT component ───────────────────────────────────────────────
  // Employee contribution to cover FBT: (preTaxAmount / 100) * fbtRate, in dollars
  const fbtCost = novatedLeases.reduce((s, l) => s + (l.annualPreTaxAmount / 100) * l.fbtRate, 0);

  const totalTax = Math.max(0, tax - lito + medicare + mls);
  const net = Math.max(0, taxable - totalTax - fbtCost);
  return Math.round(net * 100) as Cents;
}

/** Estimated fortnightly net pay from a gross annual salary (cents). */
export function estimateFortnightlyNet(
  grossCents: Cents,
  hasPrivateHealth = false,
  novatedLeases: NovatedLease[] = [],
): Cents {
  return Math.round(estimateAUNetAnnual(grossCents, hasPrivateHealth, novatedLeases) / 26) as Cents;
}
