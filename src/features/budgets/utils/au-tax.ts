import type { Cents } from "@/lib/money/cents";

/**
 * AU income tax estimate — FY2024-25 (Stage 3 cuts, resident, PAYG employee).
 *
 * Includes:
 *   - FY2024-25 income tax brackets (Stage 3 cuts effective 1 July 2024)
 *   - Low Income Tax Offset (LITO, up to $700)
 *   - Medicare Levy (2%)
 *   - Medicare Levy Surcharge (MLS) if no private hospital cover:
 *       $93,001–$108,000 → 1.0%,  $108,001–$144,000 → 1.25%,  >$144,000 → 1.5%
 *
 * Excludes: HECS/HELP, salary sacrifice, offsets, family thresholds.
 * Good enough for a budget pre-fill — user should adjust to their payslip.
 */
export function estimateAUNetAnnual(grossCents: Cents, hasPrivateHealth = false): Cents {
  const gross = grossCents / 100;
  if (gross <= 0) return 0 as Cents;

  // ── FY2024-25 income tax brackets (Stage 3 cuts) ──────────────────────────
  let tax = 0;
  if (gross <= 18_200) {
    tax = 0;
  } else if (gross <= 45_000) {
    tax = (gross - 18_200) * 0.16;
  } else if (gross <= 135_000) {
    tax = 4_288 + (gross - 45_000) * 0.3;
  } else if (gross <= 190_000) {
    tax = 31_288 + (gross - 135_000) * 0.37;
  } else {
    tax = 51_638 + (gross - 190_000) * 0.45;
  }

  // ── Low Income Tax Offset ─────────────────────────────────────────────────
  let lito = 0;
  if (gross <= 37_500) {
    lito = 700;
  } else if (gross <= 45_000) {
    lito = 700 - (gross - 37_500) * 0.05;
  } else if (gross <= 66_667) {
    lito = 325 - (gross - 45_000) * 0.015;
  }

  // ── Medicare Levy (2%) ────────────────────────────────────────────────────
  // Phase-in for low incomes: shade-in above $26,000, full 2% above ~$32,500
  let medicare = 0;
  if (gross > 32_500) {
    medicare = gross * 0.02;
  } else if (gross > 26_000) {
    medicare = (gross - 26_000) * 0.1;
  }

  // ── Medicare Levy Surcharge (singles, no private hospital cover) ──────────
  let mls = 0;
  if (!hasPrivateHealth) {
    if (gross > 144_000) {
      mls = gross * 0.015;
    } else if (gross > 108_000) {
      mls = gross * 0.0125;
    } else if (gross > 93_000) {
      mls = gross * 0.01;
    }
  }

  const totalTax = Math.max(0, tax - lito + medicare + mls);
  const net = Math.max(0, gross - totalTax);
  return Math.round(net * 100) as Cents;
}

/** Estimated fortnightly net pay from a gross annual salary (cents). */
export function estimateFortnightlyNet(grossCents: Cents, hasPrivateHealth = false): Cents {
  return Math.round(estimateAUNetAnnual(grossCents, hasPrivateHealth) / 26) as Cents;
}
