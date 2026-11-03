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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { parseAUDInput } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import { type AccountFormValues, accountFormSchema } from "../schema";
import {
  ACCOUNT_COLORS,
  ACCOUNT_DEFAULT_COLOR,
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  type Account,
  type AccountType,
} from "../types";

type Mode = { kind: "create" } | { kind: "edit"; account: Account } | null;

interface Props {
  mode: Mode;
  onClose: () => void;
  onSubmit: (values: AccountFormValues, mode: NonNullable<Mode>) => Promise<void> | void;
  submitting?: boolean;
}

function defaultValues(mode: Mode): AccountFormValues {
  if (mode?.kind === "edit") {
    return {
      name: mode.account.name,
      type: mode.account.type,
      institution: mode.account.institution ?? "",
      openingBalance: mode.account.openingBalance,
      color: mode.account.color,
      archived: mode.account.archived,
    };
  }
  return {
    name: "",
    type: "checking",
    institution: "",
    openingBalance: 0,
    color: ACCOUNT_DEFAULT_COLOR.checking,
    archived: false,
  };
}

export function AccountFormSheet({ mode, onClose, onSubmit, submitting = false }: Props) {
  const isEdit = mode?.kind === "edit";

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
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
    <Sheet open={!!mode} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit account" : "Add account"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Tweak details, balances, or archive this account."
              : "Track a checking account, credit card, super, or anything else."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Everyday account" autoFocus {...field} />
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
                    onValueChange={(v) => {
                      field.onChange(v);
                      // auto-update colour when type changes from default
                      if (
                        !form.getValues("color") ||
                        form.getValues("color") ===
                          ACCOUNT_DEFAULT_COLOR[(field.value as AccountType) ?? "checking"]
                      ) {
                        form.setValue("color", ACCOUNT_DEFAULT_COLOR[v as AccountType]);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPE_ORDER.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACCOUNT_TYPE_LABEL[t]}
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
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="ANZ, ING, CommBank…" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening balance</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      defaultValue={String((field.value ?? 0) / 100)}
                      onBlur={(e) => {
                        const parsed = parseAUDInput(e.currentTarget.value);
                        field.onChange((parsed ?? 0) as number);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter as dollars (e.g. 1234.56). Negative for credit/loan owing.
                  </FormDescription>
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
                      {ACCOUNT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Pick ${c}`}
                          onClick={() => field.onChange(c)}
                          className={cn(
                            "h-7 w-7 rounded-full ring-2 ring-transparent transition",
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

            {isEdit && (
              <FormField
                control={form.control}
                name="archived"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 p-3">
                    <div>
                      <FormLabel>Archived</FormLabel>
                      <FormDescription>Hides from totals and lists.</FormDescription>
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
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-accent text-primary-foreground hover:opacity-90"
          >
            {isEdit ? "Save changes" : "Add account"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
