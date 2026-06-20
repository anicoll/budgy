"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query/keys";
import { useOnlineQueryEnabled } from "@/lib/query/use-online-query-enabled";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listCategoriesTree,
  reorderCategories,
  updateCategory,
} from "./repository";
import type { CategoryFormValues } from "./schema";
import type { CategoryType } from "./types";

export function useCategories(opts?: { type?: CategoryType; includeArchived?: boolean }) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: [...queryKeys.categories.list(), opts?.type ?? "all", !!opts?.includeArchived],
    queryFn: () => listCategories({ includeArchived: opts?.includeArchived }),
    select: opts?.type ? (data) => data.filter((c) => c.type === opts.type) : undefined,
    enabled,
  });
}

export function useCategoryTree(type?: CategoryType) {
  const enabled = useOnlineQueryEnabled();
  return useQuery({
    queryKey: [...queryKeys.categories.list(), "tree", type ?? "all"],
    queryFn: () => listCategoriesTree(type),
    enabled,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CategoryFormValues) => createCategory(values),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success(`${cat.name} added`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create category"),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryFormValues }) =>
      updateCategory(id, values),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success(`${cat.name} updated`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update category"),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success("Category deleted");
    },
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => reorderCategories(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to reorder categories"),
  });
}
