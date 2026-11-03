import { getRepositories } from "@/lib/storage";
import type { MortgagePlan } from "./types";

const PLAN_ID = "primary";

export async function getMortgagePlan(): Promise<MortgagePlan | null> {
  return getRepositories().mortgagePlans.get(PLAN_ID);
}

export async function saveMortgagePlan(
  plan: Omit<MortgagePlan, "id" | "updatedAt">,
): Promise<MortgagePlan> {
  const full: MortgagePlan = { ...plan, id: PLAN_ID, updatedAt: new Date().toISOString() };
  return getRepositories().mortgagePlans.upsert(full);
}
