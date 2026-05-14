"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { parseAUDInput } from "@/lib/money/format";
import type { BudgetFrequency, BudgetPeriod, FluidActual } from "../types";
import { FREQUENCY_LABEL, normaliseToPeriod } from "../utils/normalise";

interface Props {
  actual: FluidActual | null;
  viewPeriod: BudgetPeriod;
  onClose: () => void;
  onSave: (
    categoryId: string,
    amount: number,
    frequency: BudgetFrequency,
    rollover: boolean,
  ) => void;
}

export function TargetEditDialog({ actual, viewPeriod, onClose, onSave }: Props) {
  const [raw, setRaw] = useState("");
  const [frequency, setFrequency] = useState<BudgetFrequency>("monthly");

  useEffect(() => {
    if (actual) {
      const freq = actual.targetFrequency ?? viewPeriod;
      setFrequency(freq as BudgetFrequency);
      // raw is the native amount — back-calculate from projectedTarget if we only have that
      if (actual.projectedTarget) {
        const nativeAmount = normaliseToPeriod(
          actual.projectedTarget,
          viewPeriod as BudgetFrequency,
          freq as BudgetFrequency,
        );
        setRaw(String(nativeAmount / 100));
      }
    }
  }, [actual, viewPeriod]);

  const parsedCents = parseAUDInput(raw);
  const normalisedPreview =
    parsedCents && parsedCents > 0
      ? normaliseToPeriod(Math.abs(parsedCents) as Cents, frequency, viewPeriod as BudgetFrequency)
      : null;

  const showPreview = frequency !== viewPeriod && normalisedPreview != null;

  function handleSave() {
    if (!actual || !parsedCents || parsedCents <= 0) return;
    onSave(actual.categoryId, Math.abs(parsedCents), frequency, actual.rollover);
    onClose();
  }

  return (
    <Dialog open={!!actual} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Edit target — {actual?.categoryName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as BudgetFrequency)}>
              <SelectTrigger>
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

          <div className="flex flex-col gap-1.5">
            <Label>Amount per {FREQUENCY_LABEL[frequency].toLowerCase()}</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={raw}
              autoFocus
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {showPreview && normalisedPreview && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                In {FREQUENCY_LABEL[viewPeriod].toLowerCase()} view:{" "}
              </span>
              <Money value={normalisedPreview} className="font-semibold" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!parsedCents || parsedCents <= 0}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
