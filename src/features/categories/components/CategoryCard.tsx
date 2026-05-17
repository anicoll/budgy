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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Category } from "../types";
import { QuickAddSubcategory } from "./QuickAddSubcategory";
import { SubcategoryRow } from "./SubcategoryRow";

interface Props {
  root: Category;
  subcategories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onArchiveToggle: (c: Category) => void;
  onReorderSubcategories: (parentId: string, ids: string[]) => void;
}

export function CategoryCard({
  root,
  subcategories,
  onEdit,
  onDelete,
  onArchiveToggle,
  onReorderSubcategories,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: root.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const subSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const subIds = useMemo(() => subcategories.map((s) => s.id), [subcategories]);

  function handleSubDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subIds.indexOf(String(active.id));
    const newIndex = subIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderSubcategories(root.id, arrayMove(subIds, oldIndex, newIndex));
  }

  const subCount = subcategories.length;
  const subLabel =
    subCount === 0 ? "No subcategories" : `${subCount} subcategor${subCount === 1 ? "y" : "ies"}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/70 p-5 shadow-card backdrop-blur-md transition-shadow",
        isDragging && "shadow-xl ring-1 ring-primary/30 z-10",
        menuOpen && "z-10",
        root.archived && "opacity-60",
      )}
    >
      {/* Action buttons — top-right corner */}
      <div
        className={cn(
          "absolute right-3 top-3 flex items-center gap-0.5 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Actions">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(root)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {!root.system && (
              <>
                <DropdownMenuItem onClick={() => onArchiveToggle(root)}>
                  {root.archived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(root)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header: avatar + name + sub count */}
      <div className="flex items-center gap-3 pr-14">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white shadow-sm"
          style={{ background: root.color }}
        >
          {root.icon || root.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium leading-5">{root.name}</span>
            {root.system && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                System
              </Badge>
            )}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {subLabel}
          </div>
        </div>
      </div>

      {/* Subcategory list */}
      {subcategories.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-border/30 pt-2">
          <DndContext
            sensors={subSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSubDragEnd}
          >
            <SortableContext items={subIds} strategy={verticalListSortingStrategy}>
              {subcategories.map((sub) => (
                <SubcategoryRow
                  key={sub.id}
                  category={sub}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onArchiveToggle={onArchiveToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Inline add */}
      <div className={cn(subcategories.length > 0 ? "" : "border-t border-border/30 pt-2")}>
        <QuickAddSubcategory parentId={root.id} type={root.type} parentColor={root.color} />
      </div>
    </div>
  );
}
