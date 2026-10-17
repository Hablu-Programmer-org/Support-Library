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
 * The student email keyring is checked everywhere; the remaining secrets are
 * only enforced in production so local development stays low-friction.
 */
export function validateEnv() {
  const studentEmail = studentEmailEnvSchema.safeParse(process.env);
  if (!studentEmail.success) {
    throw new Error(`Invalid student email encryption environment: ${issueNames(studentEmail.error)}`);
  }

  if (process.env.NODE_ENV !== "production") return;

  const result = productionEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid production environment: ${issueNames(result.error)}`);
  }
}
