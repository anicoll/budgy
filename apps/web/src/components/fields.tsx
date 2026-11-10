"use client";

import { useEffect, useId, useState } from "react";
import { clampWithHint } from "@/lib/clampHint";
import { parseMoney } from "@/lib/state";
import { DatePicker, filledField, Select } from "./ui";

const inputClass = filledField;

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
  min,
  max,
  ...field
}: FieldProps & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  optional?: boolean;
  placeholder?: string;
  /** Optional limits in dollars. A typed amount outside them is moved in, with a note. */
  min?: number;
  max?: number;
}) {
  const id = useId();
  const [text, setText] = useState(fmt(value));
  const [bad, setBad] = useState(false);
  const [capped, setCapped] = useState<string | null>(null);
  useEffect(() => setText(fmt(value)), [value]);

  const commit = () => {
    if (text.trim() === "" && optional) {
      setBad(false);
      setCapped(null);
      onChange(undefined);
      return;
    }
    const parsed = parseMoney(text);
    if (parsed === null) {
      setBad(true);
      return;
    }
    setBad(false);
    const { value: n, hint } = clampWithHint(
      parsed,
      min ?? Number.NEGATIVE_INFINITY,
      max ?? Number.POSITIVE_INFINITY,
      undefined,
      (x) => `$${fmt(x)}`,
    );
    setCapped(hint);
    onChange(n);
    setText(fmt(n));
  };

  return (
    <Field {...field} id={id}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={`${inputClass} pl-8 ${bad ? "border-warn" : ""}`}
          value={text}
          placeholder={placeholder}
          aria-invalid={bad}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </div>
      {bad && <p className="mt-1 text-xs text-warn">Enter an amount, like 600k or 600,000.</p>}
      {!bad && capped && (
        <p className="mt-1 text-xs text-warn" role="status">
          {capped}
        </p>
      )}
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
  const [capped, setCapped] = useState<string | null>(null);
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    if (text.trim() === "") {
      if (optional) {
        setCapped(null);
        return onChange(undefined);
      }
      // A required field left blank keeps its last value, rather than
      // Number("") turning it into 0 and then the minimum.
      return setText(value === undefined ? "" : String(value));
    }
    const n = Number(text);
    if (!Number.isFinite(n)) return setText(value === undefined ? "" : String(value));
    const { value: clamped, hint } = clampWithHint(n, min, max, suffix);
    setCapped(hint);
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
          className={`${inputClass} ${suffix ? "pr-12" : ""}`}
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
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
      {capped && (
        <p className="mt-1 text-xs text-warn" role="status">
          {capped}
        </p>
      )}
    </Field>
  );
}

export function DateField({
  value,
  onChange,
  label,
  hint,
  className,
}: FieldProps & { value: string; onChange: (v: string) => void }) {
  return (
    <div className={className}>
      <DatePicker label={label} value={value} onChange={onChange} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  label,
  hint,
  className,
}: FieldProps & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className={className}>
      <Select label={label} value={value} onChange={onChange} options={options} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
