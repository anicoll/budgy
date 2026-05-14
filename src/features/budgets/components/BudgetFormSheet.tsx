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
      targets: editing.targets.map((a) => ({
        categoryId: a.categoryId,
        amount: a.amount,
        frequency: a.frequency ?? editing.period,
        rollover: a.rollover,
      })),
      notes: editing.notes ?? "",
    };
  }
  return {
    name: "",
    period: "monthly",
    startDate: isoDateAU(),
    targets: [],
    notes: "",
  };
}

export function BudgetFormSheet({ open, editing, onClose, onSubmit, submitting = false }: Props) {
  const isEdit = !!editing;

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
          <SheetTitle>{isEdit ? "Edit budget" : "Create budget"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Change the budget name, viewing period, or start date."
              : "Give your budget a name. Transactions will show automatically — add targets on the budget page to set goals."}
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
                    <Input placeholder="My budget" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Period and start date are only shown when editing — on create they default silently */}
            {isEdit && (
              <>
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Viewing period</FormLabel>
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
              </>
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
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
