import { z } from "zod";
import { isoDateAU } from "@/lib/date/au-locale";
import { centsSchema } from "@/lib/zod/money";

export const txnFormSchema = z
  .object({
    date: z.string().min(1, "Date required"),
    type: z.enum(["debit", "credit", "transfer"]),
    accountId: z.string().min(1, "Account required"),
    amount: centsSchema.refine((n) => n > 0, { message: "Amount must be positive" }),
    categoryId: z.string().nullable().optional(),
    payee: z.string().max(100).optional().or(z.literal("")),
    description: z.string().max(250).optional().or(z.literal("")),
    tags: z.array(z.string()).optional(),
    transferAccountId: z.string().optional(),
    cleared: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer" && !data.transferAccountId) {
      ctx.addIssue({
        path: ["transferAccountId"],
        code: z.ZodIssueCode.custom,
        message: "Destination account required for transfers",
      });
    }
    if (data.type === "transfer" && data.transferAccountId === data.accountId) {
      ctx.addIssue({
        path: ["transferAccountId"],
        code: z.ZodIssueCode.custom,
        message: "Source and destination cannot be the same account",
      });
    }
  });

export type TxnFormValues = z.infer<typeof txnFormSchema>;

export function defaultTxnValues(accountId?: string): TxnFormValues {
  return {
    date: isoDateAU(),
    type: "debit",
    accountId: accountId ?? "",
    amount: 0,
    categoryId: null,
    payee: "",
    description: "",
    tags: [],
    transferAccountId: "",
    cleared: false,
  };
}
