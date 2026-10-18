import { defineConfig, devices } from "@playwright/test";

import { resolveE2EDatabase } from "./e2e/fixtures/test-db";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:12000";
process.env.AUTH_SECRET ??= "E2E-only_A7f3kP9xQ2mN8vR5tY1wL6sD4hJ0cB!2026";
process.env.AUTH_URL = baseURL;

// Pin E2E to a dedicated database so a run never writes into the dev database,
// and so global teardown resolves the same name from either loader context.
const { devDb, testDb } = resolveE2EDatabase();
process.env.MONGODB_DEV_DB = devDb ?? "";
process.env.MONGODB_TEST_DB = testDb;
process.env.MONGODB_DB = testDb;
process.env.LMS_MONGODB_URI = process.env.MONGODB_URI;
// hp-v2 lookups (login + case autocomplete) read LMS_MONGODB_DB. Pin it to the
// throwaway e2e database too, so no test ever touches the real hp-v2 data.
process.env.LMS_MONGODB_DB = testDb;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    // A reused server would keep the database it booted with, which would break
    // the isolation guarantee above. Always boot a fresh one.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MONGODB_DB: testDb,
      LMS_MONGODB_URI: process.env.MONGODB_URI ?? "",
      MONGODB_TEST_DB: testDb,
      MONGODB_DEV_DB: devDb ?? "",
      LMS_MONGODB_DB: testDb,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_URL: baseURL,
      // Pinned rather than inherited so the student-only "My Courses" link
      // renders the same in CI and on a developer machine — a stale
      // .env.local must not silently hide it from the E2E contract.
      NEXT_PUBLIC_LMS_URL: "https://www.hablu-programmer.com",
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
