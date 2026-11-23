import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase slug format");

export const optionalSlugSchema = z
  .transform((value) => value === "" ? undefined : value)
  .pipe(slugSchema.optional());

export const normalizedTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9+#.-]+$/, "Tags can contain lowercase letters, numbers, +, #, . and -");

export const tagsSchema = z
  .array(normalizedTagSchema)
  .max(10)
  .default([])
  .transform((tags) => [...new Set(tags)]);

export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
