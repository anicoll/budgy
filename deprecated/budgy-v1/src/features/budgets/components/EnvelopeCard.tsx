"use client";

import { format } from "date-fns";
import { CalendarClock, ChevronRight, PiggyBank, Repeat } from "lucide-react";
import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import type { EnvelopeState, EnvelopeStatus } from "../types";
import { FREQUENCY_SHORT_LABEL } from "../utils/normalise";
import { BalanceSparkline } from "./shared/BalanceSparkline";
import {
  EnvelopeProgress,
  STATUS_BORDER_COLOR,
  STATUS_LABEL,
  STATUS_TEXT_COLOR,
} from "./shared/EnvelopeProgress";

interface Props {
  state: EnvelopeState;
  onOpen: (state: EnvelopeState) => void;
}

export function EnvelopeCard({ state, onOpen }: Props) {
  const isEnvelope = state.mode === "envelope";
  const target = state.target;

  // Envelope-mode UI: balance is the headline; progress is "how close to the next bill".
  // Period-mode UI: spent of target is the headline; progress is "how much of the period budget consumed".
  const headlineValue: Cents = isEnvelope ? state.balance : state.periodActual;
  const headlineLabel = isEnvelope ? "set aside" : "spent this period";

  // Progress ratio
  const ratio = isEnvelope
    ? target.amount > 0
      ? state.balance / target.amount
      : 0
    : state.periodTarget > 0
      ? state.periodActual / state.periodTarget
      : 0;

  const subText = isEnvelope ? (
    <span>
      of <Money value={target.amount} className="text-foreground/80" /> per{" "}
      {FREQUENCY_SHORT_LABEL[target.frequency]}
    </span>
  ) : (
    <span>
      of <Money value={state.periodTarget} className="text-foreground/80" /> /
      {FREQUENCY_SHORT_LABEL[target.frequency]}
    </span>
  );

  const showSparkline = isEnvelope && (state.balanceHistory?.length ?? 0) >= 2;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border bg-surface/60 backdrop-blur-md transition-colors",
        STATUS_BORDER_COLOR[state.status],
        "hover:border-violet-500/60",
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => onOpen(state)}
          className="flex w-full flex-col gap-2.5 px-4 py-3 text-left"
        >
          {/* Top row: avatar + name + mode + chevron */}
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border/50"
              style={{ background: state.categoryColor }}
              aria-hidden
            />
            <span className="flex-1 truncate text-sm font-medium">
              {state.categoryName}
              {state.parentCategoryName && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  · {state.parentCategoryName}
                </span>
              )}
            </span>

            <ModeBadge mode={state.mode} />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
          </div>

          {/* Headline */}
          <div className="flex items-baseline gap-2">
            <Money
              value={headlineValue}
              variant="default"
              className={cn(
                "text-2xl font-semibold tabular-nums",
                isEnvelope && state.balance < 0 && "text-rose-400",
              )}
            />
            <span className="text-[11px] text-muted-foreground">{headlineLabel}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{subText}</span>
          </div>

          {/* Progress bar */}
          <EnvelopeProgress ratio={ratio} status={state.status} />

          {/* Next-due tag (envelope mode only, when forecast available) */}
          {isEnvelope && state.nextDueOn && (
            <NextDueTag
              nextDueOn={state.nextDueOn}
              fundedByNextDue={state.fundedByNextDue}
              targetAmount={target.amount}
              confidence={state.forecastConfidence}
              status={state.status}
            />
          )}

          {/* Balance trajectory sparkline (envelope mode only) */}
          {showSparkline && state.balanceHistory && (
            <BalanceSparkline
              points={state.balanceHistory.map((p) => ({ balance: p.balance }))}
              color={sparklineColor(state.status)}
            />
          )}

          {/* Footer: status + period figures (when envelope) */}
          <div className="flex items-center justify-between text-[10px]">
            <span
              className={cn("font-medium uppercase tracking-wide", STATUS_TEXT_COLOR[state.status])}
            >
              {STATUS_LABEL[state.status]}
            </span>
            {isEnvelope && (
              <span className="text-muted-foreground">
                Funded <Money value={state.funded} className="text-foreground/80" /> · Spent{" "}
                <Money value={state.spent} className="text-foreground/80" />
              </span>
            )}
            {!isEnvelope && state.periodVariance >= 0 && (
              <span className="text-muted-foreground">
                <Money value={state.periodVariance} className="text-foreground/80" /> left
              </span>
            )}
            {!isEnvelope && state.periodVariance < 0 && (
              <span className="text-rose-400">
                <Money value={-state.periodVariance as Cents} className="text-rose-300" /> over
              </span>
            )}
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function NextDueTag({
  nextDueOn,
  fundedByNextDue,
  targetAmount,
  confidence,
  status,
}: {
  nextDueOn: string;
  fundedByNextDue?: Cents;
  targetAmount: Cents;
  confidence?: "high" | "low";
  status: EnvelopeStatus;
}) {
  const due = new Date(`${nextDueOn}T00:00:00Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const dateLabel = format(due, "d MMM");
  const dayLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : `${days}d`;
  const fundedPct =
    targetAmount > 0 && fundedByNextDue !== undefined
      ? Math.round((fundedByNextDue / targetAmount) * 100)
      : null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <CalendarClock className="h-3 w-3 shrink-0" />
      <span>
        Next bill{" "}
        <span className={cn(confidence === "low" && "italic")}>
          {confidence === "low" && "~"}
          {dateLabel}
        </span>
        <span className="text-muted-foreground/60"> · {dayLabel}</span>
      </span>
      {fundedPct !== null && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            status === "overspent"
              ? "bg-rose-500/15 text-rose-300"
              : fundedPct >= 100
                ? "bg-emerald-500/15 text-emerald-300"
                : fundedPct >= 60
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-muted/40 text-muted-foreground",
          )}
        >
          {fundedPct}% by then
        </span>
      )}
    </div>
  );
}

function sparklineColor(status: EnvelopeStatus): string {
  switch (status) {
    case "overspent":
      return "rgb(251 113 133)"; // rose-400
    case "watch":
      return "rgb(251 191 36)"; // amber-400
    default:
      return "rgb(167 139 250)"; // violet-400 (healthy)
  }
}

function ModeBadge({ mode }: { mode: "envelope" | "period" }) {
  if (mode === "envelope") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-300">
        <PiggyBank className="h-2.5 w-2.5" /> Envelope
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
      <Repeat className="h-2.5 w-2.5" /> Period
    </span>
  );
}
