import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type PeriodKind = "week" | "fortnight" | "month" | "quarter" | "year" | "custom";

export interface DateRange {
  from: string;
  to: string;
}

const ISO = (d: Date) => d.toISOString().slice(0, 10);

export function rangeForPeriod(
  period: PeriodKind,
  ref: Date = new Date(),
  opts: { fortnightAnchor?: string } = {},
): DateRange {
  switch (period) {
    case "week":
      return {
        from: ISO(startOfWeek(ref, { weekStartsOn: 1 })),
        to: ISO(endOfWeek(ref, { weekStartsOn: 1 })),
      };
    case "fortnight": {
      const anchor = opts.fortnightAnchor
        ? new Date(`${opts.fortnightAnchor}T00:00:00`)
        : startOfWeek(ref, { weekStartsOn: 1 });
      const diffDays = Math.floor((ref.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const periodIndex = Math.floor(diffDays / 14);
      const start = addDays(anchor, periodIndex * 14);
      const end = addDays(start, 13);
      return { from: ISO(start), to: ISO(end) };
    }
    case "month":
      return { from: ISO(startOfMonth(ref)), to: ISO(endOfMonth(ref)) };
    case "quarter":
      return { from: ISO(startOfQuarter(ref)), to: ISO(endOfQuarter(ref)) };
    case "year":
      return { from: ISO(startOfYear(ref)), to: ISO(endOfYear(ref)) };
    case "custom":
      return { from: ISO(startOfMonth(ref)), to: ISO(endOfMonth(ref)) };
  }
}

export function shiftRange(range: DateRange, period: PeriodKind, delta: number): DateRange {
  const from = new Date(`${range.from}T00:00:00`);
  switch (period) {
    case "week":
      return rangeForPeriod("week", addWeeks(from, delta));
    case "fortnight":
      return rangeForPeriod("fortnight", addDays(from, 14 * delta));
    case "month":
      return rangeForPeriod("month", addMonths(from, delta));
    case "quarter":
      return rangeForPeriod("quarter", addQuarters(from, delta));
    case "year":
      return rangeForPeriod("year", addYears(from, delta));
    case "custom":
      return range;
  }
}
