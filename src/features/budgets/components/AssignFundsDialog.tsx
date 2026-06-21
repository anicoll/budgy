"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Cents } from "@/lib/money/cents";
import { fromCents, toCents } from "@/lib/money/cents";
import type { BackendCategory } from "../api/types";
import { type BudgetFrequency, FREQUENCY_LABEL } from "../utils/normalise";

interface Props {
  open: boolean;
  category: BackendCategory | null;
  defaultAmountCents?: Cents;
  defaultFrequency?: BudgetFrequency;
  mode?: "set" | "add";
  readyToAssign?: Cents;
  onClose: () => void;
  onSubmit: (amountCents: Cents, frequency: BudgetFrequency) => Promise<void>;
  submitting?: boolean;
}

export function AssignFundsDialog({
  open,
  category,
  defaultAmountCents,
  defaultFrequency,
  mode = "set",
  readyToAssign,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<BudgetFrequency>("monthly");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmountCents !== undefined ? fromCents(defaultAmountCents).toFixed(2) : "");
      setFrequency(defaultFrequency ?? category?.budgetedFrequency ?? "monthly");
      setError(null);
    }
  }, [open, defaultAmountCents, defaultFrequency, category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive amount");
      return;
    }
    const amountCents = toCents(parsed);
    const currentBudgeted = category?.budgeted ?? 0;
    const assignmentDelta = mode === "add" ? amountCents : amountCents - currentBudgeted;
    if (readyToAssign !== undefined && readyToAssign >= 0 && assignmentDelta > 0 && assignmentDelta > readyToAssign) {
      setError(
        `Cannot assign more than ${fromCents(readyToAssign).toFixed(2)} — only that much is ready to assign`,
      );
      return;
    }
    setError(null);
    await onSubmit(amountCents, frequency);
  }

  const isIncome = category?.type === "income";
  const title = mode === "add" ? "Increase target" : "Set target";
  const description =
    mode === "add"
      ? `Add to the ${isIncome ? "income" : "expense"} target for ${category?.name ?? "this category"}.`
      : `Set the ${isIncome ? "expected income" : "spending"} target for ${category?.name ?? "this category"}.`;

  return (
    <Dialog key={category?.id ?? "assign"} open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-2">
              <Label htmlFor="assign-amount">Amount</Label>
              <Input
                id="assign-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assign-frequency">Target frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as BudgetFrequency)}>
                <SelectTrigger id="assign-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQUENCY_LABEL) as BudgetFrequency[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {readyToAssign !== undefined ? (
              <p className="text-xs text-muted-foreground">
                Ready to assign: {fromCents(readyToAssign).toFixed(2)}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
