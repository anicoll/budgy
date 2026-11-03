"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import { parseAUDInput } from "@/lib/money/format";
import { defaultTxnValues, type TxnFormValues, txnFormSchema } from "../schema";
import type { Transaction } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultAccountId?: string;
  editing?: Transaction | null;
  onSubmit: (values: TxnFormValues) => Promise<void> | void;
  submitting?: boolean;
}

export function TransactionFormSheet({
  open,
  onClose,
  defaultAccountId,
  editing,
  onSubmit,
  submitting = false,
}: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const manualAccounts = useMemo(() => accounts.filter((a) => !a.connectionId), [accounts]);

  const form = useForm<TxnFormValues>({
    resolver: zodResolver(txnFormSchema),
    defaultValues: defaultTxnValues(defaultAccountId || manualAccounts[0]?.id),
  });

  const watchType = form.watch("type");
  const { reset } = form;

  useEffect(() => {
    if (editing) {
      reset({
        date: editing.date,
        type: editing.type,
        accountId: editing.accountId,
        amount: editing.amount,
        categoryId: editing.categoryId ?? null,
        payee: editing.payee ?? "",
        description: editing.description ?? "",
        tags: editing.tags,
        transferAccountId: editing.transferAccountId ?? "",
        cleared: editing.cleared,
      });
    } else {
      reset(defaultTxnValues(defaultAccountId || manualAccounts[0]?.id));
    }
  }, [editing, defaultAccountId, reset, manualAccounts]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const incomeExpenseCategories = categories
    .filter((c) => c.type === "income" || c.type === "expense")
    .sort(byName);
  const transferCategories = categories.filter((c) => c.type === "transfer").sort(byName);
  const relevantCategories =
    watchType === "transfer" ? transferCategories : incomeExpenseCategories;

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit transaction" : "Add transaction"}</SheetTitle>
          <SheetDescription>
            {editing ? "Modify this transaction." : "Record income, an expense, or a transfer."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="debit">Expense</SelectItem>
                        <SelectItem value="credit">Income</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{watchType === "transfer" ? "From account" : "Account"}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {manualAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchType === "transfer" && (
              <FormField
                control={form.control}
                name="transferAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To account</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {manualAccounts
                          .filter((a) => a.id !== form.watch("accountId"))
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      defaultValue={field.value ? String(field.value / 100) : ""}
                      onBlur={(e) => {
                        const parsed = parseAUDInput(e.currentTarget.value);
                        field.onChange(parsed != null ? Math.abs(parsed) : 0);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Uncategorised" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Uncategorised</SelectItem>
                      {relevantCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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
              name="payee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payee</FormLabel>
                  <FormControl>
                    <Input placeholder="Coles, Netflix, …" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      className="resize-none"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cleared"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
                  <FormLabel className="cursor-pointer">Cleared</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            {editing ? "Save changes" : "Add transaction"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
