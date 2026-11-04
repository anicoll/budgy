import { isIsoDate } from "../dates";
import type { Cents } from "../money/cents";
import { pmt } from "../mortgage/simulate";
import { calculatePay, type PayInput, type PayResult, validatePay } from "../tax/pay";
import { ATO_RESIDUALS, type CarRules, carRulesFor, EV_FBT, FBT, LCT_RATE } from "./rules";

/**
 * Novated lease: what a car costs out of your pay when your employer leases
 * it for you, and how that compares with a car loan or paying cash.
 *
 * The employer claims back GST on the car and on the running costs, so those
 * are packaged without GST. Lease rentals, running costs and fees come out of
 * pay before tax. Where fringe benefits tax would apply, part of the cost is
 * paid from after-tax pay instead (the employee contribution method), so the
 * employer has no FBT to pass on. That's what almost every lease provider does.
 */

export type CarKind = "ev" | "phev" | "ice";

/** `exempt`: no FBT. `discounted`: 25% off the taxable value (proposed). `taxed`: full FBT. */
export type FbtTreatment = "exempt" | "discounted" | "taxed";

export type FbtReason =
  | "ev" // electric car under the price cap
  | "ev-over-cap" // electric car over the luxury car tax threshold
  | "ev-discount-over-75k" // proposed: from 1 April 2027, EVs over $75,000
  | "ev-discount-all" // proposed: from 1 April 2029, every EV
  | "phev-before-april-2025"
  | "phev"
  | "ice";

/** Running costs a year, including GST (registration has none). */
export interface RunningCosts {
  energy: Cents; // fuel or charging
  registration: Cents;
  insurance: Cents;
  tyres: Cents;
  maintenance: Cents;
  other?: Cents;
}

export interface NovatedLeaseInput {
  /** The person's pay without the lease. */
  pay: PayInput;
  car: CarKind;
  /** Car price including GST, luxury car tax and dealer delivery, before stamp duty and rego. */
  price: Cents;
  /** Stamp duty and first registration, financed in the lease. No GST on these. */
  onRoadCosts?: Cents;
  /** When the lease starts (ISO date). Sets the FBT rules the lease keeps for life. */
  start: string;
  termYears: number; // 1 to 5
  /** Lease interest rate a year, such as 0.075. */
  rate: number;
  /** Residual as a share of the amount financed. Default: the ATO minimum for the term. */
  residualRate?: number;
  /** Provider's management fee a year, including GST. */
  managementFee?: Cents;
  running: RunningCosts;
  /** Car loan rate for the comparison, such as 0.08. Leave out to skip the loan. */
  loanRate?: number;
  /** What cash would earn a year in savings or an offset, before tax, for the cash comparison. */
  savingsRate?: number;
}

export interface FbtPosition {
  treatment: FbtTreatment;
  reason: FbtReason;
  /** Rules proposed in the 2026-27 Budget, not yet law. */
  proposed: boolean;
  /** Statutory taxable value a year before any exemption: 20% of the base value. */
  statutoryValue: Cents;
  /** The FBT the employer would pay a year with no employee contribution. */
  fbtWithoutContribution: Cents;
}

export interface LeaseYear {
  year: number; // 1-based lease year
  /** Statutory taxable value this year (the base value drops by a third after four years). */
  statutoryValue: Cents;
  /** Lease rental, running costs and fee a year, without GST. */
  packageCost: Cents;
  /** Taken from pay before tax. */
  preTax: Cents;
  /** Taken from pay after tax (employee contribution, including GST). */
  postTax: Cents;
  /** Reportable fringe benefits on the income statement (grossed up). */
  reportable: Cents;
  /** Tax, levies and study loan saved this year. */
  taxSaved: Cents;
  /** How much less lands in the bank this year: the real cost of the lease. */
  cost: Cents;
  payBefore: PayResult;
  payAfter: PayResult;
}

export interface OwnershipCost {
  /** Out of your pocket over the term, to end up owning the car. */
  total: Cents;
  /** A month, on average, over the term. */
  monthly: Cents;
}

export type LeaseWarning =
  | { kind: "proposed-ev-rules" }
  | { kind: "ev-over-cap"; cap: Cents }
  | { kind: "luxury-car-tax"; amount: Cents }
  | { kind: "residual-below-ato"; minimum: number }
  | { kind: "base-value-reduced" }
  | { kind: "rules-carried-forward"; year: string }
  | { kind: "packaging-too-big" };

