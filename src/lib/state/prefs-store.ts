"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cents } from "@/lib/money/cents";

export interface NovatedLease {
  id: string;
  name: string; // "Tesla Model 3", "Work Car"
  annualPreTaxAmount: Cents; // total annual salary sacrifice deducted pre-tax
  fbtRate: number; // 0.0-1.0; after-tax FBT cost = preTax x fbtRate
}

export interface Preferences {
  firstDayOfMonth: number;
  fortnightAnchor: string;
  hideArchived: boolean;
  lastBackupAt?: string;
  onboarded: boolean;
  annualSalary?: Cents; // gross annual salary — set in onboarding, shared across modules
  hasPrivateHealth?: boolean; // affects Medicare Levy Surcharge calculation
  novatedLeases?: NovatedLease[];
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
