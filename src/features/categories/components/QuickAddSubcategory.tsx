"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useCreateCategory } from "../hooks";
import { CATEGORY_DEFAULT_COLORS, type CategoryType } from "../types";

interface Props {
  parentId: string;
  type: CategoryType;
  parentColor: string;
}

export function QuickAddSubcategory({ parentId, type, parentColor }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(parentColor);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const createMutation = useCreateCategory();

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function reset() {
    setAdding(false);
    setName("");
    setColor(parentColor);
  }

  async function commit() {
    if (committingRef.current) return;
    committingRef.current = true;
    const trimmed = name.trim();
    if (!trimmed) {
      committingRef.current = false;
      reset();
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: trimmed,
        type,
        parentId,
        color,
        icon: "",
        archived: false,
      });
      reset();
    } catch {
      // toast handled by hook; keep composer open so the user can retry
    } finally {
      committingRef.current = false;
    }
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add subcategory
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-surface/40 px-2 py-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") reset();
          }}
          onBlur={() => {
            // Defer to allow color picker clicks to register first
            setTimeout(() => {
              if (document.activeElement?.tagName !== "BUTTON") commit();
            }, 100);
          }}
          placeholder="Subcategory name…"
          disabled={createMutation.isPending}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 pl-4">
        {CATEGORY_DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={(e) => {
              e.preventDefault();
              setColor(c);
              inputRef.current?.focus();
            }}
            className={cn(
              "h-4 w-4 rounded-full ring-2 ring-transparent transition",
              color === c && "ring-foreground ring-offset-2 ring-offset-surface",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
