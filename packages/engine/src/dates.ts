/**
 * Calendar helpers on ISO date strings (YYYY-MM-DD), computed in UTC so the
 * result never depends on the machine's time zone.
 */

const DAY_MS = 86_400_000;

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && toIso(t / DAY_MS) === s;
}

/** Days since 1970-01-01 for an ISO date. */
export function toDay(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** ISO date for a day number from `toDay`. */
export function toIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * The date `months` months after `iso`, keeping the original day of month and
 * clamping it to the month's length (31 Jan + 1 month = 28 or 29 Feb).
 */
export function addMonths(iso: string, months: number): string {
  const y = Number(iso.slice(0, 4));
  const m0 = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const total = y * 12 + m0 + months;
  const ny = Math.floor(total / 12);
  const nm0 = total - ny * 12;
  const nd = Math.min(d, daysInMonth(ny, nm0));
  return `${ny}-${String(nm0 + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

/** Whole months from `a` to `b` (b later), counting only completed months. */
export function monthsBetween(a: string, b: string): number {
  let lo = 0;
  let hi = 12 * 200;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (addMonths(a, mid) <= b) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
