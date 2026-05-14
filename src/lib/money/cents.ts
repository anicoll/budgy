declare const __cents: unique symbol;
export type Cents = number & { readonly [__cents]: void };

export const ZERO_CENTS = 0 as Cents;

export function cents(n: number): Cents {
  if (!Number.isFinite(n)) {
    throw new RangeError(`Cents must be finite, got ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`Cents must be an integer, got ${n}`);
  }
  return n as Cents;
}

export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Amount must be finite, got ${amount}`);
  }
  return Math.round(amount * 100) as Cents;
}

export function fromCents(c: Cents): number {
  return c / 100;
}

export function addCents(...values: Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total as Cents;
}

export function subCents(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

export function negCents(c: Cents): Cents {
  return -c as Cents;
}

export function absCents(c: Cents): Cents {
  return Math.abs(c) as Cents;
}

export function isZero(c: Cents): boolean {
  return c === 0;
}

export function isNegative(c: Cents): boolean {
  return c < 0;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total as Cents;
}
