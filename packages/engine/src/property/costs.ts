import type { Cents } from "../money/cents";
import { type DutyInput, type DutyResult, stampDuty } from "./duty";
import type { AuState } from "./rules";

// ---------------------------------------------------------------- government fees

export interface GovernmentFees {
  transfer: Cents;
  mortgage: Cents;
  /** True when a fee is our best estimate rather than the published 2026-27 figure. */
  estimate: boolean;
}

const C = (d: number) => Math.round(d * 100) as Cents;

/**
 * Land titles fees to register the transfer and the mortgage, 2026-27. VIC,
 * QLD and SA transfer fees follow their published scales; the rest are flat
 * or close to it, and some are estimates (flagged).
 */
export function governmentFees(state: AuState, price: Cents, withMortgage = true): GovernmentFees {
  const value = price / 100;
  let transfer: number;
  let mortgage: number;
  let estimate = false;
  switch (state) {
    case "NSW":
      transfer = 182.73;
      mortgage = 182.73;
      break;
    case "VIC":
      // Electronic lodgement: $104.30 + $2.34 per whole $1,000, capped.
      transfer = Math.min(3_614, Math.ceil(104.3 + 2.34 * Math.floor(value / 1000)));
      mortgage = 129.2;
      break;
    case "QLD":
      transfer = 248.04 + 46.56 * Math.max(0, Math.ceil((value - 180_000) / 10_000));
      mortgage = 248.04;
      break;
    case "SA":
      if (value <= 5_000) transfer = 204;
      else if (value <= 20_000) transfer = 228;
      else if (value <= 40_000) transfer = 251;
      else if (value <= 50_000) transfer = 353;
      else transfer = 353 + 105 * Math.ceil((value - 50_000) / 10_000);
      mortgage = 204;
      break;
    case "WA":
      transfer = 225.1 + 20 * Math.max(0, Math.ceil((value - 85_000) / 100_000));
      mortgage = 225.1;
      estimate = true;
      break;
    case "TAS":
      transfer = 255;
      mortgage = 167.58;
      estimate = true;
      break;
    case "ACT":
      transfer = 500;
      mortgage = 184;
      estimate = true;
      break;
    case "NT":
      transfer = 181;
      mortgage = 181;
      estimate = true;
      break;
  }
  return { transfer: C(transfer), mortgage: withMortgage ? C(mortgage) : (0 as Cents), estimate };
}

// ---------------------------------------------------------------- lenders mortgage insurance

/** Loan size bands (upper limits, dollars) for the LMI table. */
const LMI_LOAN_BANDS = [300_000, 500_000, 600_000, 750_000, 1_000_000, Number.POSITIVE_INFINITY];

/**
 * Indicative LMI premium as a share of the loan, by LVR band (upper limit) and
 * loan size. Built from published insurer and lender examples; real quotes
 * vary by lender, insurer and state, and include stamp duty on the premium.
 */
const LMI_TABLE: [number, number[]][] = [
  [0.85, [0.0053, 0.0069, 0.0082, 0.0096, 0.0106, 0.0118]],
  [0.88, [0.0083, 0.011, 0.013, 0.0145, 0.016, 0.0178]],
  [0.9, [0.0112, 0.015, 0.0179, 0.0204, 0.022, 0.0245]],
  [0.92, [0.017, 0.023, 0.026, 0.029, 0.031, 0.0345]],
  [0.95, [0.024, 0.031, 0.035, 0.0385, 0.041, 0.0455]],
];

export interface LmiEstimate {
  lvr: number; // loan ÷ price
  premium: Cents;
  rate: number; // premium ÷ loan
  /** False when the LVR is over 95%, where lenders rarely lend. */
  available: boolean;
}

export function estimateLmi(price: Cents, loan: Cents): LmiEstimate {
  const lvr = price > 0 ? loan / price : 0;
  if (lvr <= 0.8 + 1e-9) return { lvr, premium: 0 as Cents, rate: 0, available: true };
  const row = LMI_TABLE.find(([upper]) => lvr <= upper + 1e-9);
  if (!row) return { lvr, premium: 0 as Cents, rate: 0, available: false };
  const band = LMI_LOAN_BANDS.findIndex((upper) => loan / 100 <= upper);
  const rate = row[1][band];
  return { lvr, premium: Math.round(loan * rate) as Cents, rate, available: true };
}

/**
 * Home Guarantee Scheme (5% Deposit Scheme) property price caps from 1 October
 * 2025, for capital cities and regional centres. Other regional areas are lower.
 */
export const HOME_GUARANTEE_CAP: Record<AuState, number> = {
  NSW: 1_500_000,
  VIC: 950_000,
  QLD: 1_000_000,
  SA: 900_000,
  WA: 850_000,
  TAS: 700_000,
  ACT: 1_000_000,
  NT: 600_000,
};

