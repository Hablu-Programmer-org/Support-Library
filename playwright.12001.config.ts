import { defineConfig, devices } from "@playwright/test";

import { resolveE2EDatabase } from "./e2e/fixtures/test-db";

const baseURL = "http://127.0.0.1:12001";
process.env.AUTH_SECRET ??= "E2E-only_A7f3kP9xQ2mN8vR5tY1wL6sD4hJ0cB!2026";
process.env.AUTH_URL = baseURL;

const { devDb, testDb } = resolveE2EDatabase();
process.env.MONGODB_DEV_DB = devDb ?? "";
process.env.MONGODB_TEST_DB = testDb;
process.env.MONGODB_DB = testDb;
process.env.LMS_MONGODB_URI = process.env.MONGODB_URI;
process.env.LMS_MONGODB_DB = testDb;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start:standalone",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "12001",
MONGODB_URI: process.env.MONGODB_URI ?? "",
      MONGODB_DB: testDb,
      LMS_MONGODB_URI: process.env.MONGODB_URI ?? "",
      MONGODB_TEST_DB: testDb,
      MONGODB_DEV_DB: devDb ?? "",
      LMS_MONGODB_DB: testDb,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: "true",
      AUTH_GOOGLE_ID: "e2e.invalid.apps.googleusercontent.com",
      AUTH_GOOGLE_SECRET: "e2e-only-placeholder",
      TRUSTED_PROXY_HOPS: "1",
      STUDENT_EMAIL_KEY_VERSION: "v1",
      STUDENT_EMAIL_ENCRYPTION_KEYS: "v1:ezMkYRRrMWFYEPJtuOpRHGOpVV2Qm6wJy83CjIzf6q4=",
      STUDENT_EMAIL_LOOKUP_KEYS: "v1:xuWpNME8qkz3rrhdE3y+pCa5AJP0zI8HPg98MyzxPdg=",
    },
  },
  projects: [
    { name: "setup", testMatch: /.*\.fixtures\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
