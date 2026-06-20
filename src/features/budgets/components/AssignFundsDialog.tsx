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
import { toCents } from "@/lib/money/cents";
import type { BackendCategory } from "../api/types";

interface Props {
  open: boolean;
  category: BackendCategory | null;
  onClose: () => void;
  onSubmit: (amountCents: number) => Promise<void>;
  submitting?: boolean;
}

export function AssignFundsDialog({ open, category, onClose, onSubmit, submitting }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setError(null);
    }
  }, [open, category?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setError(null);
    await onSubmit(toCents(parsed));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign funds</DialogTitle>
            <DialogDescription>
              Move money from Ready to Assign into {category?.name ?? "this category"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="assign-amount">Amount (AUD)</Label>
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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
