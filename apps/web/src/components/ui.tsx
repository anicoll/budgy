"use client";

/**
 * Material 3 styled controls on React Aria Components. React Aria handles
 * behaviour, keyboard and screen reader support; the look is ours.
 */

import { type CalendarDate, parseDate } from "@internationalized/date";
import {
  Checkbox as AriaCheckbox,
  DatePicker as AriaDatePicker,
  Select as AriaSelect,
  Slider as AriaSlider,
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateSegment,
  Dialog,
  Group,
  Heading,
  I18nProvider,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";

/** The M3 filled text field look, shared with the plain inputs in fields.tsx. */
export const filledField =
  "num w-full rounded-t-[4px] border-0 border-b-2 border-outline bg-surface-container-high px-4 py-2.5 text-base outline-none transition hover:bg-surface-container focus:border-accent focus:bg-surface-container";

const focusRing = "outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent";

export function Checkbox({
  isSelected,
  onChange,
  className = "",
  children,
}: {
  isSelected: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AriaCheckbox
      isSelected={isSelected}
      onChange={onChange}
      className={`group flex cursor-pointer gap-3 ${className}`}
    >
      {({ isSelected: on, isFocusVisible }) => (
        <>
          <span
            aria-hidden
            className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[2px] border-2 transition ${
              on ? "border-accent bg-accent text-on-accent" : "border-muted bg-transparent"
            } ${isFocusVisible ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
          >
            {on && (
              <svg viewBox="0 0 18 18" className="size-3.5" fill="none" aria-hidden>
                <path
                  d="M3.5 9.5l3.5 3.5 7.5-8"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="min-w-0">{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}

/** M3 Expressive slider: a thick track with a slim vertical handle. */
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  className?: string;
}) {
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return (
    <AriaSlider
      aria-label={label}
      value={value}
      onChange={(v) => onChange(v as number)}
      minValue={min}
      maxValue={max}
      step={step}
      className={className}
    >
      <SliderTrack className="relative flex h-11 w-full items-center">
        <span className="absolute inset-x-0 h-4 rounded-full bg-primary-container" />
        <span className="absolute left-0 h-4 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        <SliderThumb
          className={`top-1/2 h-11 w-1 rounded-full bg-accent ring-4 ring-surface data-[dragging]:w-0.5 ${focusRing}`}
        />
      </SliderTrack>
    </AriaSlider>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * A dropdown with an M3 menu. `label` shows above it; pass `ariaLabel`
 * instead when the label lives elsewhere. `triggerClassName` restyles the
 * button, for example on the dark sticky bars.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  triggerClassName = filledField,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}) {
  return (
    <AriaSelect
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => k !== null && onChange(k as T)}
      className="min-w-0"
    >
      {label && <Label className="mb-1 block text-sm font-medium">{label}</Label>}
      <Button
        className={`flex cursor-pointer items-center justify-between gap-2 text-left ${triggerClassName} ${focusRing}`}
      >
        <SelectValue className="truncate" />
        <svg viewBox="0 0 20 20" className="size-5 shrink-0 opacity-70" aria-hidden>
          <path d="M5.5 7.5L10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Button>
      <Popover className="min-w-(--trigger-width) rounded-lg bg-surface-container py-2 text-text shadow-lg ring-1 ring-border">
        <ListBox className="max-h-80 overflow-auto outline-none">
          {options.map((o) => (
            <ListBoxItem
              key={o.value}
              id={o.value}
              textValue={o.label}
              className="flex min-h-12 cursor-pointer items-center px-4 text-base outline-none data-[focused]:bg-text/8 data-[selected]:bg-primary-container data-[selected]:text-on-primary-container"
            >
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

const toDate = (iso: string): CalendarDate | null => {
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
};

/** Date in Australian order (dd/mm/yyyy) with an M3 calendar. Value is ISO yyyy-mm-dd. */
export function DatePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <I18nProvider locale="en-AU">
      <AriaDatePicker
        value={toDate(value)}
        onChange={(d) => d && onChange(d.toString())}
        className="min-w-0"
      >
        <Label className="mb-1 block text-sm font-medium">{label}</Label>
        <Group
          className={`flex items-center gap-2 pr-1 ${filledField} py-1.5 focus-within:border-accent`}
        >
          <DateInput className="num flex flex-1">
            {(seg) => (
              <DateSegment
                segment={seg}
                className="rounded-[4px] px-0.5 outline-none data-[focused]:bg-accent data-[focused]:text-on-accent data-[placeholder]:text-muted data-[type=literal]:text-muted"
              />
            )}
          </DateInput>
          <Button
            aria-label="Open calendar"
            className={`flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-text/8 ${focusRing}`}
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <rect
                x="3"
                y="4.5"
                width="14"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </Button>
        </Group>
        <Popover className="rounded-xl bg-surface-container p-4 text-text shadow-lg ring-1 ring-border">
          <Dialog className="outline-none">
            <Calendar>
              <header className="mb-2 flex items-center justify-between gap-2">
                <Button
                  slot="previous"
                  aria-label="Previous month"
                  className={`size-10 rounded-full hover:bg-text/8 ${focusRing}`}
                >
                  ‹
                </Button>
                <Heading className="text-sm font-medium" />
                <Button
                  slot="next"
                  aria-label="Next month"
                  className={`size-10 rounded-full hover:bg-text/8 ${focusRing}`}
                >
                  ›
                </Button>
              </header>
              <CalendarGrid className="border-separate border-spacing-0.5">
                {(date) => (
                  <CalendarCell
                    date={date}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent data-[hovered]:bg-text/8 data-[outside-month]:hidden data-[selected]:bg-accent data-[selected]:text-on-accent"
                  />
                )}
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </AriaDatePicker>
    </I18nProvider>
  );
}
