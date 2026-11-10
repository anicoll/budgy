import type { Cents } from "../money/cents";
import { projectSuper, type SuperInput } from "./project";

/**
 * What a difference in fund fees adds up to by retirement.
 *
 * Takes one account (the fund) and runs the normal projection twice, swapping
 * only its admin fees. The balance, contributions and return are the same, so
 * the return is read as the return before these fees, and only the fees
 * differ. Anything else the person holds is left as it is.
 */

export interface FundFees {
  /** Dollars a year, as cents. */
  fixed: Cents;
  /** A year, of the balance, e.g. 0.0065 for 0.65%. */
  pct: number;
}

export interface FeeComparison {
  /** The person's super at retirement, in today's dollars, with fund A's fees. */
  a: Cents;
  /** The same with fund B's fees. */
  b: Cents;
  /** B less A. Positive means B ends up with more. */
  difference: Cents;
}

/** What the fees cost in the first year on a balance. */
export function annualFee(fees: FundFees, balance: Cents): Cents {
  return Math.round(fees.fixed + balance * fees.pct) as Cents;
}

/**
 * Compare two sets of fees on one account. Null if the person or account is
 * not found, or the input does not validate.
 */
export function compareFundFees(
  input: SuperInput,
  personId: string,
  accountId: string,
  a: FundFees,
  b: FundFees,
): FeeComparison | null {
  const person = input.people.find((p) => p.id === personId);
  if (!person?.accounts.some((x) => x.id === accountId)) return null;
  const run = (fees: FundFees): Cents | null => {
    const people = input.people.map((p) =>
      p.id !== personId
        ? p
        : {
            ...p,
            accounts: p.accounts.map((x) =>
              x.id === accountId ? { ...x, adminFeeFixed: fees.fixed, adminFeePct: fees.pct } : x,
            ),
          },
    );
    try {
      return (
        projectSuper({ ...input, people }).people.find((p) => p.id === personId)
          ?.atRetirementReal ?? null
      );
    } catch {
      return null;
    }
  };
  const ra = run(a);
  const rb = run(b);
  if (ra === null || rb === null) return null;
  return { a: ra, b: rb, difference: (rb - ra) as Cents };
}
