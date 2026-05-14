import { ulid } from "@/lib/id/ulid";
import { getRepositories } from "@/lib/storage";
import type { SuperPlan, SuperSettings } from "./types";
import { DEFAULT_SUPER_SETTINGS } from "./types";

const SETTINGS_ID = "primary";

// ── Settings (singleton) ────────────────────────────────────────────────────

export async function getSuperSettings(): Promise<SuperSettings> {
  const existing = await getRepositories().superSettings.get(SETTINGS_ID);
  if (existing) return existing;
  const defaults: SuperSettings = {
    ...DEFAULT_SUPER_SETTINGS,
    id: SETTINGS_ID,
    updatedAt: new Date().toISOString(),
  };
  return getRepositories().superSettings.upsert(defaults);
}

export async function saveSuperSettings(
  settings: Omit<SuperSettings, "id" | "updatedAt">,
): Promise<SuperSettings> {
  const full: SuperSettings = { ...settings, id: SETTINGS_ID, updatedAt: new Date().toISOString() };
  return getRepositories().superSettings.upsert(full);
}

// ── Plans (multi-record) ────────────────────────────────────────────────────

export async function listSuperPlans(): Promise<SuperPlan[]> {
  return getRepositories().superPlans.list();
}

export async function saveSuperPlan(
  plan: Omit<SuperPlan, "id" | "updatedAt"> & { id?: string },
): Promise<SuperPlan> {
  const full: SuperPlan = {
    ...plan,
    id: plan.id ?? ulid(),
    updatedAt: new Date().toISOString(),
  };
  return getRepositories().superPlans.upsert(full);
}

export async function deleteSuperPlan(id: string): Promise<void> {
  return getRepositories().superPlans.delete(id);
}
