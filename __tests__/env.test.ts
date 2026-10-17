// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const validKeyring = (byte: number) => `v1:${Buffer.alloc(32, byte).toString("base64")}`;

const { validateEnv } = await import("@/lib/env");

const MANAGED_VARS = [
  "NODE_ENV",
  "STUDENT_EMAIL_KEY_VERSION",
  "STUDENT_EMAIL_ENCRYPTION_KEYS",
  "STUDENT_EMAIL_LOOKUP_KEYS",
  "MONGODB_URI",
  "LMS_MONGODB_URI",
  "MONGODB_DB",
  "LMS_MONGODB_DB",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "TRUSTED_PROXY_HOPS",
  "UPLOAD_STORAGE",
  "UPLOAD_STORAGE_ALLOW_EPHEMERAL",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "MAX_UPLOADS_PER_ITEM",
  "MAX_UPLOAD_BYTES",
] as const;

const originalEnv = { ...process.env };

/** Apply only the listed vars, deleting the rest so each case is isolated. */
function setEnv(values: Record<string, string>) {
  for (const key of MANAGED_VARS) delete process.env[key];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const key of MANAGED_VARS) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

const productionVars = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/support",
  LMS_MONGODB_URI: "mongodb://127.0.0.1:27017/lms",
  MONGODB_DB: "support",
  LMS_MONGODB_DB: "hp-v2",
  AUTH_SECRET: "A7f3kP9xQ2mN8vR5tY1wL6sD4hJ0cB!2026",
  AUTH_GOOGLE_ID: "google-id",
  AUTH_GOOGLE_SECRET: "google-secret",
  AUTH_URL: "https://support.example.com",
  AUTH_TRUST_HOST: "true",
  TRUSTED_PROXY_HOPS: "1",
};

const studentEmailVars = {
  STUDENT_EMAIL_KEY_VERSION: "v1",
  STUDENT_EMAIL_ENCRYPTION_KEYS: validKeyring(1),
  STUDENT_EMAIL_LOOKUP_KEYS: validKeyring(2),
};

describe("validateEnv", () => {
  it("accepts a valid student email keyring outside production", () => {
    setEnv({ NODE_ENV: "development", ...studentEmailVars });

    expect(() => validateEnv()).not.toThrow();
  });

  it("requires the student email keyring in development too", () => {
    setEnv({ NODE_ENV: "development" });

    expect(() => validateEnv()).toThrow(/student email encryption environment/i);
  });

  it("rejects a placeholder keyring from the example file", () => {
    setEnv({
      NODE_ENV: "development",
      ...studentEmailVars,
      STUDENT_EMAIL_ENCRYPTION_KEYS: "v1:",
    });

    expect(() => validateEnv()).toThrow(/STUDENT_EMAIL_ENCRYPTION_KEYS/);
  });

  it("rejects a keyring missing the active version", () => {
    setEnv({
      NODE_ENV: "development",
      ...studentEmailVars,
      STUDENT_EMAIL_ENCRYPTION_KEYS: `v2:${Buffer.alloc(32, 3).toString("base64")}`,
    });

    expect(() => validateEnv()).toThrow(/Active version is missing/);
  });

  it("accepts missing production secrets outside production", () => {
    setEnv({ NODE_ENV: "development", ...studentEmailVars });

    expect(() => validateEnv()).not.toThrow();
  });

  it("rejects missing production secrets in production", () => {
    setEnv({ NODE_ENV: "production", ...studentEmailVars });

    expect(() => validateEnv()).toThrow(/Invalid production environment/i);
  });

  it("rejects an unknown UPLOAD_STORAGE mode", () => {
    setEnv({ NODE_ENV: "development", ...studentEmailVars, UPLOAD_STORAGE: "s3" });

    expect(() => validateEnv()).toThrow(/UPLOAD_STORAGE/);
  });

  it("rejects the in-memory store in production", () => {
    setEnv({
      NODE_ENV: "production",
      ...studentEmailVars,
      ...productionVars,
      UPLOAD_STORAGE: "memory",
    });

    expect(() => validateEnv()).toThrow(/UPLOAD_STORAGE/);
  });

  it("rejects UPLOAD_STORAGE=r2 without credentials", () => {
    setEnv({
      NODE_ENV: "production",
      ...studentEmailVars,
      ...productionVars,
      UPLOAD_STORAGE: "r2",
      R2_ACCOUNT_ID: "account",
    });

    expect(() => validateEnv()).toThrow(/R2_BUCKET/);
  });

  it("accepts a fully configured r2 deployment", () => {
    setEnv({
      NODE_ENV: "production",
      ...studentEmailVars,
      ...productionVars,
      UPLOAD_STORAGE: "r2",
      R2_ACCOUNT_ID: "account",
      R2_BUCKET: "bucket",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
    });

    expect(() => validateEnv()).not.toThrow();
  });

  it("accepts the in-memory store outside production", () => {
    setEnv({ NODE_ENV: "development", ...studentEmailVars, UPLOAD_STORAGE: "memory" });

    expect(() => validateEnv()).not.toThrow();
  });

  it("accepts ephemeral memory storage in production only when explicitly allowed", () => {
    setEnv({
      NODE_ENV: "production",
      ...studentEmailVars,
      ...productionVars,
      UPLOAD_STORAGE: "memory",
      UPLOAD_STORAGE_ALLOW_EPHEMERAL: "true",
    });

    expect(() => validateEnv()).not.toThrow();
  });

  it("accepts a fully configured production environment", () => {
    setEnv({ NODE_ENV: "production", ...studentEmailVars, ...productionVars });

    expect(() => validateEnv()).not.toThrow();
  });

  it("rejects a weak AUTH_SECRET in production", () => {
    setEnv({
      NODE_ENV: "production",
      ...studentEmailVars,
      ...productionVars,
      AUTH_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(() => validateEnv()).toThrow(/AUTH_SECRET/);
  });
});
