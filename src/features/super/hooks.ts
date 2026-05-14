import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getSuperPlan, saveSuperPlan } from "./repository";
import type { SuperPlan } from "./types";

export function useSuperPlan() {
  return useQuery({
    queryKey: queryKeys.super.plan(),
    queryFn: getSuperPlan,
  });
}

export function useSaveSuperPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: Omit<SuperPlan, "id" | "updatedAt">) => saveSuperPlan(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.all });
    },
  });
}
