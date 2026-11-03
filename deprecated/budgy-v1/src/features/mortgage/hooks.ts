import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getMortgagePlan, saveMortgagePlan } from "./repository";
import type { MortgagePlan } from "./types";

export function useMortgagePlan() {
  return useQuery({
    queryKey: queryKeys.mortgage.plan(),
    queryFn: getMortgagePlan,
  });
}

export function useSaveMortgagePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: Omit<MortgagePlan, "id" | "updatedAt">) => saveMortgagePlan(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mortgage.all });
    },
  });
}
