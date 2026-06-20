import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { CategoryType as ProtoCategoryType } from "@/gen/budgy/v1/category_pb";
import { categoryClient } from "@/lib/api/connect-client";
import type { CategoryFormValues } from "../schema";
import type { Category, CategoryType } from "../types";

function mapCategoryType(t: ProtoCategoryType): CategoryType {
  switch (t) {
    case ProtoCategoryType.INCOME:
      return "income";
    case ProtoCategoryType.TRANSFER:
      return "transfer";
    default:
      return "expense";
  }
}

function toProtoCategoryType(t: CategoryType): ProtoCategoryType {
  switch (t) {
    case "income":
      return ProtoCategoryType.INCOME;
    case "transfer":
      return ProtoCategoryType.TRANSFER;
    default:
      return ProtoCategoryType.EXPENSE;
  }
}

function mapCategory(c: {
  id: string;
  parentId: string;
  name: string;
  type: ProtoCategoryType;
  color: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
  system: boolean;
}): Category {
  return {
    id: c.id,
    name: c.name,
    parentId: c.parentId || null,
    type: mapCategoryType(c.type),
    color: c.color || "#7c5cff",
    icon: c.icon || undefined,
    archived: c.archived,
    sortOrder: c.sortOrder,
    system: c.system,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await categoryClient.listCategories({});
  return (res.categories ?? []).map(mapCategory);
}

export async function createCategoryApi(values: CategoryFormValues): Promise<Category> {
  const res = await categoryClient.createCategory({
    name: values.name,
    type: toProtoCategoryType(values.type),
    parentId: values.parentId ?? "",
    color: values.color,
    icon: values.icon ?? "",
    sortOrder: 0,
  });
  if (!res.category) throw new Error("Failed to create category");
  return mapCategory(res.category);
}

export async function updateCategoryApi(id: string, values: CategoryFormValues): Promise<Category> {
  const res = await categoryClient.updateCategory({
    categoryId: id,
    name: values.name,
    type: toProtoCategoryType(values.type),
    parentId: values.parentId ?? "",
    color: values.color,
    icon: values.icon ?? "",
    archived: values.archived,
  });
  if (!res.category) throw new Error("Failed to update category");
  return mapCategory(res.category);
}

export async function deleteCategoryApi(id: string): Promise<void> {
  await categoryClient.deleteCategory({ categoryId: id });
}

export async function reorderCategoriesApi(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await categoryClient.updateCategory({ categoryId: ids[i], sortOrder: i });
  }
}

export function tsToISO(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  const ms = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1000000);
  return new Date(ms).toISOString();
}
