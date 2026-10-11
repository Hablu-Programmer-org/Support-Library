import { defineConfig, devices } from "@playwright/test";

import { resolveE2EDatabase } from "./e2e/fixtures/test-db";

const baseURL = "http://127.0.0.1:12001";
process.env.AUTH_URL = baseURL;
process.env.NEXTAUTH_URL = baseURL;

const { devDb, testDb } = resolveE2EDatabase();
process.env.MONGODB_DEV_DB = devDb ?? "";
process.env.MONGODB_TEST_DB = testDb;
process.env.MONGODB_DB = testDb;
process.env.LMS_MONGODB_URI = process.env.MONGODB_URI;
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
    command: "npm run start:standalone",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MONGODB_DB: testDb,
      LMS_MONGODB_URI: process.env.MONGODB_URI ?? "",
      MONGODB_TEST_DB: testDb,
      MONGODB_DEV_DB: devDb ?? "",
      LMS_MONGODB_DB: testDb,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "12001",
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
