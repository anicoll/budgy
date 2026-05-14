"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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

  return (
    <Sheet open={!!mode} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{mode?.kind === "edit" ? "Edit category" : "Add category"}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode?.kind === "edit"}
                  >
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
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_DEFAULT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Colour ${c}`}
                          onClick={() => field.onChange(c)}
                          className={cn(
                            "h-6 w-6 rounded-full ring-2 ring-transparent transition",
                            field.value === c &&
                              "ring-foreground ring-offset-2 ring-offset-surface",
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            {mode?.kind === "edit" ? "Save" : "Add"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
