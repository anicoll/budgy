"use client";

import { useRef, useState } from "react";

function pctToDisplay(v: number): string {
  return (v * 100).toFixed(2);
}

interface SliderWithTextProps {
  label: string;
  value: number; // fraction (e.g. 0.05 for 5%)
  min: number; // percent (e.g. 0)
  max: number; // percent (e.g. 100)
  step: number; // percent (e.g. 0.05)
  onChange: (v: number) => void; // fraction
}

export function SliderWithText({ label, value, min, max, step, onChange }: SliderWithTextProps) {
  const [text, setText] = useState(pctToDisplay(value));
  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    setText(pctToDisplay(value));
  }

  function commitText(raw: string) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= min && n <= max) {
      onChange(Math.round(n * 1000) / 100000);
    } else {
      setText(pctToDisplay(value));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitText(text)}
            className="w-14 rounded border border-border/60 bg-surface px-1.5 py-0.5 text-right text-xs tabular-nums focus:border-ring focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value * 100))}
        onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
        className="super-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border"
      />
    </div>
  );
}
