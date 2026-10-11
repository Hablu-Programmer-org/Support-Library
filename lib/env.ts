import "server-only";

import { z } from "zod";

const mongoUriSchema = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"), {
    message: "Must be a MongoDB connection URI",
  });

const productionEnvSchema = z.object({
  MONGODB_URI: mongoUriSchema,
  LMS_MONGODB_URI: mongoUriSchema,
  MONGODB_DB: z.string().trim().min(1),
  LMS_MONGODB_DB: z.string().trim().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().trim().min(1),
  AUTH_GOOGLE_SECRET: z.string().trim().min(1),
  AUTH_URL: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname));
  }, { message: "AUTH_URL must use HTTPS outside loopback environments" }),
  AUTH_TRUST_HOST: z.literal("true"),
});

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const result = productionEnvSchema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))]
      .sort()
      .join(", ");
    throw new Error(`Invalid production environment: ${names}`);
  }
}
