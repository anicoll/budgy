"use client";

import { useState } from "react";
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
import { useCategories } from "@/features/categories/hooks";
import { parseAUDInput } from "@/lib/money/format";
import type { Budget } from "../types";

interface Props {
  open: boolean;
  budget: Budget;
  onClose: () => void;
  onAdd: (categoryId: string, amountCents: number) => void;
}

export function AddAllocationDialog({ open, budget, onClose, onAdd }: Props) {
  const { data: categories = [] } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [raw, setRaw] = useState("");

  const allocatedIds = new Set(budget.categoryAllocations.map((a) => a.categoryId));
  const available = categories.filter((c) => !allocatedIds.has(c.id) && c.type !== "transfer");

  function handleAdd() {
    if (!categoryId) return;
    const parsed = parseAUDInput(raw);
    if (parsed == null || parsed <= 0) return;
    onAdd(categoryId, Math.abs(parsed));
    setCategoryId("");
    setRaw("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Add allocation</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    All categories allocated
                  </SelectItem>
                ) : (
                  available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!categoryId || !raw}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
