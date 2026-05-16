"use client";

import { useRef } from "react";
import type { Cents } from "@/lib/money/cents";

function centsToDisplay(c: Cents): string {
  return String(Math.round(c / 100));
}

function displayToCents(s: string): Cents {
  const n = Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  return (Number.isFinite(n) ? Math.max(0, n) : 0) as Cents;
}

interface MoneyInputProps {
  label: string;
  value: Cents;
  onChange: (v: Cents) => void;
  hint?: string;
  className?: string;
}

export function MoneyInput({ label, value, onChange, hint, className }: MoneyInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-ring">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          ref={localRef}
          type="text"
          inputMode="numeric"
          key={value}
          defaultValue={centsToDisplay(value)}
          onBlur={() => onChange(displayToCents(localRef.current?.value ?? ""))}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
