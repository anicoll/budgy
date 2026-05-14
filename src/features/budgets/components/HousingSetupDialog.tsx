"use client";

import { Home, Landmark } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSaveMortgagePlan } from "@/features/mortgage/hooks";
import { repaymentToBalance } from "@/features/mortgage/utils/inverse";
import type { Cents } from "@/lib/money/cents";
import { formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import { useSetTarget } from "../hooks";

/** Regex to detect housing/rent/mortgage categories by name. */
export function isHousingCategory(name: string): boolean {
  return /rent|mortgage|housing/i.test(name);
}

interface Props {
  category: { id: string; name: string; color: string };
  budgetId: string;
  onClose: () => void;
}

function displayToCents(s: string): Cents {
  const n = Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  return (Number.isFinite(n) ? Math.max(0, n) : 0) as Cents;
}

export function HousingSetupDialog({ category, budgetId, onClose }: Props) {
  const [choice, setChoice] = useState<"rent" | "mortgage" | null>(null);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("6.00");
  const [term, setTerm] = useState("30");
  const [setupMortgage, setSetupMortgage] = useState(true);
  const [busy, setBusy] = useState(false);

  const setTarget = useSetTarget();
  const saveMortgage = useSaveMortgagePlan();

  const repaymentCents = displayToCents(amount);
  const rateNum = Math.max(0, parseFloat(rate) || 0) / 100;
  const termNum = Math.max(1, Math.min(40, parseInt(term, 10) || 30));
  const estimatedBalance =
    repaymentCents > 0 && rateNum > 0
      ? repaymentToBalance(repaymentCents, rateNum, termNum)
      : (0 as Cents);

  async function handleRent() {
    if (!amount) return;
    setBusy(true);
    await setTarget.mutateAsync({
      budgetId,
      categoryId: category.id,
      amount: repaymentCents,
      frequency: "monthly",
      rollover: false,
    });
    setBusy(false);
    onClose();
  }

  async function handleMortgage() {
    if (!amount) return;
    setBusy(true);
    try {
      await setTarget.mutateAsync({
        budgetId,
        categoryId: category.id,
        amount: repaymentCents,
        frequency: "monthly",
        rollover: false,
      });
      if (setupMortgage && estimatedBalance > 0) {
        await saveMortgage.mutateAsync({
          loanAmount: estimatedBalance,
          currentBalance: estimatedBalance,
          interestRate: rateNum,
          termYears: termNum,
          startDate: new Date().toISOString().slice(0, 7),
          repaymentFrequency: "monthly",
          offsetBalance: 0 as Cents,
          redrawBalance: 0 as Cents,
          extraRepayment: 0 as Cents,
        });
      }
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-surface-elevated p-6 shadow-xl">
        {choice === null ? (
          <>
            <div className="mb-1 flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
              <h2 className="text-base font-semibold">{category.name}</h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Is this for rent payments or a mortgage?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChoice("rent")}
                className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-surface p-5 transition-colors hover:border-violet-500/60 hover:bg-muted/40"
              >
                <Home className="h-8 w-8 text-violet-400" />
                <div className="text-center">
                  <div className="text-sm font-medium">Renting</div>
                  <div className="text-xs text-muted-foreground">Fixed monthly rent</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setChoice("mortgage")}
                className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-surface p-5 transition-colors hover:border-violet-500/60 hover:bg-muted/40"
              >
                <Landmark className="h-8 w-8 text-violet-400" />
                <div className="text-center">
                  <div className="text-sm font-medium">Mortgage</div>
                  <div className="text-xs text-muted-foreground">Home loan repayments</div>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : choice === "rent" ? (
          <>
            <h2 className="mb-1 text-base font-semibold">Monthly rent</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              How much do you pay in rent each month?
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Monthly amount</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 focus-within:border-violet-500/70">
                <span className="text-muted-foreground">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2200"
                  className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                />
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
            </label>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setChoice(null)} className="flex-1">
                Back
              </Button>
              <Button
                disabled={!amount || repaymentCents === 0 || busy}
                onClick={handleRent}
                className="flex-1 bg-gradient-accent text-primary-foreground hover:opacity-90"
              >
                {busy ? "Saving…" : "Add to budget"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-base font-semibold">Mortgage repayments</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter your repayment details. We&apos;ll calculate the estimated loan balance.
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Monthly repayment</span>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 focus-within:border-violet-500/70">
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 3200"
                    className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                  />
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Interest rate</span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 focus-within:border-violet-500/70">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                    />
                    <span className="text-xs text-muted-foreground">% p.a.</span>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Remaining term</span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 focus-within:border-violet-500/70">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                    />
                    <span className="text-xs text-muted-foreground">yrs</span>
                  </div>
                </label>
              </div>

              {estimatedBalance > 0 && (
                <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Estimated loan balance:{" "}
                  <strong className="text-foreground">{formatAUDCompact(estimatedBalance)}</strong>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={setupMortgage}
                  onChange={(e) => setSetupMortgage(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                <div>
                  <div className="text-sm font-medium">Also set up mortgage projector</div>
                  <div className="text-xs text-muted-foreground">
                    Pre-fill the Mortgage tab with these details
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setChoice(null)} className="flex-1">
                Back
              </Button>
              <Button
                disabled={!amount || repaymentCents === 0 || busy}
                onClick={handleMortgage}
                className={cn("flex-1 bg-gradient-accent text-primary-foreground hover:opacity-90")}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
