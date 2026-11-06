"use client";

import type { DebtKind, Earn, Home, Lease, Profile, Who } from "@/lib/profile";

export interface Option<T> {
  value: T;
  label: string;
}

/** A row of toggle chips. */
export function Chips<T extends string>(props: {
  options: Option<T>[];
  isOn: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((o) => {
        const on = props.isOn(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => props.onPick(o.value)}
            className={`min-h-11 rounded-full px-4 text-[15px] transition ${
              on
                ? "border border-transparent bg-primary-container font-medium text-on-primary-container"
                : "border border-outline bg-surface hover:bg-surface-container"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const EARN_OPTIONS: Option<Earn>[] = [
  { value: "salary", label: "Salary or wages" },
  { value: "self", label: "Self-employed" },
  { value: "none", label: "Not working right now" },
];

export const HOME_OPTIONS: Option<Home>[] = [
  { value: "loan", label: "I have a home loan" },
  { value: "buying", label: "Saving or buying" },
  { value: "neither", label: "Renting or neither" },
];

export const DEBT_OPTIONS: Option<DebtKind | "none">[] = [
  { value: "help", label: "HELP or HECS" },
  { value: "card", label: "Credit card" },
  { value: "car", label: "Car loan" },
  { value: "personal", label: "Personal loan" },
  { value: "none", label: "None of these" },
];

export const LEASE_OPTIONS: Option<Lease>[] = [
  { value: "have", label: "I have one" },
  { value: "thinking", label: "Thinking about it" },
  { value: "no", label: "No" },
];

export const WHO_OPTIONS: Option<Who>[] = [
  { value: "me", label: "Just me" },
  { value: "two", label: "Me and a partner" },
];

const labelOf = <T extends string>(options: Option<T>[], v: T) =>
  options.find((o) => o.value === v)?.label ?? v;

/** Each answer in a few words, for the Settings rows. */
export function answerLabels(p: Profile) {
  return {
    earn: labelOf(EARN_OPTIONS, p.earn),
    home: labelOf(HOME_OPTIONS, p.home),
    debts: p.debts.length
      ? p.debts.map((d) => labelOf(DEBT_OPTIONS, d)).join(", ")
      : "None of these",
    lease: labelOf(LEASE_OPTIONS, p.lease),
    who: labelOf(WHO_OPTIONS, p.who),
  };
}

/** Toggle one debt; "none" clears them all. */
export function toggleDebt(debts: DebtKind[], v: DebtKind | "none"): DebtKind[] {
  if (v === "none") return [];
  return debts.includes(v) ? debts.filter((d) => d !== v) : [...debts, v];
}
