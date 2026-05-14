import { ulid } from "@/lib/id/ulid";
import { getRepositories } from "@/lib/storage";
import type { CategoryFormValues } from "./schema";
import { DEFAULT_CATEGORIES } from "./seed";
import type { Category, CategoryType } from "./types";

export function categoriesRepo() {
  return getRepositories().categories;
}

export async function listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]> {
  const rows = await categoriesRepo().list();
  const filtered = opts?.includeArchived ? rows : rows.filter((r) => !r.archived);
  return filtered.sort((a, b) => {
    if (a.parentId !== b.parentId) return (a.parentId ?? "") < (b.parentId ?? "") ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

export async function listCategoriesTree(
  type?: CategoryType,
  opts?: { includeArchived?: boolean },
): Promise<{ root: Category; subcategories: Category[] }[]> {
  const all = await listCategories(opts);
  const typed = type ? all.filter((c) => c.type === type) : all;
  const parents = typed.filter((c) => !c.parentId);
  return parents.map((root) => ({
    root,
    subcategories: typed.filter((c) => c.parentId === root.id),
  }));
}

export async function createCategory(values: CategoryFormValues): Promise<Category> {
  const existing = await categoriesRepo().list();
  const siblings = existing.filter(
    (c) => c.type === values.type && c.parentId === (values.parentId ?? null),
  );
  const category: Category = {
    id: ulid(),
    name: values.name,
    type: values.type,
    parentId: values.parentId ?? null,
    icon: values.icon?.trim() || undefined,
    color: values.color,
    archived: false,
    sortOrder: siblings.length,
  };
  return categoriesRepo().upsert(category);
}

export async function updateCategory(id: string, values: CategoryFormValues): Promise<Category> {
  const current = await categoriesRepo().get(id);
  if (!current) throw new Error(`Category ${id} not found`);
  const updated: Category = {
    ...current,
    name: values.name,
    icon: values.icon?.trim() || undefined,
    color: values.color,
    archived: values.archived ?? current.archived,
  };
  return categoriesRepo().upsert(updated);
}

export async function deleteCategory(id: string): Promise<void> {
  await categoriesRepo().delete(id);
}

export async function seedDefaultCategories(): Promise<void> {
  const existing = await categoriesRepo().count();
  if (existing > 0) return;

  const idMap = new Map<string, string>();

  for (const entry of DEFAULT_CATEGORIES) {
    const id = ulid();
    idMap.set(entry.seedId, id);
    const category: Category = {
      id,
      name: entry.name,
      type: entry.type,
      parentId: entry.parentId ? (idMap.get(entry.parentId) ?? null) : null,
      color: entry.color,
      archived: false,
      sortOrder: entry.sortOrder,
      ...(entry.system ? { system: true } : {}),
    };
    await categoriesRepo().upsert(category);
  }
}

export function getCategoryById(
  categories: Category[],
  id: string | null | undefined,
): Category | undefined {
  if (!id) return undefined;
  return categories.find((c) => c.id === id);
}
