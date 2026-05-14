import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
} from "date-fns";
import type { DateRange } from "@/lib/date/periods";
import type { BudgetPeriod } from "../types";

const ISO = (d: Date) => format(d, "yyyy-MM-dd");

export function currentPeriodRange(
  period: BudgetPeriod,
  startDate: string,
  ref: Date = new Date(),
): DateRange {
  const anchor = new Date(`${startDate}T00:00:00`);

  switch (period) {
    case "weekly": {
      const daysDiff = Math.floor((ref.getTime() - anchor.getTime()) / 86400_000);
      const periodIdx = Math.floor(daysDiff / 7);
      const start = addDays(anchor, periodIdx * 7);
      return { from: ISO(start), to: ISO(addDays(start, 6)) };
    }
    case "fortnightly": {
      const daysDiff = Math.floor((ref.getTime() - anchor.getTime()) / 86400_000);
      const periodIdx = Math.floor(daysDiff / 14);
      const start = addDays(anchor, periodIdx * 14);
      return { from: ISO(start), to: ISO(addDays(start, 13)) };
    }
    case "monthly":
      return { from: ISO(startOfMonth(ref)), to: ISO(endOfMonth(ref)) };
    case "yearly":
      return { from: ISO(startOfYear(ref)), to: ISO(endOfYear(ref)) };
  }
}

export function shiftBudgetPeriod(
  period: BudgetPeriod,
  startDate: string,
  currentRange: DateRange,
  delta: number,
): DateRange {
  const from = new Date(`${currentRange.from}T00:00:00`);
  switch (period) {
    case "weekly":
      return currentPeriodRange(period, startDate, addWeeks(from, delta));
    case "fortnightly":
      return currentPeriodRange(period, startDate, addDays(from, 14 * delta));
    case "monthly":
      return currentPeriodRange(period, startDate, addMonths(from, delta));
    case "yearly":
      return currentPeriodRange(period, startDate, addYears(from, delta));
  }
}

export function formatPeriodLabel(range: DateRange, period: BudgetPeriod): string {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);

  const shortMonth = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const fullMonth = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const year = (d: Date) => d.getFullYear().toString();

  switch (period) {
    case "weekly":
    case "fortnightly":
      return `${shortMonth(from)} – ${shortMonth(to)}`;
    case "monthly":
      return fullMonth(from);
    case "yearly":
      return year(from);
  }
}
