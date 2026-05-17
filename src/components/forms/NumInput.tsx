"use client";

import { useRef } from "react";
import { FieldHint } from "@/components/ui/field-hint";

interface NumInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  tooltip?: string;
  onChange: (v: number) => void;
}

export function NumInput({ label, value, min, max, suffix, tooltip, onChange }: NumInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const n = parseInt(inputRef.current?.value ?? "", 10);
    if (Number.isFinite(n) && n >= min && n <= max) {
      onChange(n);
    } else if (inputRef.current) {
      // Revert display to last valid value
      inputRef.current.value = String(value);
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tooltip && <FieldHint text={tooltip} />}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-ring">
        <input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          key={value}
          defaultValue={value}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
