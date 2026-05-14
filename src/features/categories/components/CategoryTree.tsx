"use client";

import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Category, CategoryType } from "../types";

interface Props {
  type: CategoryType;
  tree: { root: Category; subcategories: Category[] }[];
  onAdd: (parentId?: string, type?: CategoryType) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryTree({ type, tree, onAdd, onEdit, onDelete }: Props) {
  const TYPE_LABELS: Record<CategoryType, string> = {
    income: "Income",
    expense: "Expense",
    transfer: "Transfer",
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          {TYPE_LABELS[type]}
          <span className="ml-1.5 opacity-60">{tree.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAdd(undefined, type)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {tree.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tree.map(({ root, subcategories }) => (
            <CategoryNode
              key={root.id}
              category={root}
              subcategories={subcategories}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryNode({
  category,
  subcategories,
  onAdd,
  onEdit,
  onDelete,
}: {
  category: Category;
  subcategories: Category[];
  onAdd: (parentId?: string, type?: CategoryType) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSubs = subcategories.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="group flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 hover:border-border/50 hover:bg-surface/60">
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => hasSubs && setExpanded(!expanded)}
          className={cn(
            "flex h-5 w-5 items-center justify-center text-muted-foreground",
            !hasSubs && "pointer-events-none opacity-0",
          )}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <span
          className="mr-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: category.color }}
        />
        <span className="flex-1 truncate text-sm">{category.name}</span>

        <span className={cn("hidden items-center gap-0.5 group-hover:flex", menuOpen && "flex")}>
          <button
            type="button"
            onClick={() => onAdd(category.id, category.type)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add subcategory"
          >
            <Plus className="h-3 w-3" />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Category actions"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(category)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {expanded && subcategories.length > 0 && (
        <div className="ml-7 flex flex-col gap-0.5 border-l border-border/40 pl-3">
          {subcategories.map((child) => (
            <ChildNode
              key={child.id}
              child={child}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildNode({
  child,
  onEdit,
  onDelete,
}: {
  child: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="group flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 hover:border-border/50 hover:bg-surface/60">
      <span
        className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: child.color }}
      />
      <span className="flex-1 truncate text-sm">{child.name}</span>
      <span className={cn("hidden items-center group-hover:flex", menuOpen && "flex")}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit(child)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(child)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
