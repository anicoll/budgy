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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isoDateAU } from "@/lib/date/au-locale";
import { type BudgetFormValues, budgetFormSchema } from "../schema";
import { BUDGET_PERIOD_LABEL, type Budget } from "../types";

interface Props {
  open: boolean;
  editing?: Budget | null;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  submitting?: boolean;
}

function defaultValues(editing?: Budget | null): BudgetFormValues {
  if (editing) {
    return {
      name: editing.name,
      period: editing.period,
      startDate: editing.startDate,
      categoryAllocations: editing.categoryAllocations.map((a) => ({
        categoryId: a.categoryId,
        amount: a.amount,
        rollover: a.rollover,
      })),
      notes: editing.notes ?? "",
    };
  }
  return {
    name: "Monthly budget",
    period: "monthly",
    startDate: isoDateAU(),
    categoryAllocations: [],
    notes: "",
  };
}

export function BudgetFormSheet({ open, editing, onClose, onSubmit, submitting = false }: Props) {
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: defaultValues(editing),
  });

  const { reset } = form;
  useEffect(() => {
    if (open) reset(defaultValues(editing));
  }, [open, editing, reset]);

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit budget" : "Create budget"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Change the budget name, period, or start date."
              : "Set the period for this budget. Add category allocations directly on the budget page."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Monthly budget" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BUDGET_PERIOD_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
            {editing ? "Save changes" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