export const HOME_GUARANTEE_SOURCE =
  "https://www.housingaustralia.gov.au/support-buy-home/5-deposit-scheme";

// ---------------------------------------------------------------- the whole picture

export interface OtherCosts {
  conveyancing: Cents;
  inspections: Cents;
  loanFees: Cents;
  other: Cents;
}

/** Rough costs of moving in, in cents. Zero what doesn't apply. */
export interface MovingInCosts {
  removalist: Cents;
  /** Power, gas and internet connections. */
  connections: Cents;
  /** A small buffer for cleaning, new locks and small things that turn up. */
  buffer: Cents;
}

export interface RatesInput {
  /** Council rates for the year. */
  council?: Cents;
  /** Water charges for the year that are billed in advance, such as the service charge. */
  water?: Cents;
  /** Days from settlement to the end of the period the seller has already paid. */
  daysLeft: number;
}

export interface RatesAdjustment {
  council: Cents;
  water: Cents;
  total: Cents;
  daysLeft: number;
}

/**
 * Settlement adjustment for rates the seller has paid ahead. The buyer
 * reimburses the seller for the days from settlement to the end of the period
 * already paid: annual amount x days left / 365. An estimate only: the rules
 * differ by state, and it assumes the seller has paid the whole period.
 */
export function ratesAdjustment(input: RatesInput): RatesAdjustment {
  const days = Number.isFinite(input.daysLeft) ? Math.min(366, Math.max(0, input.daysLeft)) : 0;
  const share = (annual: number | undefined) =>
    Math.round((Math.max(0, annual ?? 0) * days) / 365) as Cents;
  const council = share(input.council);
  const water = share(input.water);
  return { council, water, total: (council + water) as Cents, daysLeft: days };
}

export interface BuyingCostsInput extends DutyInput {
  deposit: Cents;
  /** Use the Home Guarantee Scheme, so no LMI (first home buyers under the price cap). */
  homeGuarantee?: boolean;
  /** Add the LMI premium to the loan instead of paying it upfront. */
  lmiOnLoan?: boolean;
  other: OtherCosts;
  /** Optional moving in costs, counted in the total when given. */
  movingIn?: MovingInCosts;
  /** Optional council and water rates owed to the seller at settlement. */
  rates?: RatesInput;
}

export interface BuyingCostsResult {
  loan: Cents; // before any capitalised LMI
  lvr: number;
  duty: DutyResult;
  lmi: LmiEstimate;
  /** LMI paid from savings (0 when added to the loan or under the Home Guarantee Scheme). */
  lmiUpfront: Cents;
  fees: GovernmentFees;
  other: OtherCosts;
  /** Moving in costs, 0 when not included. */
  movingIn: Cents;
  /** Rates reimbursed to the seller, zero when not included. */
  rates: RatesAdjustment;
  /** Everything except the deposit. */
  costs: Cents;
  /** Deposit + costs: the cash you need by settlement. */
  cashNeeded: Cents;
  /** Whether the purchase fits the Home Guarantee Scheme price cap for the state's capital. */
  homeGuaranteeEligible: boolean;
}

export function buyingCosts(input: BuyingCostsInput): BuyingCostsResult {
  const deposit = Math.min(Math.max(0, input.deposit), input.price) as Cents;
  const loan = (input.price - deposit) as Cents;
  const lvr = input.price > 0 ? loan / input.price : 0;
  const duty = stampDuty(input);
  const homeGuaranteeEligible =
    input.buyer === "firstHome" &&
    !input.foreign &&
    input.price / 100 <= HOME_GUARANTEE_CAP[input.state] &&
    lvr >= 0.8 &&
    lvr <= 0.95 + 1e-9;
  const useHgs = input.homeGuarantee === true && homeGuaranteeEligible;
  const lmi = useHgs
    ? { lvr, premium: 0 as Cents, rate: 0, available: true }
    : estimateLmi(input.price, loan);
  const lmiUpfront = input.lmiOnLoan ? (0 as Cents) : lmi.premium;
  const fees = governmentFees(input.state, input.price, loan > 0);
  const o = input.other;
  const mi = input.movingIn;
  const movingIn = mi
    ? ((Math.max(0, mi.removalist) + Math.max(0, mi.connections) + Math.max(0, mi.buffer)) as Cents)
    : (0 as Cents);
  const rates = ratesAdjustment(input.rates ?? { daysLeft: 0 });
  const costs = (duty.total +
    movingIn +
    rates.total +
    lmiUpfront +
    fees.transfer +
    fees.mortgage +
    o.conveyancing +
    o.inspections +
    o.loanFees +
    o.other) as Cents;
  return {
    loan,
    lvr,
    duty,
    lmi,
    lmiUpfront,
    fees,
    other: o,
    movingIn,
    rates,
    costs,
    cashNeeded: (deposit + costs) as Cents,
    homeGuaranteeEligible,
  };
}
