"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
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

interface Props {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onArchiveToggle: (c: Category) => void;
}

export function SubcategoryRow({ category, onEdit, onDelete, onArchiveToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/sub relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40",
        isDragging && "bg-muted/60 ring-1 ring-primary/30 z-10",
        category.archived && "opacity-60",
      )}
    >
      {/* Drag handle (hover-reveal) */}
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/sub:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
        style={{ background: category.color }}
      >
        {category.icon || category.name.charAt(0).toUpperCase()}
      </span>

      <span className="flex-1 truncate text-sm">{category.name}</span>

      {category.system && (
        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
          System
        </Badge>
      )}

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 text-muted-foreground transition-opacity",
              menuOpen ? "opacity-100" : "opacity-0 group-hover/sub:opacity-100",
            )}
            aria-label="Actions"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onEdit(category)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          {!category.system && (
            <>
              <DropdownMenuItem onClick={() => onArchiveToggle(category)}>
                {category.archived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(category)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
