import { z } from "zod";

export const backendBudgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  period: z.enum(["weekly", "fortnightly", "monthly"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  accountIds: z.array(z.string()).optional(),
});

export type BackendBudgetFormValues = z.infer<typeof backendBudgetFormSchema>;

export function defaultBackendBudgetValues(): BackendBudgetFormValues {
  return {
    name: "",
    currency: "AUD",
    period: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    accountIds: [],
  };
}

export const assignFundsFormSchema = z.object({
  amount: z.number().positive("Enter a positive amount"),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]),
});

export type AssignFundsFormValues = z.infer<typeof assignFundsFormSchema>;
