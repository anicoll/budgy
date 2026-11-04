import type { Cents } from "../money/cents";
import { calcMinRepayment } from "../mortgage/amortise";
import { repaymentToBalance } from "../mortgage/inverse";
import { calculatePay } from "../tax/pay";

/**
 * Borrowing power: roughly how much a lender would lend, the way Australian
 * lenders test it. Take-home pay, less living expenses (the higher of what you
 * spend and a benchmark floor), less what lenders count for your other debts,
 * leaves a monthly surplus. The loan is what that surplus repays over the term
 * at the assessment rate: your rate plus APRA's 3% serviceability buffer.
 *
 * Each lender has its own policy, so `LENDER_PROFILES` gives a cautious,
 * typical and generous version and the page shows the range.
 */

export interface Applicant {
  /** Base salary a year, before tax, without the employer's super. */
  salary: Cents;
  /** Regular overtime and shift allowances a year. */
  overtime?: Cents;
  /** Bonuses and commissions a year. */
  bonus?: Cents;
  /** Gross rent a year from investment property you already own. */
  rent?: Cents;
  /** Other taxable income a year, such as a second job. Counted in full. */
  other?: Cents;
  /** Salary sacrificed into super a year. */
  salarySacrifice?: Cents;
  /** Has a HELP or other study loan, which comes out of take-home pay. */
  studyLoan?: boolean;
}

export interface ExistingHomeLoan {
  balance: Cents;
  /** Remaining term. Lenders assess it as principal and interest at the assessment rate. */
  termYears: number;
}

export interface BorrowingInput {
  /** Financial year for the tax rules, "2026-27". */
  year: string;
  /** One or two people on the loan. */
  applicants: Applicant[];
  /** Children and other dependants. */
  dependants: number;
  /** What the household spends a month, not counting rent or loan repayments. */
  livingExpenses: Cents;
  /** Total limits on every credit card, used or not. */
  cardLimits?: Cents;
  /** Monthly repayments on car, personal and buy now pay later loans. */
  loanRepayments?: Cents;
  /** Balances owing on those loans, for the debt-to-income ratio. */
  loanBalances?: Cents;
  /** Other home or investment loans you'll keep. */
  homeLoans?: ExistingHomeLoan[];
  /** Other monthly commitments that won't stop, such as child support or rent you'll keep paying. */
  otherCommitments?: Cents;
  /** Interest rate on the new loan. */
  rate: number;
  termYears: number;
  /** Savings toward the purchase, to show a price. Buying costs aren't taken out. */
  deposit?: Cents;
}

/** How one lender assesses an application. */
export interface LenderPolicy {
  name: string;
  /** Added to the loan rate to test repayments. APRA expects at least 3%. */
  buffer: number;
  /** The assessment rate is never below this. */
  floorRate: number;
  /** Share of each kind of income the lender counts. */
  shading: { overtime: number; bonus: number; rent: number };
  /** Monthly repayment assumed on each dollar of card limit. */
  cardFactor: number;
  /** Multiplies the living expenses benchmark. */
  expenseLoading: number;
  /** Lenders rarely go above this debt-to-income ratio. */
  maxDti: number;
}

export const LENDER_PROFILES: Record<"cautious" | "typical" | "generous", LenderPolicy> = {
  cautious: {
    name: "Cautious lender",
    buffer: 0.03,
    floorRate: 0,
    shading: { overtime: 0.5, bonus: 0.5, rent: 0.7 },
    cardFactor: 0.038,
    expenseLoading: 1.1,
    maxDti: 6,
  },
  typical: {
    name: "Typical lender",
    buffer: 0.03,
    floorRate: 0,
    shading: { overtime: 0.8, bonus: 0.8, rent: 0.8 },
    cardFactor: 0.038,
    expenseLoading: 1,
    maxDti: 7,
  },
  generous: {
    name: "Generous lender",
    buffer: 0.03,
    floorRate: 0,
    shading: { overtime: 1, bonus: 0.8, rent: 0.8 },
    cardFactor: 0.03,
    expenseLoading: 1,
    maxDti: 8,
  },
};

/**
 * Living expenses floor, a month. Lenders use the Melbourne Institute's
 * Household Expenditure Measure, which isn't public, so this is our own
 * estimate in its shape: a base for a single or a couple, more for each
 * dependant, and higher as household income goes up.
 */
export const EXPENSE_BENCHMARK = {
  single: 1_550_00 as Cents,
  couple: 2_400_00 as Cents,
  perDependant: 480_00 as Cents,
  /** Gross household income a year (from) and the loading on the base. */
  incomeBands: [
    { from: 0 as Cents, loading: 1 },
    { from: 60_000_00 as Cents, loading: 1.1 },
    { from: 100_000_00 as Cents, loading: 1.2 },
    { from: 150_000_00 as Cents, loading: 1.32 },
    { from: 200_000_00 as Cents, loading: 1.45 },
    { from: 300_000_00 as Cents, loading: 1.6 },
  ],
};

