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
import { toCents } from "@/lib/money/cents";
import type { BackendAccount, BackendCategory } from "../api/types";

interface Props {
  open: boolean;
  category: BackendCategory | null;
  accounts: BackendAccount[];
  onClose: () => void;
  onSubmit: (accountId: string, amountCents: number) => Promise<void>;
  submitting?: boolean;
}

export function FundEnvelopeDialog({
  open,
  category,
  accounts,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAccountId(accounts[0]?.id ?? "");
      setAmount("");
      setError(null);
    }
  }, [open, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Select an account");
      return;
    }
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setError(null);
    await onSubmit(accountId, toCents(parsed));
  }

  return (
    <Dialog key={category?.id ?? "fund"} open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Fund envelope</DialogTitle>
            <DialogDescription>
              Move money from an account into {category?.name ?? "this envelope"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add an account to this budget before funding envelopes.
              </p>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>From account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fund-amount">Amount (AUD)</Label>
                  <Input
                    id="fund-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || accounts.length === 0}>
              {submitting ? "Funding…" : "Fund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
