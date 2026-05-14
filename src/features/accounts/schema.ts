import { z } from "zod";
import { centsSchema } from "@/lib/zod/money";
import { ACCOUNT_TYPE_ORDER } from "./types";

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(ACCOUNT_TYPE_ORDER as [string, ...string[]]),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  openingBalance: centsSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour"),
  archived: z.boolean().optional(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
