"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical, MoveRight } from "lucide-react";
import { useRef, useState } from "react";
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
import { type Cents, fromCents, toCents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import type { EnvelopeState } from "../types";
import { EnvelopeCard } from "./EnvelopeCard";

interface PendingCover {
  from: EnvelopeState;
  to: EnvelopeState;
}

interface Props {
  envelopes: EnvelopeState[];
  onOpen: (state: EnvelopeState) => void;
  budgetId: string;
  dateISO: string;
  onCoverOverspending: (input: {
    budgetId: string;
    fromCategoryId: string;
    toCategoryId: string;
    amount: Cents;
    dateISO: string;
    fromName: string;
    toName: string;
  }) => void;
  isPending?: boolean;
}

export function FundDragLayer({
  envelopes,
  onOpen,
  budgetId,
  dateISO,
  onCoverOverspending,
  isPending,
}: Props) {
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null);
  const [amountStr, setAmountStr] = useState("");
  // Track which card is being dragged so targets can highlight.
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: { active: { id: string | number } }) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const fromId = String(active.id).replace("drag-", "");
    const toId = String(over.id).replace("drop-", "");
    if (fromId === toId) return;

    const fromState = envelopes.find((e) => e.categoryId === fromId);
    const toState = envelopes.find((e) => e.categoryId === toId);
    if (!fromState || !toState) return;
    if (toState.status !== "overspent") return;

    const defaultAmount = Math.min(Math.max(0, fromState.balance), Math.abs(toState.balance));
    setAmountStr(defaultAmount > 0 ? String(fromCents(defaultAmount as Cents)) : "");
    setPendingCover({ from: fromState, to: toState });
  }

  function handleCoverButton(to: EnvelopeState, from: EnvelopeState) {
    const defaultAmount = Math.min(Math.max(0, from.balance), Math.abs(to.balance));
    setAmountStr(defaultAmount > 0 ? String(fromCents(defaultAmount as Cents)) : "");
    setPendingCover({ from, to });
  }

  function handleConfirm() {
    if (!pendingCover) return;
    const dollars = Number.parseFloat(amountStr);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    const amount = toCents(dollars);
    onCoverOverspending({
      budgetId,
      fromCategoryId: pendingCover.from.categoryId,
      toCategoryId: pendingCover.to.categoryId,
      amount,
      dateISO,
      fromName: pendingCover.from.categoryName,
      toName: pendingCover.to.categoryName,
    });
    setPendingCover(null);
    setAmountStr("");
  }

  const healthyEnvelopes = envelopes.filter((e) => e.balance > 0);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {envelopes.map((state) => (
            <DroppableCard
              key={state.categoryId}
              state={state}
              onOpen={onOpen}
              isDragSource={draggingId === `drag-${state.categoryId}`}
              isValidDropTarget={
                state.status === "overspent" &&
                draggingId !== null &&
                draggingId !== `drag-${state.categoryId}`
              }
              healthyEnvelopes={healthyEnvelopes}
              onCoverButton={handleCoverButton}
            />
          ))}
        </div>
      </DndContext>

      <CoverAmountDialog
        pending={pendingCover}
        amountStr={amountStr}
        onAmountChange={setAmountStr}
        onConfirm={handleConfirm}
        onClose={() => {
          setPendingCover(null);
          setAmountStr("");
        }}
        isPending={isPending}
      />
    </>
  );
}

// ── Droppable + draggable card wrapper ────────────────────────────────────────

function DroppableCard({
  state,
  onOpen,
  isDragSource,
  isValidDropTarget,
  healthyEnvelopes,
  onCoverButton,
}: {
  state: EnvelopeState;
  onOpen: (s: EnvelopeState) => void;
  isDragSource: boolean;
  isValidDropTarget: boolean;
  healthyEnvelopes: EnvelopeState[];
  onCoverButton: (to: EnvelopeState, from: EnvelopeState) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${state.categoryId}`,
    disabled: state.status !== "overspent",
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${state.categoryId}`,
  });

  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  return (
    <div
      ref={setDropRef}
      className={cn(
        "relative rounded-2xl transition-all",
        isValidDropTarget && "ring-2 ring-violet-500/70 ring-offset-1 ring-offset-background",
        isOver && "ring-violet-400 scale-[1.02]",
        isDragSource && "opacity-40",
      )}
    >
      {/* Drag handle — hidden until hover, positioned top-right */}
      <button
        ref={setDragRef}
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "absolute right-9 top-3 z-10 cursor-grab rounded p-0.5 opacity-0 transition-opacity",
          "hover:opacity-100 focus-visible:opacity-100",
          "group-hover:opacity-60",
          isDragging && "cursor-grabbing",
        )}
        aria-label={`Drag ${state.categoryName} to cover another envelope`}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
      </button>

      <EnvelopeCard state={state} onOpen={onOpen} />

      {/* Cover button — only on overspent envelopes */}
      {state.status === "overspent" && healthyEnvelopes.length > 0 && (
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 w-full border-rose-500/30 text-xs text-rose-300 hover:border-rose-400/60 hover:text-rose-200"
            onClick={() => setCoverPickerOpen((v) => !v)}
          >
            <MoveRight className="mr-1.5 h-3 w-3" />
            Cover overspending
          </Button>

          {coverPickerOpen && (
            <HealthyEnvelopePicker
              options={healthyEnvelopes}
              onPick={(from) => {
                setCoverPickerOpen(false);
                onCoverButton(state, from);
              }}
              onClose={() => setCoverPickerOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Healthy envelope picker dropdown ─────────────────────────────────────────

function HealthyEnvelopePicker({
  options,
  onPick,
  onClose,
}: {
  options: EnvelopeState[];
  onPick: (from: EnvelopeState) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close picker"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border/60 bg-surface-elevated shadow-lg backdrop-blur-xl">
        <p className="px-3 py-2 text-[11px] text-muted-foreground">Move funds from:</p>
        {options.map((env) => (
          <button
            key={env.categoryId}
            type="button"
            onClick={() => onPick(env)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: env.categoryColor }}
                aria-hidden
              />
              <span className="truncate">{env.categoryName}</span>
            </span>
            <Money value={env.balance as Cents} className="shrink-0 text-xs text-emerald-400" />
          </button>
        ))}
      </div>
    </>
  );
}

// ── Amount dialog ─────────────────────────────────────────────────────────────

function CoverAmountDialog({
  pending,
  amountStr,
  onAmountChange,
  onConfirm,
  onClose,
  isPending,
}: {
  pending: PendingCover | null;
  amountStr: string;
  onAmountChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dollars = Number.parseFloat(amountStr);
  const isValid = Number.isFinite(dollars) && dollars > 0;

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs" onOpenAutoFocus={() => inputRef.current?.select()}>
        <DialogHeader>
          <DialogTitle>Move how much?</DialogTitle>
        </DialogHeader>

        {pending && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              From <span className="font-medium text-foreground">{pending.from.categoryName}</span>
              {" → "}
              <span className="font-medium text-foreground">{pending.to.categoryName}</span>
            </p>

            <div className="flex flex-col gap-1.5">
              <Input
                ref={inputRef}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => onAmountChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && isValid && onConfirm()}
                className="text-right"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Available:{" "}
                  <Money
                    value={Math.max(0, pending.from.balance) as Cents}
                    className="text-foreground/80"
                  />
                </span>
                <span>
                  Needed:{" "}
                  <Money
                    value={Math.abs(Math.min(0, pending.to.balance)) as Cents}
                    className="text-foreground/80"
                  />
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!isValid || isPending}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            Move funds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
