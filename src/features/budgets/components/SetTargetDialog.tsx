"use client";

import { useEffect, useState } from "react";
import { Money } from "@/components/money/money";
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
import { parseAUDInput } from "@/lib/money/format";
import type { BudgetFrequency, BudgetPeriod } from "../types";
import { FREQUENCY_LABEL, normaliseToPeriod } from "../utils/normalise";

interface Props {
  open: boolean;
  categoryName: string;
  defaultFrequency: BudgetFrequency;
  viewPeriod: BudgetPeriod;
  initialAmount?: number;
  onClose: () => void;
  onSave: (amount: number, frequency: BudgetFrequency, rollover: boolean) => void;
}

export function SetTargetDialog({
  open,
  categoryName,
  defaultFrequency,
  viewPeriod,
  initialAmount,
  onClose,
  onSave,
}: Props) {
  const [raw, setRaw] = useState("");
  const [frequency, setFrequency] = useState<BudgetFrequency>(defaultFrequency);

  useEffect(() => {
    if (open) {
      setFrequency(defaultFrequency);
      setRaw(initialAmount ? String(initialAmount / 100) : "");
    }
  }, [open, defaultFrequency, initialAmount]);

  const parsedCents = parseAUDInput(raw);
  const normalisedPreview =
    parsedCents && parsedCents > 0
      ? normaliseToPeriod(Math.abs(parsedCents) as Cents, frequency, viewPeriod)
      : null;

  const showPreview = frequency !== viewPeriod && normalisedPreview != null;

  function handleSave() {
    if (!parsedCents || parsedCents <= 0) return;
    onSave(Math.abs(parsedCents), frequency, false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Set target — {categoryName}</DialogTitle>
          <DialogDescription>
            Choose a natural frequency for this target. The budget will normalise it to your viewing
            period automatically.
          </DialogDescription>
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
                In your {FREQUENCY_LABEL[viewPeriod].toLowerCase()} view:{" "}
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
            Set target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
