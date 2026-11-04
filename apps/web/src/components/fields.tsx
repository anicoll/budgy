"use client";

import { useEffect, useId, useState } from "react";
import { parseMoney } from "@/lib/state";

const inputClass =
  "num w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

const fmt = (n: number | undefined) =>
  n === undefined ? "" : n.toLocaleString("en-AU", { maximumFractionDigits: 2 });

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
}

function Field({
  label,
  hint,
  className,
  id,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Dollar input that accepts "600k", "$600,000" or "1.2m". Commits on blur or
 * Enter. Empty is allowed when `optional`, and commits undefined.
 */
export function MoneyField({
  value,
  onChange,
  optional,
  placeholder,
  ...field
}: FieldProps & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  optional?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState(fmt(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(fmt(value)), [value]);

  const commit = () => {
    if (text.trim() === "" && optional) {
      setBad(false);
      onChange(undefined);
      return;
    }
    const n = parseMoney(text);
    if (n === null) {
      setBad(true);
      return;
    }
    setBad(false);
    onChange(n);
    setText(fmt(n));
  };

  return (
    <Field {...field} id={id}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={`${inputClass} pl-7 ${bad ? "border-warn" : ""}`}
          value={text}
          placeholder={placeholder}
          aria-invalid={bad}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </div>
      {bad && <p className="mt-1 text-xs text-warn">Enter an amount, like 600k or 600,000.</p>}
    </Field>
  );
}

export function NumberField({
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  optional,
  placeholder,
  ...field
}: FieldProps & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  optional?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    if (text.trim() === "" && optional) return onChange(undefined);
    const n = Number(text);
    if (!Number.isFinite(n)) return setText(value === undefined ? "" : String(value));
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <Field {...field} id={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={`${inputClass} ${suffix ? "pr-10" : ""}`}
          value={text}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

export function DateField({
  value,
  onChange,
  ...field
}: FieldProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Field {...field} id={id}>
      <input
        id={id}
        type="date"
        className={inputClass}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  ...field
}: FieldProps & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <Field {...field} id={id}>
      <select
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
