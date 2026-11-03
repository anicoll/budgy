import { z } from "zod";

// Plain integer cents in form/schema land. Branding to the `Cents` nominal
// type happens at the repository boundary (e.g. `cents(values.openingBalance)`).
// Keeping the schema's input and output identical keeps RHF resolver inference
// happy.
export const centsSchema = z.number().int("Must be an integer number of cents").finite();

export const nonNegativeCentsSchema = centsSchema.refine((c) => c >= 0, {
  message: "Must be zero or positive",
});

export const decimalRateSchema = z
  .number()
  .min(0, "Cannot be negative")
  .max(1, "Use a decimal (e.g. 0.05 for 5%)");
