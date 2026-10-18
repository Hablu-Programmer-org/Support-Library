import "server-only";

import { z } from "zod";

const mongoUriSchema = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"), {
    message: "Must be a MongoDB connection URI",
  });

const studentEmailKeyringSchema = z.string().regex(
  /^v[1-9]\d*:[A-Za-z0-9+/]{43}=(?:,v[1-9]\d*:[A-Za-z0-9+/]{43}=)*$/,
  "Must use vN:<32-byte-base64>[,vN:<32-byte-base64>] format",
);

// Check for minimum entropy in AUTH_SECRET (at least 3 unique character types)
function hasSufficientEntropy(secret: string): boolean {
  const hasUpper = /[A-Z]/.test(secret);
  const hasLower = /[a-z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^A-Za-z0-9]/.test(secret);
  const uniqueChars = new Set(secret).size;
  const typeCount = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
  return typeCount >= 3 && uniqueChars >= 16;
}

/**
 * Student email encryption keys.
 *
 * Split out from the production schema because these are required in *every*
 * environment: every issue create encrypts the student email, so when the
 * keyring is missing the only symptom is a generic "try again later" failure on
 * submit. Validating at startup turns that into an explicit boot error.
 */
const studentEmailEnvShape = {
  STUDENT_EMAIL_KEY_VERSION: z.string().regex(/^v[1-9]\d*$/),
  STUDENT_EMAIL_ENCRYPTION_KEYS: studentEmailKeyringSchema,
  STUDENT_EMAIL_LOOKUP_KEYS: studentEmailKeyringSchema,
};

type StudentEmailEnv = {
  STUDENT_EMAIL_KEY_VERSION: string;
  STUDENT_EMAIL_ENCRYPTION_KEYS: string;
  STUDENT_EMAIL_LOOKUP_KEYS: string;
};

function checkActiveKeyVersion(
  env: StudentEmailEnv,
  context: z.core.$RefinementCtx,
) {
  const prefix = `${env.STUDENT_EMAIL_KEY_VERSION}:`;
  if (!env.STUDENT_EMAIL_ENCRYPTION_KEYS.split(",").some((entry) => entry.startsWith(prefix))) {
    context.addIssue({ code: "custom", path: ["STUDENT_EMAIL_ENCRYPTION_KEYS"], message: "Active version is missing" });
  }
  if (!env.STUDENT_EMAIL_LOOKUP_KEYS.split(",").some((entry) => entry.startsWith(prefix))) {
    context.addIssue({ code: "custom", path: ["STUDENT_EMAIL_LOOKUP_KEYS"], message: "Active version is missing" });
  }
}

const studentEmailEnvSchema = z
  .object(studentEmailEnvShape)
  .superRefine(checkActiveKeyVersion);

/**
 * Upload storage configuration.
 *
 * Validated in every environment: selecting a remote backend without its
 * credentials would otherwise fail only when a student tried to attach a file,
 * which is exactly the kind of failure a boot check should catch instead.
 */
const UPLOAD_MODES = ["disabled", "memory", "r2", "cloudinary"] as const;
const CLOUDINARY_FREE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const uploadEnvShape = {
  UPLOAD_STORAGE: z.string().trim().optional(),
  UPLOAD_STORAGE_ALLOW_EPHEMERAL: z.string().trim().optional(),
  R2_ACCOUNT_ID: z.string().trim().optional(),
  R2_BUCKET: z.string().trim().optional(),
  R2_ACCESS_KEY_ID: z.string().trim().optional(),
  R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
  R2_ENDPOINT: z.string().trim().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB: z.string().trim().optional(),
  MAX_UPLOADS_PER_ITEM: z.string().trim().optional(),
  MAX_UPLOAD_BYTES: z.string().trim().optional(),
};

type UploadEnv = {
  UPLOAD_STORAGE?: string;
  UPLOAD_STORAGE_ALLOW_EPHEMERAL?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ENDPOINT?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB?: string;
  MAX_UPLOAD_BYTES?: string;
};

/** Accepts the usual affirmative spellings for a boolean environment flag. */
const isEnabled = (value: string | undefined) =>
  ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());

function checkUploadStorage(env: UploadEnv, context: z.core.$RefinementCtx) {
  const mode = (env.UPLOAD_STORAGE ?? "disabled").toLowerCase();

  if (!(UPLOAD_MODES as readonly string[]).includes(mode)) {
    context.addIssue({
      code: "custom",
      path: ["UPLOAD_STORAGE"],
      message: `Must be one of ${UPLOAD_MODES.join(", ")}`,
    });
    return;
  }

  // A memory store loses every object on restart and is not shared between
  // replicas; in production that is silent data loss, not a valid configuration.
  // An explicit acknowledgement keeps it available for a throwaway deployment —
  // the end-to-end run, or a preview that only needs the flow to work.
  if (
    mode === "memory" &&
    process.env.NODE_ENV === "production" &&
    !isEnabled(env.UPLOAD_STORAGE_ALLOW_EPHEMERAL)
  ) {
    context.addIssue({
      code: "custom",
      path: ["UPLOAD_STORAGE"],
      message:
        "Cannot be `memory` in production; use `r2`, `cloudinary`, leave it unset, or set UPLOAD_STORAGE_ALLOW_EPHEMERAL=true to accept that every upload is lost on restart",
    });
    return;
  }

  if (mode !== "r2" && mode !== "cloudinary") return;

  if (mode === "r2") {
    for (const key of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const) {
      if (!env[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Required when UPLOAD_STORAGE is r2",
        });
      }
    }
    return;
  }

  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
    if (!env[key]) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Required when UPLOAD_STORAGE is cloudinary",
      });
    }
  }

  if (env.CLOUDINARY_CLOUD_NAME && !/^[A-Za-z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME)) {
    context.addIssue({
      code: "custom",
      path: ["CLOUDINARY_CLOUD_NAME"],
      message: "Must be a valid Cloudinary cloud name",
    });
  }
  if (env.CLOUDINARY_API_KEY && !/^\d+$/.test(env.CLOUDINARY_API_KEY)) {
    context.addIssue({
      code: "custom",
      path: ["CLOUDINARY_API_KEY"],
      message: "Must be the numeric API key from Cloudinary",
    });
  }

  const configuredBytes = Number((env.MAX_UPLOAD_BYTES ?? "").trim());
  if (
    Number.isInteger(configuredBytes) &&
    configuredBytes > CLOUDINARY_FREE_MAX_IMAGE_BYTES &&
    !isEnabled(env.CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB)
  ) {
    context.addIssue({
      code: "custom",
      path: ["MAX_UPLOAD_BYTES"],
      message:
        "Cloudinary Free accepts images up to 10 MiB; lower MAX_UPLOAD_BYTES or explicitly set CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB=true for a plan that supports larger images",
    });
  }
}