export function expenseFloor(people: number, dependants: number, grossIncome: Cents): Cents {
  const base =
    (people > 1 ? EXPENSE_BENCHMARK.couple : EXPENSE_BENCHMARK.single) +
    EXPENSE_BENCHMARK.perDependant * dependants;
  let loading = 1;
  for (const b of EXPENSE_BENCHMARK.incomeBands) if (grossIncome >= b.from) loading = b.loading;
  return Math.round(base * loading) as Cents;
}

export interface ApplicantAssessment {
  /** Income before tax, as earned. */
  gross: Cents;
  /** Income before tax the lender counts, after shading. */
  assessed: Cents;
  /** Take-home pay a year on the assessed income. */
  net: Cents;
  tax: Cents; // income tax, Medicare and study loan on the assessed income
}

export type BorrowingWarning =
  | { kind: "no-surplus" }
  | { kind: "dti-capped"; dti: number; max: number }
  | { kind: "high-dti"; dti: number }
  | { kind: "expenses-floored"; floor: Cents };

export interface BorrowingResult {
  policy: LenderPolicy;
  /** What a lender would likely lend, after the debt-to-income limit. */
  maxLoan: Cents;
  /** What the surplus alone would service, before the debt-to-income limit. */
  serviceableLoan: Cents;
  assessmentRate: number;
  /** Monthly repayment on `maxLoan` at your actual rate. */
  repayment: Cents;
  /** Monthly repayment on `maxLoan` at the assessment rate. */
  assessedRepayment: Cents;
  applicants: ApplicantAssessment[];
  /** Monthly amounts the lender works from. */
  monthly: {
    income: Cents; // take-home, after shading
    expenses: Cents; // the higher of declared and the floor
    declaredExpenses: Cents;
    expenseFloor: Cents;
    cards: Cents;
    loans: Cents;
    homeLoans: Cents;
    other: Cents;
    surplus: Cents; // what's left for the new loan
  };
  grossIncome: Cents; // a year, unshaded
  /** Total debt (new loan, other loans, home loans and card limits) over gross income. */
  dti: number;
  /** `maxLoan` plus the deposit, before buying costs. */
  price: Cents | null;
  warnings: BorrowingWarning[];
}

const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const toC = (n: number) => Math.round(n) as Cents;

export function validateBorrowing(input: BorrowingInput): string[] {
  const errors: string[] = [];
  const ok = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v >= 0);
  if (input.applicants.length < 1 || input.applicants.length > 2)
    errors.push("Add one or two people.");
  for (const a of input.applicants)
    if (![a.salary, a.overtime, a.bonus, a.rent, a.other, a.salarySacrifice].every(ok))
      errors.push("Income can't be negative.");
  if (!Number.isInteger(input.dependants) || input.dependants < 0 || input.dependants > 10)
    errors.push("Dependants should be a whole number from 0 to 10.");
  if (
    ![
      input.livingExpenses,
      input.cardLimits,
      input.loanRepayments,
      input.loanBalances,
      input.otherCommitments,
      input.deposit,
    ].every(ok)
  )
    errors.push("Amounts can't be negative.");
  for (const h of input.homeLoans ?? [])
    if (!ok(h.balance) || !(h.termYears > 0 && h.termYears <= 40))
      errors.push("Other home loans need a balance and a term of 1 to 40 years.");
  if (!(input.rate >= 0 && input.rate < 0.3)) errors.push("Enter a rate between 0% and 30%.");
  if (!(input.termYears >= 1 && input.termYears <= 40))
    errors.push("Enter a term between 1 and 40 years.");
  return errors;
}

function assessApplicant(
  a: Applicant,
  partner: Applicant | undefined,
  dependants: number,
  year: string,
  p: LenderPolicy,
): ApplicantAssessment {
  const gross = toC(sum([a.salary, a.overtime, a.bonus, a.rent, a.other]));
  const overtime = toC((a.overtime ?? 0) * p.shading.overtime);
  const bonus = toC((a.bonus ?? 0) * p.shading.bonus);
  const allowances = toC((a.rent ?? 0) * p.shading.rent + (a.other ?? 0));
  const partnerIncome = partner
    ? toC(
        partner.salary +
          (partner.overtime ?? 0) * p.shading.overtime +
          (partner.bonus ?? 0) * p.shading.bonus +
          (partner.rent ?? 0) * p.shading.rent +
          (partner.other ?? 0),
      )
    : 0;
  const pay = calculatePay({
    year,
    salary: a.salary,
    overtime,
    bonus,
    allowances,
    salarySacrifice: a.salarySacrifice,
    studyLoan: a.studyLoan,
    family:
      partner || dependants > 0
        ? { partnerIncome: partnerIncome as Cents, children: dependants }
        : undefined,
  });
  return {
    gross,
    assessed: (a.salary + overtime + bonus + allowances) as Cents,
    net: pay.net,
    tax: pay.totalTax,
  };
}

