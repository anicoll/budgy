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
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Cents } from "@/lib/money/cents";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABEL, type Account, isLiability } from "../types";

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onArchiveToggle: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountCard({ account, onEdit, onArchiveToggle, onDelete }: AccountCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const balance = account.currentBalance as Cents;
  const liability = isLiability(account.type);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface/70 p-5 shadow-card backdrop-blur-md transition-shadow",
        isDragging && "shadow-xl ring-1 ring-primary/30 z-10",
        account.archived && "opacity-60",
        menuOpen && "z-10",
      )}
    >
      {/* Action buttons — absolutely anchored to top-right of card */}
      <div
        className={cn(
          "absolute right-3 top-3 flex items-center gap-0.5 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
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
            <DropdownMenuItem onClick={() => onEdit(account)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchiveToggle(account)}>
              {account.archived ? (
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
              onClick={() => onDelete(account)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3 pr-14">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white shadow-sm"
          style={{ background: account.color }}
        >
          {account.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium leading-5">{account.name}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {ACCOUNT_TYPE_LABEL[account.type]}
            {account.institution ? ` · ${account.institution}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {liability ? "Balance owing" : "Balance"}
        </div>
        <Money
          value={balance}
          className={cn(
            "text-2xl font-semibold tracking-tight",
            liability ? "text-expense" : "text-foreground",
          )}
        />
      </div>
    </div>
  );
}