export interface NovatedLeaseResult {
  termYears: number;
  months: number;
  car: CarKind;
  fbt: FbtPosition;
  /** Luxury car tax already inside the price, for information. */
  luxuryCarTax: Cents;
  /** GST on the car the employer claims back, capped by the car limit. */
  gstCredit: Cents;
  /** Price less the GST credit, plus on-road costs. */
  financed: Cents;
  residualRate: number;
  /** Residual without GST. */
  residual: Cents;
  /** What you pay at the end to keep the car: the residual plus GST. */
  residualWithGst: Cents;
  /** Finance rental a month, without GST. */
  monthlyRental: Cents;
  /** Interest and charges in the rentals over the term. */
  financeCharges: Cents;
  /** Running costs a year without GST, as packaged. */
  runningPackaged: Cents;
  managementFeePackaged: Cents;
  years: LeaseYear[];
  /** First-year figures per pay period. */
  perPay: Record<
    "weekly" | "fortnightly" | "monthly",
    { preTax: Cents; postTax: Cents; cost: Cents }
  >;
  totals: { preTax: Cents; postTax: Cents; taxSaved: Cents; cost: Cents };
  lease: OwnershipCost;
  /** Paying cash up front, running costs from after-tax pay. */
  cash: OwnershipCost & { upfront: Cents; lostInterest: Cents };
  /** A car loan for the price and on-roads over the same term. */
  loan: (OwnershipCost & { repayment: Cents; interest: Cents }) | null;
  warnings: LeaseWarning[];
  carRules: CarRules;
}

const toC = (n: number) => Math.round(n) as Cents;
const ZERO = 0 as Cents;
const amt = (v: Cents | undefined) => (v ?? 0) as Cents;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** ATO minimum residual for a term in whole years (1 to 5). */
export function atoResidual(termYears: number): number {
  return ATO_RESIDUALS[Math.min(5, Math.max(1, Math.round(termYears)))];
}

/** How FBT treats this car under a lease starting on `start`. */
export function fbtTreatment(
  car: CarKind,
  price: Cents,
  start: string,
  rules: CarRules,
): { treatment: FbtTreatment; reason: FbtReason; proposed: boolean } {
  if (car === "ice") return { treatment: "taxed", reason: "ice", proposed: false };
  if (car === "phev") {
    return start < EV_FBT.phevEndsFrom
      ? { treatment: "exempt", reason: "phev-before-april-2025", proposed: false }
      : { treatment: "taxed", reason: "phev", proposed: false };
  }
  if (price > rules.lctFuelEfficient)
    return { treatment: "taxed", reason: "ev-over-cap", proposed: false };
  if (start >= EV_FBT.phase3From)
    return { treatment: "discounted", reason: "ev-discount-all", proposed: true };
  if (start >= EV_FBT.phase2From && price > EV_FBT.fullUpTo)
    return { treatment: "discounted", reason: "ev-discount-over-75k", proposed: true };
  return { treatment: "exempt", reason: "ev", proposed: false };
}

/** Luxury car tax inside a GST-inclusive price. */
export function luxuryCarTax(price: Cents, car: CarKind, rules: CarRules): Cents {
  // Plug-in hybrids use well under 3.5 L/100 km, so count as fuel efficient.
  const threshold = car === "ice" ? rules.lctOther : rules.lctFuelEfficient;
  if (price <= threshold) return ZERO;
  // The price includes LCT, so back it out: LCT = rate × (value − threshold) / 1.1,
  // where value = price − LCT.
  return toC(((price - threshold) / 1.1) * (LCT_RATE / (1 + LCT_RATE / 1.1)));
}

/** Finance rental a month (in arrears) to pay `financed` down to `residual` over `months`. */
export function leaseRental(
  financed: number,
  residual: number,
  annualRate: number,
  months: number,
): Cents {
  const r = annualRate / 12;
  if (r === 0) return toC((financed - residual) / months);
  const f = (1 + r) ** months;
  return toC(((financed * f - residual) * r) / (f - 1));
}

/**
 * The interest rate a lease quote implies, from its monthly finance rental
 * (without GST, running costs or fees). Null when no rate from 0% to 50% fits.
 */