const uploadEnvSchema = z.object(uploadEnvShape).superRefine(checkUploadStorage);

/**
 * A configurable http(s) URL.
 *
 * Production requires HTTPS outside loopback, matching `AUTH_URL`, so a
 * misconfigured origin cannot silently downgrade a link or a redirect. Callers
 * add `.optional().or(z.literal(""))` when the value merely enables a feature
 * and an empty/absent value should mean "disabled" rather than a boot failure.
 */
const configurableUrlSchema = () =>
  z
    .string()
    .trim()
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, { message: "must be an http(s) URL" })
    .refine((value) => {
      if (process.env.NODE_ENV !== "production") return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" ||
          (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname));
      } catch {
        return false;
      }
    }, { message: "must use HTTPS outside loopback environments" });

/**
 * Cross-app links to the Hablu Programmer LMS (the main frontend).
 *
 * Optional everywhere, because the Support Library can run standalone: when the
 * value is missing the "My Courses" nav item is simply not rendered, instead of
 * pointing at a relative URL on this app's own origin (which would 404).
 *
 * It is still validated in every environment — a typo here would otherwise show
 * up as a dead nav link nobody can explain.
 */
const crossAppEnvShape = {
  NEXT_PUBLIC_LMS_URL: configurableUrlSchema().optional().or(z.literal("")),
};

const crossAppEnvSchema = z.object(crossAppEnvShape);

/**
 * Live support meeting details.
 *
 * Optional everywhere: unset falls back to the standing Zoom room. An invalid
 * join URL is rejected at boot rather than rendering a button that points at
 * nothing. The values are server-side only and are rendered to signed-in
 * users, so they must never be logged.
 */
const liveSupportEnvShape = {
  LIVE_SUPPORT_PLATFORM: z.string().trim().max(40).optional(),
  LIVE_SUPPORT_JOIN_URL: configurableUrlSchema().optional().or(z.literal("")),
  LIVE_SUPPORT_MEETING_ID: z.string().trim().max(40).optional(),
  LIVE_SUPPORT_PASSCODE: z.string().trim().max(40).optional(),
};

const liveSupportEnvSchema = z.object(liveSupportEnvShape);

const productionEnvSchema = z
  .object({
    MONGODB_URI: mongoUriSchema,
    LMS_MONGODB_URI: mongoUriSchema,
    MONGODB_DB: z.string().trim().min(1),
    LMS_MONGODB_DB: z.string().trim().min(1),
    AUTH_SECRET: z.string().min(32).refine(hasSufficientEntropy, {
      message: "AUTH_SECRET must have sufficient entropy (min 32 chars, 3+ character types, 16+ unique chars)",
    }),
    AUTH_GOOGLE_ID: z.string().trim().min(1),
    AUTH_GOOGLE_SECRET: z.string().trim().min(1),
    AUTH_URL: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" ||
        (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname));
    }, { message: "AUTH_URL must use HTTPS outside loopback environments" }),
    AUTH_TRUST_HOST: z.literal("true"),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5),
    ...studentEmailEnvShape,
  })
  .superRefine(checkActiveKeyVersion);

const issueNames = (error: z.ZodError) =>
  [
    ...new Set(
      error.issues.map((issue) => `${String(issue.path[0] ?? "_form")}: ${issue.message}`),
    ),
  ]
    .sort()
    .join("; ");

/**
 * Fails fast on unusable configuration.
 *
 * The student email keyring and the upload storage mode are checked everywhere;
 * the remaining secrets are only enforced in production so local development
 * stays low-friction.
 */
export function validateEnv() {
  const studentEmail = studentEmailEnvSchema.safeParse(process.env);
  if (!studentEmail.success) {
    throw new Error(`Invalid student email encryption environment: ${issueNames(studentEmail.error)}`);
  }

  const uploads = uploadEnvSchema.safeParse(process.env);
  if (!uploads.success) {
    throw new Error(`Invalid upload storage environment: ${issueNames(uploads.error)}`);
  }

  const crossApp = crossAppEnvSchema.safeParse(process.env);
  if (!crossApp.success) {
    throw new Error(`Invalid cross-app link environment: ${issueNames(crossApp.error)}`);
  }

  const liveSupport = liveSupportEnvSchema.safeParse(process.env);
  if (!liveSupport.success) {
    throw new Error(`Invalid live support environment: ${issueNames(liveSupport.error)}`);
  }

  if (process.env.NODE_ENV !== "production") return;

  const result = productionEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid production environment: ${issueNames(result.error)}`);
  }
}
