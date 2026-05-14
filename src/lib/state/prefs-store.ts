"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Preferences {
  firstDayOfMonth: number;
  fortnightAnchor: string;
  hideArchived: boolean;
  lastBackupAt?: string;
  onboarded: boolean;
}

interface PrefsState extends Preferences {
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  firstDayOfMonth: 1,
  fortnightAnchor: "2024-01-01",
  hideArchived: false,
  onboarded: false,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setPref: (key, value) => set({ [key]: value } as Partial<PrefsState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "budgy:prefs" },
  ),
);