export function impliedLeaseRate(
  financed: Cents,
  residual: Cents,
  months: number,
  monthlyRental: Cents,
): number | null {
  const at = (rate: number) => leaseRental(financed, residual, rate, months);
  let lo = 0;
  let hi = 0.5;
  if (monthlyRental < at(lo) || monthlyRental > at(hi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < monthlyRental) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const MAX_PRICE = 1_000_000_00 as Cents; // $1m

export function validateLease(input: NovatedLeaseInput): string[] {
  const errors = validatePay(input.pay);
  const money = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!money(input.price) || input.price <= 0 || input.price > MAX_PRICE)
    errors.push("Enter a car price between $1 and $1 million.");
  if (
    input.onRoadCosts !== undefined &&
    (!money(input.onRoadCosts) || input.onRoadCosts > MAX_PRICE)
  )
    errors.push("On-road costs should be between $0 and $1 million.");
  if (!isIsoDate(input.start)) errors.push("Enter the lease start as a date.");
  if (!Number.isInteger(input.termYears) || input.termYears < 1 || input.termYears > 5)
    errors.push("The lease term should be 1 to 5 years.");
  const rateOk = (v: number | undefined) =>
    v === undefined || (Number.isFinite(v) && v >= 0 && v <= 0.3);
  if (!rateOk(input.rate) || input.rate === undefined)
    errors.push("The lease rate should be 0% to 30%.");
  if (!rateOk(input.loanRate)) errors.push("The loan rate should be 0% to 30%.");
  if (!rateOk(input.savingsRate)) errors.push("The savings rate should be 0% to 30%.");
  if (
    input.residualRate !== undefined &&
    !(Number.isFinite(input.residualRate) && input.residualRate >= 0 && input.residualRate < 1)
  )
    errors.push("The residual should be between 0% and 100%.");
  if (
    input.managementFee !== undefined &&
    (!money(input.managementFee) || input.managementFee > MAX_PRICE)
  )
    errors.push("The management fee should be between $0 and $1 million.");
  const r = input.running;
  for (const v of [r.energy, r.registration, r.insurance, r.tyres, r.maintenance, amt(r.other)])
    if (!money(v) || v > MAX_PRICE) {
      errors.push("Running costs should be between $0 and $1 million a year.");
      break;
    }
  return errors;
}

/** Novated lease cost for one term, with the loan and cash comparisons. */
export function calculateNovatedLease(input: NovatedLeaseInput): NovatedLeaseResult {
  const errors = validateLease(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const { rules, carriedForward } = carRulesFor(input.start);
  const { termYears: years, price } = input;
  const months = years * 12;
  const warnings: LeaseWarning[] = [];
  if (carriedForward) warnings.push({ kind: "rules-carried-forward", year: rules.year });

  // FBT position.
  const fbt = fbtTreatment(input.car, price, input.start, rules);
  const fullValue = toC(price * FBT.statutoryRate);
  const taxedShare =
    fbt.treatment === "exempt" ? 0 : fbt.treatment === "discounted" ? EV_FBT.discountedShare : 1;
  if (fbt.proposed) warnings.push({ kind: "proposed-ev-rules" });
  if (fbt.reason === "ev-over-cap")
    warnings.push({ kind: "ev-over-cap", cap: rules.lctFuelEfficient });
  const lct = luxuryCarTax(price, input.car, rules);
  if (lct > 0) warnings.push({ kind: "luxury-car-tax", amount: lct });

  // What's financed, and the rental.
  const gstCredit = toC(Math.min(price, rules.carLimit) / 11);
  const financed = (price - gstCredit + amt(input.onRoadCosts)) as Cents;
  const minimum = atoResidual(years);
  const residualRate = input.residualRate ?? minimum;
  if (residualRate < minimum - 1e-9) warnings.push({ kind: "residual-below-ato", minimum });
  const residual = toC(financed * residualRate);
  const residualWithGst = toC(residual * 1.1);
  const monthlyRental = leaseRental(financed, residual, input.rate, months);
  const r = input.running;
  const gstable = r.energy + r.insurance + r.tyres + r.maintenance + amt(r.other);
  const runningPackaged = toC(gstable / 1.1 + r.registration);
  const managementFeePackaged = toC(amt(input.managementFee) / 1.1);
  const packageCost = (monthlyRental * 12 + runningPackaged + managementFeePackaged) as Cents;

  const payBefore = calculatePay(input.pay);
  const leaseYears: LeaseYear[] = [];
  for (let y = 1; y <= years; y++) {
    // After four full FBT years the base value drops by a third.
    const statutoryValue = y >= 5 ? toC((fullValue * 2) / 3) : fullValue;
    if (y === 5 && taxedShare > 0) warnings.push({ kind: "base-value-reduced" });
    // Post-tax contribution wipes out the taxable value, GST included,
    // and covers 10/11ths of its amount of the package.
    const wanted = toC(statutoryValue * taxedShare);
    const postTax = Math.min(wanted, toC(packageCost * 1.1)) as Cents;
    const preTax = Math.max(0, packageCost - toC(postTax / 1.1)) as Cents;
    // What's left of the taxable value is reportable (exempt EVs included).
    const leftover = statutoryValue - postTax;
    const reportable = leftover > FBT.reportableOver ? toC(leftover * FBT.grossUpType2) : ZERO;
    const payAfter = calculatePay({
      ...input.pay,
      otherPackaging: (amt(input.pay.otherPackaging) + preTax) as Cents,
      fringeBenefits: (amt(input.pay.fringeBenefits) + reportable) as Cents,
    });
    if (
      payAfter.warnings.some((w) => w.kind === "packaging-too-big") &&
      !warnings.some((w) => w.kind === "packaging-too-big")
    )
      warnings.push({ kind: "packaging-too-big" });
    const taxSaved = (payBefore.totalTax - payAfter.totalTax) as Cents;
    const cost = (payBefore.net - payAfter.net + postTax) as Cents;
    leaseYears.push({
      year: y,
      statutoryValue,
      packageCost,
      preTax: (payAfter.otherPackaging - amt(input.pay.otherPackaging)) as Cents,
      postTax,
      reportable,
      taxSaved,
      cost,
      payBefore,
      payAfter,
    });
  }

  const first = leaseYears[0];
  const per = (n: number) => ({
    preTax: toC(first.preTax / n),
    postTax: toC(first.postTax / n),
    cost: toC(first.cost / n),
  });
  const totals = {
    preTax: toC(sum(leaseYears.map((y) => y.preTax))),
    postTax: toC(sum(leaseYears.map((y) => y.postTax))),
    taxSaved: toC(sum(leaseYears.map((y) => y.taxSaved))),
    cost: toC(sum(leaseYears.map((y) => y.cost))),
  };
  const leaseTotal = (totals.cost + residualWithGst) as Cents;

  // Cash: pay the GST-inclusive price and on-roads now, running costs with GST from net pay.
  const runningWithGst = gstable + r.registration;
  const upfront = (price + amt(input.onRoadCosts)) as Cents;
  const afterTaxSavings = (input.savingsRate ?? 0) * (1 - payBefore.marginalRate);
  const lostInterest = toC(upfront * ((1 + afterTaxSavings) ** years - 1));
  const cashTotal = toC(upfront + runningWithGst * years + lostInterest);

  let loan: NovatedLeaseResult["loan"] = null;
  if (input.loanRate !== undefined) {
    const repayment = pmt(upfront, input.loanRate / 12, months);
    const repaid = repayment * months;
    const total = toC(repaid + runningWithGst * years);
    loan = {
      repayment,
      interest: (repaid - upfront) as Cents,
      total,
      monthly: toC(total / months),
    };
  }

  return {
    termYears: years,
    months,
    car: input.car,
    fbt: {
      ...fbt,
      statutoryValue: fullValue,
      fbtWithoutContribution: toC(fullValue * taxedShare * FBT.grossUpType1 * FBT.rate),
    },
    luxuryCarTax: lct,
    gstCredit,
    financed,
    residualRate,
    residual,
    residualWithGst,
    monthlyRental,
    financeCharges: (monthlyRental * months + residual - financed) as Cents,
    runningPackaged,
    managementFeePackaged,
    years: leaseYears,
    perPay: { weekly: per(52), fortnightly: per(26), monthly: per(12) },
    totals,
    lease: { total: leaseTotal, monthly: toC(leaseTotal / months) },
    cash: { upfront, lostInterest, total: cashTotal, monthly: toC(cashTotal / months) },
    loan,
    warnings,
    carRules: rules,
  };
}

/** The same lease over each term from 1 to 5 years, at the ATO minimum residual for each. */
export function compareLeaseTerms(
  input: Omit<NovatedLeaseInput, "termYears">,
): NovatedLeaseResult[] {
  return [1, 2, 3, 4, 5].map((termYears) =>
    calculateNovatedLease({ ...input, termYears, residualRate: undefined }),
  );
}
