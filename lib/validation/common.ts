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

const allowedLinkHosts = () =>
  new Set(
    (process.env.ALLOWED_LINK_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const httpsUrlSchema = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .refine((url) => {
    const parsed = parseUrl(url);
    return parsed?.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        process.env.ALLOW_INSECURE_LINKS === "true" &&
        parsed?.protocol === "http:");
  }, "Use an HTTPS link")
  .refine((url) => {
    const hosts = allowedLinkHosts();
    if (hosts.size === 0) return true;
    const hostname = parseUrl(url)?.hostname.toLowerCase();
    if (!hostname) return false;
    return [...hosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  }, "Link host is not allowed");

export const externalFileLinkSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  url: httpsUrlSchema,
  type: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

export const videoLinkSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  url: httpsUrlSchema,
  timestamp: z.string().trim().max(12).regex(/^[\d:]+$/).optional(),
  summary: z.string().trim().max(500).optional(),
});

export const fileLinksSchema = z.array(externalFileLinkSchema).max(10).default([]);
export const videoLinksSchema = z.array(videoLinkSchema).max(10).default([]);

export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
