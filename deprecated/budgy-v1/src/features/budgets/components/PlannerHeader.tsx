"use client";

import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import type { BudgetPeriod, EnvelopeBundle } from "../types";
import { BUDGET_PERIOD_LABEL } from "../types";

export type PlannerViewMode = "envelopes" | "period" | "calendar";

interface Props {
  budgetName: string;
  viewMode: PlannerViewMode;
  onViewMode: (m: PlannerViewMode) => void;
  viewPeriod: BudgetPeriod;
  onViewPeriod: (p: BudgetPeriod) => void;
  periodOffset: number;
  onPeriodOffset: (delta: number) => void;
  periodLabel: string;
  bundle: EnvelopeBundle | null;
}

const PERIOD_TABS: { value: BudgetPeriod; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "fortnightly", label: "2 Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

const VIEW_MODES: { value: PlannerViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "envelopes", label: "Envelopes", icon: LayoutGrid },
  { value: "period", label: "This period", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

export function PlannerHeader({
  budgetName,
  viewMode,
  onViewMode,
  viewPeriod,
  onViewPeriod,
  periodOffset,
  onPeriodOffset,
  periodLabel,
  bundle,
}: Props) {
  return (
    <header className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold">{budgetName}</h1>
          <p className="text-[11px] text-muted-foreground">
            {viewMode === "envelopes"
              ? "Money set aside for each category. Quarterly and yearly bills accumulate over time."
              : viewMode === "period"
                ? `Showing ${BUDGET_PERIOD_LABEL[viewPeriod].toLowerCase()} period totals.`
                : "Upcoming bills for envelope-mode categories."}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-surface/60 p-0.5">
          {VIEW_MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewMode(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                viewMode === value
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      {bundle && <KpiStrip bundle={bundle} />}

      {/* Period nav (period view only) + period type tabs (period view only) */}
      {viewMode === "period" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-surface/60 p-0.5">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onViewPeriod(t.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  viewPeriod === t.value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-1 py-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous period"
              onClick={() => onPeriodOffset(-1)}
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="flex min-w-[160px] items-center justify-center gap-1.5 text-xs tabular-nums">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              {periodLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next period"
              disabled={periodOffset >= 0}
              onClick={() => onPeriodOffset(1)}
              className="h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function KpiStrip({ bundle }: { bundle: EnvelopeBundle }) {
  const setAside = bundle.totals.balance;
  const overspentCount = [...bundle.income, ...bundle.expense].filter(
    (r) => r.status === "overspent",
  ).length;
  const watchCount = [...bundle.income, ...bundle.expense].filter(
    (r) => r.status === "watch",
  ).length;
  const envelopeCount = [...bundle.income, ...bundle.expense].filter(
    (r) => r.mode === "envelope",
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi
        label="Set aside"
        value={
          <Money
            value={setAside as Cents}
            variant="signed"
            signColor={setAside < 0}
            className="text-base font-semibold"
          />
        }
        sub={`${envelopeCount} envelope${envelopeCount === 1 ? "" : "s"}`}
      />
      <Kpi
        label="This period income"
        value={
          <Money
            value={bundle.totals.periodActualIncome}
            className="text-base font-semibold text-emerald-300"
          />
        }
        sub={
          <span>
            of <Money value={bundle.totals.periodTargetIncome} className="text-foreground/70" />
          </span>
        }
      />
      <Kpi
        label="This period spend"
        value={
          <Money
            value={bundle.totals.periodActualExpense}
            className="text-base font-semibold text-rose-300"
          />
        }
        sub={
          <span>
            of <Money value={bundle.totals.periodTargetExpense} className="text-foreground/70" />
          </span>
        }
      />
      <Kpi
        label="Needs attention"
        value={<span className="text-base font-semibold">{overspentCount + watchCount}</span>}
        sub={`${overspentCount} overspent · ${watchCount} watching`}
        warn={overspentCount > 0}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface/60 px-3 py-2 backdrop-blur-md",
        warn ? "border-rose-500/40" : "border-border/60",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
