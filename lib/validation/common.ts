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
    return parsed?.protocol === "https:";
  }, "Use an HTTPS link")
  .refine((url) => {
    const hosts = allowedLinkHosts();
    if (hosts.size === 0) return true;
    const hostname = parseUrl(url)?.hostname.toLowerCase();
    if (!hostname) return false;
    return [...hosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  }, "Link host is not allowed");

export const videoLinkSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  url: httpsUrlSchema,
  timestamp: z.string().trim().max(12).regex(/^[\d:]+$/).optional(),
  summary: z.string().trim().max(500).optional(),
});

/** Default cap on video links when `MAX_LINKS_PER_ITEM` is unset. */
export const LINK_LIMIT_DEFAULT = 10;

/**
 * Hard ceiling for `MAX_LINKS_PER_ITEM`, independent of the environment.
 *
 * The cap is an abuse guard, so an operator typo (`0`, `999`, `ten`, an empty
 * string) must never disable it: an out-of-range value falls back to
 * `LINK_LIMIT_DEFAULT`, and the schemas still reject anything above this.
 */
export const LINK_LIMIT_MAX = 50;

/**
 * Configured maximum number of video links (env: `MAX_LINKS_PER_ITEM`).
 *
 * Read per call rather than at module load so the value is always current, and
 * lenient for the same reason `ALLOWED_LINK_HOSTS` is: a bad value must not break
 * the app, and the safe default is the strict side of the choice.
 */
export function linkLimit(): number {
  const raw = (process.env.MAX_LINKS_PER_ITEM ?? "").trim();
  if (!raw) return LINK_LIMIT_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > LINK_LIMIT_MAX) {
    return LINK_LIMIT_DEFAULT;
  }
  return parsed;
}

/**
 * Video link arrays.
 *
 * `.max(LINK_LIMIT_MAX)` is a static hard ceiling; the `superRefine` then applies
 * the configured `MAX_LINKS_PER_ITEM` value. Validation is therefore enforced by
 * the Zod schema (server-side parse) as well as by `lib/parse-links.ts`.
 */
export const videoLinksSchema = z
  .array(videoLinkSchema)
  .max(LINK_LIMIT_MAX)
  .default([])
  .superRefine((links, ctx) => {
    const limit = linkLimit();
    if (links.length > limit) {
      ctx.addIssue({ code: "custom", message: `Add at most ${limit} video links` });
    }
  });

export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
