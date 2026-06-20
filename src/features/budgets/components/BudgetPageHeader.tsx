"use client";

import { ChevronDown, Plus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BackendBudget } from "../api/types";

const METHOD_LABEL = {
  zero_sum: "Zero-sum",
  envelope: "Envelope",
} as const;

interface Props {
  budgets: BackendBudget[];
  selected: BackendBudget;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BudgetPageHeader({
  budgets,
  selected,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const showSwitcher = budgets.length > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {showSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto max-w-full px-2 py-1.5 text-lg font-semibold"
              >
                <span className="truncate">{selected.name}</span>
                <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Budgets</DropdownMenuLabel>
              {budgets.map((b) => (
                <DropdownMenuItem key={b.id} onClick={() => onSelect(b.id)}>
                  <span className={b.id === selected.id ? "font-medium" : undefined}>{b.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h2 className="truncate text-lg font-semibold">{selected.name}</h2>
        )}

        <Badge variant="secondary" className="shrink-0">
          {METHOD_LABEL[selected.method]}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Budget options">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onEdit}>Edit budget</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              Delete budget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        onClick={onCreate}
        className="bg-gradient-accent text-primary-foreground hover:opacity-90"
        size="sm"
      >
        <Plus className="mr-1 h-4 w-4" />
        New budget
      </Button>
    </div>
  );
}
