"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeftRight, GripVertical } from "lucide-react";
import { useState } from "react";
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
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import { useCoverOverspending } from "../hooks";
import type { EnvelopeState } from "../types";
import { EnvelopeCard } from "./EnvelopeCard";

interface FundDragLayerProps {
  /** Envelopes rendered in this section's grid. */
  envelopes: EnvelopeState[];
  /** All envelopes across sections — used to populate the cover picker. */
  allEnvelopes: EnvelopeState[];
  budgetId: string;
  onOpen: (state: EnvelopeState) => void;
}

interface PendingCover {
  from: EnvelopeState;
  to: EnvelopeState;
}

export function FundDragLayer({ envelopes, allEnvelopes, budgetId, onOpen }: FundDragLayerProps) {
  const coverMutation = useCoverOverspending();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null);
  const [pickerFor, setPickerFor] = useState<EnvelopeState | null>(null);
  const [coverAmountStr, setCoverAmountStr] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const fromId = String(active.id);
    const toId = String(over.id).replace(/^drop-/, "");
    if (fromId === toId) return;
    const from = allEnvelopes.find((e) => e.categoryId === fromId);
    const to = allEnvelopes.find((e) => e.categoryId === toId);
    if (!from || !to || to.status !== "overspent") return;
    openAmountDialog(from, to);
  }

  function openAmountDialog(from: EnvelopeState, to: EnvelopeState) {
    const defaultCents = Math.max(0, Math.min(from.balance, Math.abs(to.balance)));
    setCoverAmountStr((defaultCents / 100).toFixed(2));
    setPendingCover({ from, to });
  }

  function handleCoverConfirm() {
    if (!pendingCover) return;
    const amount = Math.round(parseFloat(coverAmountStr || "0") * 100);
    if (!amount || amount <= 0) return;
    coverMutation.mutate(
      {
        budgetId,
        fromCategoryId: pendingCover.from.categoryId,
        toCategoryId: pendingCover.to.categoryId,
        amount: amount as Cents,
        dateISO: new Date().toISOString().slice(0, 10),
        fromCategoryName: pendingCover.from.categoryName,
        toCategoryName: pendingCover.to.categoryName,
      },
      { onSuccess: () => setPendingCover(null) },
    );
  }

  const healthySources = allEnvelopes.filter((e) => e.balance > 0);

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 sm:grid-cols-2">
          {envelopes.map((env) => (
            <DraggableCard
              key={env.categoryId}
              state={env}
              onOpen={onOpen}
              onCoverClick={() => setPickerFor(env)}
              activeId={activeId}
            />
          ))}
        </div>
      </DndContext>

      {/* Picker — choose a source envelope to cover an overspent one */}
      <Dialog
        open={pickerFor !== null && pendingCover === null}
        onOpenChange={(open) => !open && setPickerFor(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cover overspending in {pickerFor?.categoryName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Select an envelope to pull funds from:</p>
          <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
            {healthySources
              .filter((e) => e.categoryId !== pickerFor?.categoryId)
              .map((src) => (
                <li key={src.categoryId}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pickerFor) return;
                      setPickerFor(null);
                      openAmountDialog(src, pickerFor);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/30"
                      style={{ background: src.categoryColor }}
                    />
                    <span className="flex-1 truncate">{src.categoryName}</span>
                    <Money
                      value={src.balance}
                      className="text-xs tabular-nums text-muted-foreground"
                    />
                  </button>
                </li>
              ))}
            {healthySources.filter((e) => e.categoryId !== pickerFor?.categoryId).length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No envelopes with available balance.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Amount confirmation dialog */}
      <Dialog open={pendingCover !== null} onOpenChange={(open) => !open && setPendingCover(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move funds</DialogTitle>
          </DialogHeader>
          {pendingCover && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Move how much from{" "}
                <span className="font-medium text-foreground">
                  {pendingCover.from.categoryName}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">{pendingCover.to.categoryName}</span>?
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={coverAmountStr}
                  onChange={(e) => setCoverAmountStr(e.target.value)}
                  className="flex-1"
                  placeholder="0.00"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCoverConfirm();
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Available:{" "}
                <Money value={pendingCover.from.balance} className="text-foreground/80" />
                {" · "}
                Overspent:{" "}
                <Money
                  value={Math.abs(pendingCover.to.balance) as Cents}
                  className="text-rose-400"
                />
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCover(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCoverConfirm}
              disabled={
                coverMutation.isPending || !coverAmountStr || parseFloat(coverAmountStr) <= 0
              }
            >
              {coverMutation.isPending ? "Moving…" : "Move funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Per-card draggable + droppable wrapper ────────────────────────────────────

interface DraggableCardProps {
  state: EnvelopeState;
  onOpen: (s: EnvelopeState) => void;
  onCoverClick: () => void;
  activeId: string | null;
}

function DraggableCard({ state, onOpen, onCoverClick, activeId }: DraggableCardProps) {
  const isDropTarget = state.status === "overspent";
  const canDrag = state.balance > 0;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: state.categoryId,
    disabled: !canDrag,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${state.categoryId}`,
    disabled: !isDropTarget,
  });

  // Highlight valid drop targets while a drag is in progress
  const isDragActive = activeId !== null;
  const isValidDrop = isDropTarget && isDragActive && activeId !== state.categoryId;

  return (
    <div
      ref={setDropRef}
      className={cn(
        "group/card relative flex flex-col",
        isDragging && "opacity-40",
        isOver && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background rounded-2xl",
        isValidDrop && !isOver && "ring-1 ring-violet-500/40 rounded-2xl",
      )}
    >
      <EnvelopeCard state={state} onOpen={onOpen} />

      {/* Grip handle — visible on group hover for draggable cards */}
      {canDrag && (
        <button
          ref={setDragRef}
          type="button"
          {...listeners}
          {...attributes}
          className={cn(
            "absolute right-2 top-2.5 z-20 rounded-full p-0.5 touch-none select-none",
            "cursor-grab active:cursor-grabbing",
            "opacity-0 transition-opacity",
            "group-hover/card:opacity-50 hover:!opacity-100 focus-visible:!opacity-100",
          )}
          aria-label={`Drag ${state.categoryName} to cover an overspent envelope`}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Cover button — shown below overspent cards as a text affordance */}
      {isDropTarget && (
        <button
          type="button"
          onClick={onCoverClick}
          className="mt-1 flex items-center justify-end gap-1 px-2 text-[10px] font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          <ArrowLeftRight className="h-3 w-3" />
          Cover overspending
        </button>
      )}
    </div>
  );
}
