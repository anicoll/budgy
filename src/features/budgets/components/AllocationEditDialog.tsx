"use client";

import { useEffect, useState } from "react";
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
import { parseAUDInput } from "@/lib/money/format";
import type { AllocationActual } from "../types";

interface Props {
  actual: AllocationActual | null;
  onClose: () => void;
  onSave: (categoryId: string, amountCents: number, rollover: boolean) => void;
}

export function AllocationEditDialog({ actual, onClose, onSave }: Props) {
  const [raw, setRaw] = useState("");

  useEffect(() => {
    if (actual) {
      setRaw(String(actual.allocated / 100));
    }
  }, [actual]);

  function handleSave() {
    if (!actual) return;
    const parsed = parseAUDInput(raw);
    if (parsed == null || parsed <= 0) return;
    onSave(actual.categoryId, Math.abs(parsed), actual.rollover);
    onClose();
  }

  return (
    <Dialog open={!!actual} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Edit allocation — {actual?.categoryName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alloc-amount">Budget amount</Label>
            <Input
              id="alloc-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={raw}
              autoFocus
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
