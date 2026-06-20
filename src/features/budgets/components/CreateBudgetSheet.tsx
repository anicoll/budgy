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
import {
  type BackendBudgetFormValues,
  backendBudgetFormSchema,
  defaultBackendBudgetValues,
} from "../api/schema";
import type { BackendBudget } from "../api/types";

interface Props {
  open: boolean;
  editing?: BackendBudget | null;
  onClose: () => void;
  onSubmit: (values: BackendBudgetFormValues) => Promise<void>;
  submitting?: boolean;
}

function toFormValues(editing?: BackendBudget | null): BackendBudgetFormValues {
  if (editing) {
    return {
      name: editing.name,
      method: editing.method,
      currency: editing.currency,
    };
  }
  return defaultBackendBudgetValues();
}

export function CreateBudgetSheet({ open, editing, onClose, onSubmit, submitting }: Props) {
  const isEdit = !!editing;

  const form = useForm<BackendBudgetFormValues>({
    resolver: zodResolver(backendBudgetFormSchema),
    defaultValues: toFormValues(editing),
  });

  const { reset, handleSubmit } = form;

  useEffect(() => {
    if (open) reset(toFormValues(editing));
  }, [open, editing, reset]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit budget" : "Create budget"}</SheetTitle>
          <SheetDescription>
            Budgets are stored on the server. Choose zero-sum or envelope method.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit(async (values) => {
              await onSubmit(values);
              onClose();
            })}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Household budget" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zero_sum">Zero-sum</SelectItem>
                      <SelectItem value="envelope">Envelope</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="AUD" maxLength={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
