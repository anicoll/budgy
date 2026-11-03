import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  deleteSuperPlan,
  getSuperSettings,
  listSuperPlans,
  saveSuperPlan,
  saveSuperSettings,
} from "./repository";
import type { SuperPlan, SuperSettings } from "./types";

export function useSuperSettings() {
  return useQuery({
    queryKey: queryKeys.super.settings(),
    queryFn: getSuperSettings,
  });
}

export function useSaveSuperSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Omit<SuperSettings, "id" | "updatedAt">) => saveSuperSettings(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.all });
    },
  });
}

export function useListSuperPlans() {
  return useQuery({
    queryKey: queryKeys.super.plans(),
    queryFn: listSuperPlans,
  });
}

export function useSaveOneSuperPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: Omit<SuperPlan, "id" | "updatedAt"> & { id?: string }) =>
      saveSuperPlan(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.all });
    },
  });
}

export function useDeleteSuperPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSuperPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.all });
    },
  });
}
