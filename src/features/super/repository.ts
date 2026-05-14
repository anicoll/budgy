import { getRepositories } from "@/lib/storage";
import type { SuperPlan } from "./types";

const PLAN_ID = "primary";

export async function getSuperPlan(): Promise<SuperPlan | null> {
  return getRepositories().superPlans.get(PLAN_ID);
}

export async function saveSuperPlan(plan: Omit<SuperPlan, "id" | "updatedAt">): Promise<SuperPlan> {
  const full: SuperPlan = { ...plan, id: PLAN_ID, updatedAt: new Date().toISOString() };
  return getRepositories().superPlans.upsert(full);
}
