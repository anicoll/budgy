import { z } from "zod";

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(["income", "expense", "transfer"]),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(40).optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour"),
  archived: z.boolean().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
