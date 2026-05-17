"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from "../hooks";
import { seedDefaultCategories } from "../repository";
import type { CategoryFormValues } from "../schema";
import { CATEGORY_TYPE_LABEL, type Category, type CategoryType } from "../types";
import { CategoryCard } from "./CategoryCard";
import { CategoryFormSheet } from "./CategoryFormSheet";

type SheetMode =
  | { kind: "create"; parentId?: string; type?: CategoryType }
  | { kind: "edit"; category: Category }
  | null;

const TYPE_TABS: CategoryType[] = ["expense", "income", "transfer"];

export function CategoriesPageClient() {
  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [search, setSearch] = useState("");
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const { data: allCategories = [] } = useCategories({ includeArchived: true });

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const reorderMutation = useReorderCategories();

  // Seed defaults on first load
  useEffect(() => {
    seedDefaultCategories().catch(() => {});
  }, []);

  // Group categories by type, then by parent
  const grouped = useMemo(() => {
    const map = new Map<CategoryType, { root: Category; subcategories: Category[] }[]>();
    for (const type of TYPE_TABS) map.set(type, []);

    const byType: Record<CategoryType, Category[]> = {
      income: [],
      expense: [],
      transfer: [],
    };
    for (const c of allCategories) byType[c.type].push(c);

    for (const type of TYPE_TABS) {
      const typed = byType[type];
      const roots = typed.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
      const tree = roots.map((root) => ({
        root,
        subcategories: typed
          .filter((c) => c.parentId === root.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));
      map.set(type, tree);
    }
    return map;
  }, [allCategories]);

  const counts = useMemo(() => {
    const c: Record<CategoryType, number> = { income: 0, expense: 0, transfer: 0 };
    for (const cat of allCategories) if (!cat.archived) c[cat.type]++;
    return c;
  }, [allCategories]);

  // Filter by search
  const visibleTree = useMemo(() => {
    const tree = grouped.get(activeType) ?? [];
    if (!search.trim()) return tree;
    const q = search.trim().toLowerCase();
    return tree
      .map(({ root, subcategories }) => {
        const matchingSubs = subcategories.filter((s) => s.name.toLowerCase().includes(q));
        const rootMatches = root.name.toLowerCase().includes(q);
        if (rootMatches || matchingSubs.length > 0) {
          return { root, subcategories: rootMatches ? subcategories : matchingSubs };
        }
        return null;
      })
      .filter((x): x is { root: Category; subcategories: Category[] } => x !== null);
  }, [grouped, activeType, search]);

  const rootIds = useMemo(() => visibleTree.map((t) => t.root.id), [visibleTree]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleRootDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rootIds.indexOf(String(active.id));
    const newIndex = rootIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorderMutation.mutate(arrayMove(rootIds, oldIndex, newIndex));
  }

  function handleSubReorder(_parentId: string, ids: string[]) {
    reorderMutation.mutate(ids);
  }

  async function handleSubmit(values: CategoryFormValues, mode: NonNullable<SheetMode>) {
    if (mode.kind === "create") {
      await createMutation.mutateAsync(values);
    } else {
      await updateMutation.mutateAsync({ id: mode.category.id, values });
    }
    setSheetMode(null);
  }

  function handleArchiveToggle(category: Category) {
    updateMutation.mutate({
      id: category.id,
      values: {
        name: category.name,
        type: category.type,
        parentId: category.parentId ?? null,
        icon: category.icon ?? "",
        color: category.color,
        archived: !category.archived,
      },
    });
  }

  const submitting = createMutation.isPending || updateMutation.isPending;
  const totalCount = visibleTree.reduce((s, t) => s + 1 + t.subcategories.length, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Categories</h1>
          <p className="text-xs text-muted-foreground">
            Organise transactions into income, expense, and transfer groups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-48 pl-8"
            />
          </div>
          <Button
            onClick={() => setSheetMode({ kind: "create", type: activeType })}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add category
          </Button>
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex items-center border-b border-border/60">
        {TYPE_TABS.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeType === type
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {CATEGORY_TYPE_LABEL[type]}
            <span className="ml-1.5 text-xs text-muted-foreground/70">{counts[type]}</span>
            {activeType === type && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visibleTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 px-8 py-16 text-center">
          <p className="text-sm font-medium">
            {search.trim()
              ? `No ${CATEGORY_TYPE_LABEL[activeType].toLowerCase()} categories match "${search.trim()}"`
              : `No ${CATEGORY_TYPE_LABEL[activeType].toLowerCase()} categories yet`}
          </p>
          {!search.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetMode({ kind: "create", type: activeType })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add your first
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleRootDragEnd}
        >
          <SortableContext items={rootIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleTree.map(({ root, subcategories }) => (
                <CategoryCard
                  key={root.id}
                  root={root}
                  subcategories={subcategories}
                  onEdit={(cat) => setSheetMode({ kind: "edit", category: cat })}
                  onDelete={setPendingDelete}
                  onArchiveToggle={handleArchiveToggle}
                  onReorderSubcategories={handleSubReorder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Footer count */}
      {visibleTree.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {totalCount} {totalCount === 1 ? "category" : "categories"}
        </p>
      )}

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
    </div>
  );
}
