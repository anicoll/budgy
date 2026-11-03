import { z } from "zod";
import { centsSchema } from "@/lib/zod/money";

// Quarterly is valid for targets (e.g. rates, insurance) but not for budget viewing periods
const FREQUENCY_ENUM = z.enum(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]);
const PERIOD_ENUM = z.enum(["weekly", "fortnightly", "monthly", "yearly"]);
const MODE_ENUM = z.enum(["envelope", "period"]);

export const targetSchema = z.object({
  categoryId: z.string().min(1, "Category required"),
  amount: centsSchema.refine((n) => n >= 0, { message: "Must be zero or positive" }),
  frequency: FREQUENCY_ENUM,
  mode: MODE_ENUM.optional(),
  openedAt: z.string().optional(),
});

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  period: PERIOD_ENUM,
  startDate: z.string().min(1, "Start date required"),
  targets: z.array(targetSchema),
  notes: z.string().max(250).optional().or(z.literal("")),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type TargetFormValues = z.infer<typeof targetSchema>;
