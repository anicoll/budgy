"use client";

import { format } from "date-fns";
import { Archive, CalendarClock, PiggyBank, Repeat, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import { useRemoveTarget, useSetTarget } from "../hooks";
import type { BudgetFrequency, BudgetMode, EnvelopeState } from "../types";
import { defaultModeFor } from "../utils/envelope";
import { FREQUENCY_LABEL } from "../utils/normalise";
import { BalanceSparkline } from "./shared/BalanceSparkline";
import { STATUS_LABEL, STATUS_TEXT_COLOR } from "./shared/EnvelopeProgress";

interface Props {
  state: EnvelopeState | null;
  budgetId: string;
  transactions: Transaction[];
  onClose: () => void;
}

const FREQUENCY_OPTIONS: BudgetFrequency[] = [
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "yearly",
];

export function EnvelopeDetailSheet({ state, budgetId, transactions, onClose }: Props) {
  const open = !!state;

  const setTarget = useSetTarget();
  const removeTarget = useRemoveTarget();

  // Local form state
  const [amountStr, setAmountStr] = useState("");
  const [frequency, setFrequency] = useState<BudgetFrequency>("monthly");
  const [mode, setMode] = useState<BudgetMode>("envelope");
  const [openedAt, setOpenedAt] = useState<string>("");

  // Re-init when sheet opens for a new envelope
  useEffect(() => {
    if (!state) return;
    setAmountStr(String(Math.round(state.target.amount / 100)));
    setFrequency(state.target.frequency);
    setMode(state.target.mode);
    setOpenedAt(state.target.openedAt);
  }, [state]);

  if (!state) return null;

  async function save() {
    if (!state) return;
    const amountCents = Math.max(0, Math.round(parseFloat(amountStr || "0") * 100));
    await setTarget.mutateAsync({
      budgetId,
      categoryId: state.categoryId,
      amount: amountCents,
      frequency,
      mode,
      openedAt,
    });
    toast.success(`${state.categoryName} saved`);
    onClose();
  }

  async function remove() {
    if (!state) return;
    if (state.categorySystem) {
      toast.error("System category — cannot remove");
      return;
    }
    if (!confirm(`Remove ${state.categoryName} from this budget?`)) return;
    await removeTarget.mutateAsync({ budgetId, categoryId: state.categoryId });
    onClose();
  }

  const txnsForCategory = transactions
    .filter((t) => t.categoryId === state.categoryId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className="h-4 w-4 shrink-0 rounded-full ring-1 ring-border/40"
              style={{ background: state.categoryColor }}
              aria-hidden
            />
            <SheetTitle className="flex-1 truncate">{state.categoryName}</SheetTitle>
            <span
              className={cn("text-[11px] uppercase tracking-wide", STATUS_TEXT_COLOR[state.status])}
            >
              {STATUS_LABEL[state.status]}
            </span>
          </div>
          <SheetDescription>
            {state.mode === "envelope"
              ? "Money accumulates here each period. Spending draws it down."
              : "Resets each period — meant for steady weekly/monthly limits."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/40 bg-surface/40 p-3">
            <SnapshotCell
              label="Balance"
              value={state.balance}
              signed
              muted={state.mode !== "envelope"}
            />
            <SnapshotCell label="Funded" value={state.funded} muted={state.mode !== "envelope"} />
            <SnapshotCell label="Spent" value={state.spent} muted={state.mode !== "envelope"} />
            <SnapshotCell label="Period target" value={state.periodTarget} />
            <SnapshotCell label="Period actual" value={state.periodActual} />
            <SnapshotCell label="Period left" value={state.periodVariance} signed />
          </div>

          {/* Forecast (envelope mode only, when prediction available) */}
          {state.mode === "envelope" && state.nextDueOn && <ForecastPanel state={state} />}

          {/* Balance trend (envelope mode only) */}
          {state.mode === "envelope" &&
            state.balanceHistory &&
            state.balanceHistory.length >= 2 && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/40 bg-surface/40 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Balance trend
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Last {state.balanceHistory.length} periods
                  </span>
                </div>
                <BalanceSparkline
                  points={state.balanceHistory.map((p) => ({ balance: p.balance }))}
                  className="h-10"
                />
              </div>
            )}

          {/* Edit form */}
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Target
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Amount</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 focus-within:border-ring">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                />
              </div>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Frequency</span>
              <Select
                value={frequency}
                onValueChange={(v) => {
                  const f = v as BudgetFrequency;
                  setFrequency(f);
                  // Hint: switch default mode if user hasn't manually changed it from the suggested one
                  if (mode === defaultModeFor(state.target.frequency)) {
                    setMode(defaultModeFor(f));
                  }
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ModeToggleRow mode={mode} onChange={setMode} />

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Funding started</span>
              <input
                type="date"
                value={openedAt.slice(0, 10)}
                onChange={(e) => setOpenedAt(e.target.value)}
                className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <span className="text-[10px] text-muted-foreground">
                Cumulative balance is calculated from this date.
              </span>
            </label>
          </div>

          {/* Recent transactions */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recent transactions
            </div>
            {txnsForCategory.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No transactions yet for this category.
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {txnsForCategory.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface/30 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{t.date}</span>
                  <span className="flex-1 truncate">{t.payee || t.description || "—"}</span>
                  <Money value={signedAmount(t)} variant="signed" signColor className="text-xs" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-border/40 px-4 py-3">
          {!state.categorySystem && (
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              className="gap-1.5 text-rose-400 hover:text-rose-300"
            >
              {state.categorySystem ? (
                <Archive className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={setTarget.isPending}
              className="bg-gradient-accent text-primary-foreground hover:opacity-90"
            >
              {setTarget.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SnapshotCell({
  label,
  value,
  signed = false,
  muted = false,
}: {
  label: string;
  value: number;
  signed?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Money
        value={value as never}
        variant={signed ? "signed" : "default"}
        signColor={signed}
        muted={muted}
        className="text-sm font-medium"
      />
    </div>
  );
}

function ForecastPanel({ state }: { state: EnvelopeState }) {
  if (!state.nextDueOn) return null;
  const due = new Date(`${state.nextDueOn}T00:00:00Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const dateLabel = format(due, "EEE d MMM yyyy");
  const dayLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const target = state.target.amount;
  const projected = state.fundedByNextDue ?? state.balance;
  const pct = target > 0 ? Math.round((projected / target) * 100) : 0;
  const shortfall = (target - projected) as Cents;

  let summary: string;
  if (shortfall <= 0) {
    summary = "On track to cover the next bill in full.";
  } else if (pct >= 75) {
    summary = "Close — a small top-up will fully cover the next bill.";
  } else {
    summary = "Funding is behind. Consider raising the target or topping up.";
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-violet-300">
        <CalendarClock className="h-3.5 w-3.5" />
        Forecast
        {state.forecastConfidence === "low" && (
          <span className="ml-auto rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] font-normal normal-case tracking-normal text-muted-foreground">
            Estimate
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-medium">Next bill</span>
        <span className="text-foreground/80">{dateLabel}</span>
        <span className="text-[11px] text-muted-foreground">· {dayLabel}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Projected balance on that date:{" "}
        <Money value={projected} className="text-sm font-medium text-foreground" /> of{" "}
        <Money value={target} className="text-foreground/70" />{" "}
        <span className="tabular-nums">({pct}%)</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{summary}</div>
    </div>
  );
}

function ModeToggleRow({
  mode,
  onChange,
}: {
  mode: BudgetMode;
  onChange: (m: BudgetMode) => void;
}) {
  const isEnvelope = mode === "envelope";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
      <div className="mt-0.5">
        {isEnvelope ? (
          <PiggyBank className="h-4 w-4 text-violet-300" />
        ) : (
          <Repeat className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{isEnvelope ? "Envelope mode" : "Period mode"}</div>
        <div className="text-[10px] text-muted-foreground">
          {isEnvelope
            ? "Balance carries across periods. Best for quarterly/yearly bills."
            : "Resets each period. Best for steady weekly/monthly limits."}
        </div>
      </div>
      <Switch
        checked={isEnvelope}
        onCheckedChange={(checked) => onChange(checked ? "envelope" : "period")}
      />
    </div>
  );
}
