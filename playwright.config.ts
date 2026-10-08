import { defineConfig, devices } from "@playwright/test";

import { resolveE2EDatabase } from "./e2e/fixtures/test-db";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
process.env.AUTH_URL = baseURL;
process.env.NEXTAUTH_URL = baseURL;

// Pin E2E to a dedicated database so a run never writes into the dev database,
// and so global teardown resolves the same name from either loader context.
const { devDb, testDb } = resolveE2EDatabase();
process.env.MONGODB_DEV_DB = devDb ?? "";
process.env.MONGODB_TEST_DB = testDb;
process.env.MONGODB_DB = testDb;
// hp-v2 lookups (login + case autocomplete) read LMS_MONGODB_DB. Pin it to the
// throwaway e2e database too, so no test ever touches the real hp-v2 data.
process.env.LMS_MONGODB_DB = testDb;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: baseURL,
    // A reused server would keep the database it booted with, which would break
    // the isolation guarantee above. Always boot a fresh one.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MONGODB_DB: testDb,
      MONGODB_TEST_DB: testDb,
      MONGODB_DEV_DB: devDb ?? "",
      LMS_MONGODB_DB: testDb,
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