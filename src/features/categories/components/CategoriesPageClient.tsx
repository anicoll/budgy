"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCategories,
  useCategoryTree,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../hooks";
import { seedDefaultCategories } from "../repository";
import type { CategoryFormValues } from "../schema";
import type { Category, CategoryType } from "../types";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { CategoryTree } from "./CategoryTree";

type SheetMode =
  | { kind: "create"; parentId?: string; type?: CategoryType }
  | { kind: "edit"; category: Category }
  | null;

export function CategoriesPageClient() {
  const { data: incomeTree = [] } = useCategoryTree("income");
  const { data: expenseTree = [] } = useCategoryTree("expense");
  const { data: transferTree = [] } = useCategoryTree("transfer");
  const { data: allCategories = [] } = useCategories();

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  // Seed defaults on first load
  useEffect(() => {
    seedDefaultCategories().catch(() => {});
  }, []);

  async function handleSubmit(values: CategoryFormValues, mode: NonNullable<SheetMode>) {
    if (mode.kind === "create") {
      await createMutation.mutateAsync(values);
    } else {
      await updateMutation.mutateAsync({ id: mode.category.id, values });
    }
    setSheetMode(null);
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <CategoryTree
        type="income"
        tree={incomeTree}
        onAdd={(parentId, type) =>
          setSheetMode({ kind: "create", parentId, type: type ?? "income" })
        }
        onEdit={(cat) => setSheetMode({ kind: "edit", category: cat })}
        onDelete={setPendingDelete}
      />
      <CategoryTree
        type="expense"
        tree={expenseTree}
        onAdd={(parentId, type) =>
          setSheetMode({ kind: "create", parentId, type: type ?? "expense" })
        }
        onEdit={(cat) => setSheetMode({ kind: "edit", category: cat })}
        onDelete={setPendingDelete}
      />
      <CategoryTree
        type="transfer"
        tree={transferTree}
        onAdd={(parentId, type) =>
          setSheetMode({ kind: "create", parentId, type: type ?? "transfer" })
        }
        onEdit={(cat) => setSheetMode({ kind: "edit", category: cat })}
        onDelete={setPendingDelete}
      />

      <CategoryFormSheet
        mode={sheetMode}
        onClose={() => setSheetMode(null)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Transactions in <strong>{pendingDelete?.name}</strong> will become uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground">{allCategories.length} categories total</p>
    </div>
  );
}