/** Borrowing power under one lender policy. */
export function borrowingPower(
  input: BorrowingInput,
  policy: LenderPolicy = LENDER_PROFILES.typical,
): BorrowingResult {
  const errors = validateBorrowing(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  const [first, second] = input.applicants;
  const applicants = input.applicants.map((a) =>
    assessApplicant(a, a === first ? second : first, input.dependants, input.year, policy),
  );
  const grossIncome = toC(sum(applicants.map((a) => a.gross)));
  const assessmentRate = Math.max(input.rate + policy.buffer, policy.floorRate);

  const floor = toC(
    expenseFloor(input.applicants.length, input.dependants, grossIncome) * policy.expenseLoading,
  );
  const expenses = Math.max(input.livingExpenses, floor) as Cents;
  const homeLoans = (input.homeLoans ?? []).map((h) =>
    calcMinRepayment(h.balance, assessmentRate, h.termYears, "monthly"),
  );
  const monthly = {
    income: toC(sum(applicants.map((a) => a.net)) / 12),
    expenses,
    declaredExpenses: input.livingExpenses,
    expenseFloor: floor,
    cards: toC((input.cardLimits ?? 0) * policy.cardFactor),
    loans: (input.loanRepayments ?? 0) as Cents,
    homeLoans: toC(sum(homeLoans)),
    other: (input.otherCommitments ?? 0) as Cents,
    surplus: 0 as Cents,
  };
  monthly.surplus = (monthly.income -
    monthly.expenses -
    monthly.cards -
    monthly.loans -
    monthly.homeLoans -
    monthly.other) as Cents;

  const serviceableLoan =
    monthly.surplus > 0
      ? repaymentToBalance(monthly.surplus, assessmentRate, input.termYears, "monthly")
      : (0 as Cents);
  const otherDebt = sum([
    input.cardLimits,
    input.loanBalances,
    ...(input.homeLoans ?? []).map((h) => h.balance),
  ]);
  const dtiLoan = Math.max(0, toC(grossIncome * policy.maxDti - otherDebt));
  const maxLoan = Math.min(serviceableLoan, dtiLoan) as Cents;
  const dti = grossIncome > 0 ? (maxLoan + otherDebt) / grossIncome : 0;

  const warnings: BorrowingWarning[] = [];
  if (monthly.surplus <= 0) warnings.push({ kind: "no-surplus" });
  if (serviceableLoan > dtiLoan) warnings.push({ kind: "dti-capped", dti, max: policy.maxDti });
  else if (dti >= 6) warnings.push({ kind: "high-dti", dti });
  if (floor > input.livingExpenses) warnings.push({ kind: "expenses-floored", floor });

  return {
    policy,
    maxLoan,
    serviceableLoan,
    assessmentRate,
    repayment: calcMinRepayment(maxLoan, input.rate, input.termYears, "monthly"),
    assessedRepayment: calcMinRepayment(maxLoan, assessmentRate, input.termYears, "monthly"),
    applicants,
    monthly,
    grossIncome,
    dti,
    price: input.deposit === undefined ? null : ((maxLoan + input.deposit) as Cents),
    warnings,
  };
}

/** Borrowing power under the cautious, typical and generous lender policies. */
export function borrowingRange(input: BorrowingInput): {
  low: BorrowingResult;
  typical: BorrowingResult;
  high: BorrowingResult;
} {
  return {
    low: borrowingPower(input, LENDER_PROFILES.cautious),
    typical: borrowingPower(input, LENDER_PROFILES.typical),
    high: borrowingPower(input, LENDER_PROFILES.generous),
  };
}

export type BorrowingLever =
  | "close-cards"
  | "clear-loans"
  | "rate-down"
  | "rate-up"
  | "longer-term"
  | "lower-spending";

/** What changing one thing does to the typical result, biggest gain first. Levers that don't apply are left out. */
export function borrowingLevers(
  input: BorrowingInput,
  policy: LenderPolicy = LENDER_PROFILES.typical,
): { lever: BorrowingLever; maxLoan: Cents; change: Cents }[] {
  const base = borrowingPower(input, policy).maxLoan;
  const tries: [BorrowingLever, BorrowingInput | null][] = [
    ["close-cards", input.cardLimits ? { ...input, cardLimits: 0 as Cents } : null],
    [
      "clear-loans",
      input.loanRepayments
        ? { ...input, loanRepayments: 0 as Cents, loanBalances: 0 as Cents }
        : null,
    ],
    ["lower-spending", { ...input, livingExpenses: toC(input.livingExpenses * 0.9) }],
    ["longer-term", input.termYears < 30 ? { ...input, termYears: 30 } : null],
    ["rate-down", input.rate >= 0.005 ? { ...input, rate: input.rate - 0.005 } : null],
    ["rate-up", { ...input, rate: input.rate + 0.01 }],
  ];
  return tries
    .filter((t): t is [BorrowingLever, BorrowingInput] => t[1] !== null)
    .map(([lever, i]) => {
      const maxLoan = borrowingPower(i, policy).maxLoan;
      return { lever, maxLoan, change: (maxLoan - base) as Cents };
    })
    .filter((l) => l.change !== 0 || l.lever === "rate-up")
    .sort((a, b) => b.change - a.change);
}
