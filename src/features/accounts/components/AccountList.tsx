"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMemo } from "react";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_ORDER, type Account, type AccountType } from "../types";
import { AccountCard } from "./AccountCard";

interface Props {
  accounts: Account[];
  onEdit: (a: Account) => void;
  onArchiveToggle: (a: Account) => void;
  onDelete: (a: Account) => void;
  onReorder: (ids: string[]) => void;
  onManageBudgets?: (a: Account) => void;
}

export function AccountList({
  accounts,
  onEdit,
  onArchiveToggle,
  onDelete,
  onReorder,
  onManageBudgets,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const grouped = useMemo(() => {
    const out = new Map<AccountType, Account[]>();
    for (const a of accounts) {
      const arr = out.get(a.type) ?? [];
      arr.push(a);
      out.set(a.type, arr);
    }
    return out;
  }, [accounts]);

  const sortedIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedIds.indexOf(String(active.id));
    const newIndex = sortedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedIds, oldIndex, newIndex);
    onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-8">
          {ACCOUNT_TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => {
            const items = grouped.get(type) ?? [];
            return (
              <section key={type} className="flex flex-col gap-3">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
                  {ACCOUNT_TYPE_LABEL[type]}
                  <span className="ml-2 text-muted-foreground/70">{items.length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      onEdit={onEdit}
                      onArchiveToggle={onArchiveToggle}
                      onDelete={onDelete}
                      onManageBudgets={onManageBudgets}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
