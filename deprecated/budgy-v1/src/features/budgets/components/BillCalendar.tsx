"use client";

import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EnvelopeBundle, EnvelopeState } from "../types";
import { STATUS_BORDER_COLOR, STATUS_LABEL, STATUS_TEXT_COLOR } from "./shared/EnvelopeProgress";

interface Props {
  bundle: EnvelopeBundle;
  onOpen: (state: EnvelopeState) => void;
}

const STATUS_PILL_BG: Record<string, string> = {
  healthy: "bg-emerald-500/15",
  watch: "bg-amber-500/15",
  overspent: "bg-rose-500/15",
};

const STATUS_PILL_TEXT: Record<string, string> = {
  healthy: "text-emerald-300",
  watch: "text-amber-300",
  overspent: "text-rose-300",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BillCalendar({ bundle, onOpen }: Props) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const allEnvelopes = [...bundle.income, ...bundle.expense];
  const billEnvelopes = allEnvelopes.filter((e) => e.mode === "envelope" && e.nextDueOn);

  if (billEnvelopes.length === 0) {
    return <EmptyState />;
  }

  const month1Start = startOfMonth(now);
  const month2End = endOfMonth(addMonths(now, 1));
  const visibleFrom = format(month1Start, "yyyy-MM-dd");
  const visibleTo = format(month2End, "yyyy-MM-dd");

  const months = [now, addMonths(now, 1)].map((monthDate) => {
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(mStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
    return {
      label: format(mStart, "MMMM yyyy"),
      days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
      monthDate,
    };
  });

  const sixWeeksEnd = addWeeks(now, 6);
  const upcomingBills = billEnvelopes
    .filter((e) => {
      if (!e.nextDueOn) return false;
      const due = parseISO(e.nextDueOn);
      return !isBefore(due, now) && !isAfter(due, sixWeeksEnd);
    })
    .sort((a, b) => ((a.nextDueOn ?? "") > (b.nextDueOn ?? "") ? 1 : -1));

  const hasBillsInRange = billEnvelopes.some(
    (e) => (e.nextDueOn ?? "") >= visibleFrom && (e.nextDueOn ?? "") <= visibleTo,
  );

  function getBillsOnDate(dateStr: string): EnvelopeState[] {
    if (dateStr < todayStr) return [];
    return billEnvelopes.filter((e) => e.nextDueOn === dateStr);
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Calendar months */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {months.map(({ label, days, monthDate }) => (
            <div key={label} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-[10px] font-medium text-muted-foreground/50"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const isCurrentMonth = isSameMonth(day, monthDate);
                  const isPast = dayStr < todayStr;
                  const isToday = dayStr === todayStr;
                  const bills = getBillsOnDate(dayStr);

                  return (
                    <div
                      key={dayStr}
                      className={cn(
                        "min-h-[60px] rounded-lg border p-1",
                        isCurrentMonth
                          ? "border-border/40 bg-surface/40"
                          : "border-transparent bg-transparent",
                        isPast && isCurrentMonth && "opacity-40",
                        isToday && "ring-2 ring-violet-500/60",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-0.5 text-right text-[11px] leading-none",
                          isCurrentMonth ? "text-foreground/60" : "text-muted-foreground/20",
                          isToday && "font-semibold text-violet-300",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {bills.map((env) => (
                          <BillPill key={env.categoryId} state={env} onOpen={onOpen} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!hasBillsInRange && (
            <div className="rounded-xl border border-dashed border-border/60 bg-surface/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                No bills predicted in the next two months. Predictions appear once an envelope has
                enough transaction history.
              </p>
            </div>
          )}
        </div>

        {/* Upcoming bills sidebar */}
        <div className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Next 6 weeks
          </h3>
          {upcomingBills.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No bills in the next 6 weeks.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingBills.map((env) => (
                <UpcomingBillRow key={env.categoryId} state={env} onOpen={onOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function BillPill({ state, onOpen }: { state: EnvelopeState; onOpen: (s: EnvelopeState) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(state)}
          className={cn(
            "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left transition-opacity hover:opacity-80",
            STATUS_PILL_BG[state.status],
          )}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: state.categoryColor }}
            aria-hidden
          />
          <span
            className={cn(
              "flex-1 truncate text-[10px] leading-tight",
              STATUS_PILL_TEXT[state.status],
            )}
          >
            {state.categoryName}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-1.5 py-2">
        <div className="font-semibold">{state.categoryName}</div>
        <div className="flex w-full items-center justify-between gap-4">
          <span className="opacity-70">Expected bill</span>
          <Money value={state.target.amount} className="tabular-nums" />
        </div>
        {state.fundedByNextDue !== undefined && (
          <div className="flex w-full items-center justify-between gap-4">
            <span className="opacity-70">Funded by due date</span>
            <Money value={state.fundedByNextDue} className="tabular-nums" />
          </div>
        )}
        <div className="mt-0.5 text-[10px] font-medium opacity-80">
          {STATUS_LABEL[state.status]}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function UpcomingBillRow({
  state,
  onOpen,
}: {
  state: EnvelopeState;
  onOpen: (s: EnvelopeState) => void;
}) {
  const dueDate = state.nextDueOn ? parseISO(state.nextDueOn) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(state)}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-surface/30 px-3 py-2 text-left transition-colors hover:bg-surface/60",
        STATUS_BORDER_COLOR[state.status],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: state.categoryColor }}
            aria-hidden
          />
          <span className="truncate text-xs font-medium">{state.categoryName}</span>
        </div>
        <Money value={state.target.amount} className="shrink-0 text-xs tabular-nums" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {dueDate ? format(dueDate, "EEE d MMM") : "–"}
        </span>
        <span className={cn("text-[10px] font-medium", STATUS_TEXT_COLOR[state.status])}>
          {STATUS_LABEL[state.status]}
        </span>
      </div>
      {state.fundedByNextDue !== undefined && (
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] text-muted-foreground">Funded</span>
          <Money
            value={state.fundedByNextDue}
            className="text-[10px] tabular-nums text-muted-foreground"
          />
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed border-border/60 bg-surface/30">
      <CardContent className="flex flex-col items-start gap-2 px-4 py-5">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-sm font-medium">No bills to show</div>
        <div className="text-[11px] text-muted-foreground">
          Calendar view shows upcoming bills for envelope-mode categories. Add a quarterly or yearly
          budget — like insurance or council rates — and predictions will appear here once there is
          enough transaction history.
        </div>
      </CardContent>
    </Card>
  );
}
