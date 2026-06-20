import { z } from "zod";

export const backendBudgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  method: z.enum(["zero_sum", "envelope"]),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
});

export type BackendBudgetFormValues = z.infer<typeof backendBudgetFormSchema>;

export function defaultBackendBudgetValues(): BackendBudgetFormValues {
  return {
    name: "",
    method: "zero_sum",
    currency: "AUD",
  };
}
