import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase slug format");

export const optionalSlugSchema = z.preprocess(
  (value) => value === "" ? undefined : value,
  slugSchema.optional(),
);

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

export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((url) => {
    if (process.env.ALLOW_INSECURE_LINKS === "true") return true;
    return url.startsWith("https://");
  }, "Use an HTTPS link");

export const externalFileLinkSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    url: httpsUrlSchema,
    type: z.string().trim().max(40).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const videoLinkSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    url: httpsUrlSchema,
    timestamp: z.string().trim().max(12).regex(/^[\d:]+$/).optional(),
    summary: z.string().trim().max(500).optional(),
  })
  .strict();

export const fileLinksSchema = z.array(externalFileLinkSchema).max(10).default([]);
export const videoLinksSchema = z.array(videoLinkSchema).max(10).default([]);

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
