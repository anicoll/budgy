"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cents } from "@/lib/money/cents";

export interface Preferences {
  firstDayOfMonth: number;
  fortnightAnchor: string;
  hideArchived: boolean;
  lastBackupAt?: string;
  onboarded: boolean;
  annualSalary?: Cents; // gross annual salary — set in onboarding, shared across modules
  hasPrivateHealth?: boolean; // affects Medicare Levy Surcharge calculation
}

interface PrefsState extends Preferences {
  _hydrated: boolean;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  firstDayOfMonth: 1,
  fortnightAnchor: "2024-01-01",
  hideArchived: false,
  onboarded: false,
  annualSalary: undefined,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      _hydrated: false,
      setPref: (key, value) => set({ [key]: value } as Partial<PrefsState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "budgy:prefs",
      onRehydrateStorage: () => (state) => {
        if (state) state._hydrated = true;
      },
    },
  ),
);
