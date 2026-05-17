"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type CategoryFormValues, categoryFormSchema } from "../schema";
import { CATEGORY_DEFAULT_COLORS, type Category, type CategoryType } from "../types";

type Mode =
  | { kind: "create"; parentId?: string; type?: CategoryType }
  | { kind: "edit"; category: Category }
  | null;

interface Props {
  mode: Mode;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues, mode: NonNullable<Mode>) => Promise<void>;
  submitting?: boolean;
}

function defaultValues(mode: Mode): CategoryFormValues {
  if (mode?.kind === "edit") {
    return {
      name: mode.category.name,
      type: mode.category.type,
      parentId: mode.category.parentId,
      icon: mode.category.icon ?? "",
      color: mode.category.color,
      archived: mode.category.archived,
    };
  }
  return {
    name: "",
    type: mode?.type ?? "expense",
    parentId: mode?.parentId ?? null,
    icon: "",
    color: CATEGORY_DEFAULT_COLORS[0],
    archived: false,
  };
}

export function CategoryFormSheet({ mode, onClose, onSubmit, submitting = false }: Props) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaultValues(mode),
  });

  useEffect(() => {
    if (mode) form.reset(defaultValues(mode));
  }, [mode, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!mode) return;
    await onSubmit(values, mode);
  });

  // Watch for live preview
  const watchedName = form.watch("name");
  const watchedColor = form.watch("color");
  const watchedIcon = form.watch("icon");

  const isEdit = mode?.kind === "edit";
  const isSystem = isEdit && mode.category.system;

  return (
    <Sheet open={!!mode} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit category" : "Add category"}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {/* Live avatar preview */}
            <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-white shadow-sm"
                style={{ background: watchedColor || CATEGORY_DEFAULT_COLORS[0] }}
              >
                {watchedIcon || watchedName.charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{watchedName || "New category"}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Preview
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Groceries, Salary…" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="🏠" maxLength={4} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    A single emoji shown on the avatar. Leave blank to use the first letter.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_DEFAULT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Colour ${c}`}
                            onClick={() => field.onChange(c)}
                            className={cn(
                              "h-7 w-7 rounded-full ring-2 ring-transparent transition",
                              field.value.toLowerCase() === c.toLowerCase() &&
                                "ring-foreground ring-offset-2 ring-offset-surface",
                            )}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Custom:</span>
                        <Input
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value.trim())}
                          placeholder="#7c5cff"
                          className="h-8 max-w-[140px] font-mono text-xs"
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit && !isSystem && (
              <FormField
                control={form.control}
                name="archived"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                    <div className="flex flex-col">
                      <FormLabel className="text-sm">Archived</FormLabel>
                      <FormDescription className="text-[11px]">
                        Hide this category from new transactions and budget pickers.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>

        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            {isEdit ? "Save" : "Add"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
