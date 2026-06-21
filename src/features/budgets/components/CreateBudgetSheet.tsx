"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAllUserAccounts } from "../api/hooks";
import {
  type BackendBudgetFormValues,
  backendBudgetFormSchema,
  defaultBackendBudgetValues,
} from "../api/schema";
import type { BackendBudget } from "../api/types";
import type { Account } from "@/features/accounts/types";
import { Money } from "@/components/money/money";
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
      currency: editing.currency,
      period: editing.period,
      startDate: editing.startDate,
    };
  }
  return defaultBackendBudgetValues();
}

export function CreateBudgetSheet({ open, editing, onClose, onSubmit, submitting }: Props) {
  const isEdit = !!editing;
  const { data: allAccounts = [] } = useAllUserAccounts();

  const form = useForm<BackendBudgetFormValues>({
    resolver: zodResolver(backendBudgetFormSchema),
    defaultValues: toFormValues(editing),
  });

  const { reset, handleSubmit, watch, setValue } = form;
  const accountIds = watch("accountIds") ?? [];

  useEffect(() => {
    if (open) reset(toFormValues(editing));
  }, [open, editing, reset]);

  function toggleAccount(id: string) {
    const next = new Set(accountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setValue("accountIds", [...next]);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit budget" : "Create budget"}</SheetTitle>
          <SheetDescription>
            Zero-sum budgeting: assign every dollar from linked accounts to categories.
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
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay cycle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
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
                  <FormLabel>Cycle start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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

            {!isEdit && allAccounts.length > 0 ? (
              <FormItem>
                <FormLabel>Link accounts (optional)</FormLabel>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2">
                  {allAccounts.map((acc: Account) => (
                    <label
                      key={acc.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={accountIds.includes(acc.id)}
                        onChange={() => toggleAccount(acc.id)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{acc.name}</span>
                      <Money value={acc.currentBalance} className="text-xs text-muted-foreground" />
                    </label>
                  ))}
                </div>
              </FormItem>
            ) : null}

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
