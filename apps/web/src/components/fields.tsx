"use client";

import { useEffect, useId, useRef, useState } from "react";
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
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The hint, and the note under the field only while it shows, for aria-describedby. */
const describedBy = (id: string, hint: string | undefined, note: boolean) =>
  [hint && `${id}-hint`, note && `${id}-note`].filter(Boolean).join(" ") || undefined;

let liveRegion: HTMLElement | null = null;
/**
 * Say a field's note once, through one polite live region for the page. A
 * note that appears in its own live region isn't read reliably, and the short
 * wait keeps it from talking over the next field's label.
 */
function announce(text: string) {
  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.className = "sr-only";
    document.body.append(liveRegion);
  }
  const region = liveRegion;
  region.textContent = "";
  setTimeout(() => {
    region.textContent = text;
  }, 150);
}

const MONEY_ERROR = "That isn't an amount. Enter one like 600k or 600,000.";

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
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(fmt(value));
  const [bad, setBad] = useState(false);
  const [capped, setCapped] = useState<string | null>(null);
  useEffect(() => setText(fmt(value)), [value]);

  // The browser's validity follows ours, so :user-invalid styles the field
  // once someone has left it, and never while they're still typing.
  const setError = (on: boolean) => {
    input.current?.setCustomValidity(on ? MONEY_ERROR : "");
    if (on && !bad) announce(MONEY_ERROR);
    setBad(on);
  };

  const commit = () => {
    if (text.trim() === "" && optional) {
      setError(false);
      setCapped(null);
      onChange(undefined);
      return;
    }
    const parsed = parseMoney(text);
    if (parsed === null) {
      setError(true);
      return;
    }
    setError(false);
    const { value: n, hint } = clampWithHint(
      parsed,
      min ?? Number.NEGATIVE_INFINITY,
      max ?? Number.POSITIVE_INFINITY,
      undefined,
      (x) => `$${fmt(x)}`,
    );
    setCapped(hint);
    if (hint && hint !== capped) announce(hint);
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
          ref={input}
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={`${inputClass} pl-8 user-invalid:border-warn aria-invalid:border-warn`}
          value={text}
          placeholder={placeholder}
          aria-invalid={bad}
          aria-describedby={describedBy(id, field.hint, bad || !!capped)}
          onChange={(e) => {
            setText(e.target.value);
            // Fixing it clears the error straight away; a new one waits for blur.
            if (bad && parseMoney(e.target.value) !== null) setError(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </div>
      {bad && (
        <p id={`${id}-note`} className="mt-1 text-xs text-warn">
          {MONEY_ERROR}
        </p>
      )}
      {!bad && capped && (
        <p id={`${id}-note`} className="mt-1 text-xs text-warn">
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
    if (hint && hint !== capped) announce(hint);
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
          aria-describedby={describedBy(id, field.hint, !!capped)}
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
        <p id={`${id}-note`} className="mt-1 text-xs text-warn">
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
