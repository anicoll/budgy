import { z } from "zod";
import { centsSchema } from "@/lib/zod/money";

export const allocationSchema = z.object({
  categoryId: z.string().min(1, "Category required"),
  amount: centsSchema.refine((n) => n > 0, { message: "Must be positive" }),
  rollover: z.boolean(),
});

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  period: z.enum(["weekly", "fortnightly", "monthly", "yearly"]),
  startDate: z.string().min(1, "Start date required"),
  categoryAllocations: z.array(allocationSchema),
  notes: z.string().max(250).optional().or(z.literal("")),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type AllocationFormValues = z.infer<typeof allocationSchema>;
