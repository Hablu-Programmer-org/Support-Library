import { expect, test } from "@playwright/test";
import path from "node:path";

import { getLmsMongoClient } from "../lib/lms-db";
import { STAFF_USERS } from "./fixtures/staff-users";

const admin = STAFF_USERS.find((user) => user.role === "ADMIN");
if (!admin) throw new Error("Admin E2E fixture is missing");

test.describe("LMS authorization freshness", () => {
  test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

  test("applies an LMS role demotion to an existing session", async ({ page }) => {
    const client = await getLmsMongoClient();
    const dbName = process.env.LMS_MONGODB_DB;
    if (!dbName) throw new Error("LMS_MONGODB_DB is missing");
    const users = client.db(dbName).collection("User");

    try {
      await users.updateOne({ email: admin.email }, { $set: { role: "STUDENT" } });

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const navigated = page
          .waitForURL(/\/dashboard\/issues\/new/, { timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        await page.goto("/dashboard/issues/new");
        if (await navigated) break;
      }

      // The demotion must reach the live session: the staff create form is no
      // longer offered, only the student self-service form.
      await expect(
        page.getByRole("heading", { name: "Submit a support request" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "New Support Issue" })).toHaveCount(0);

      // The staff dashboard stays off limits for a demoted account.
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard\/issues/);
    } finally {
      await users.updateOne({ email: admin.email }, { $set: { role: "ADMIN", isActive: true } });
    }
  });

  test("blocks an existing session after LMS deactivation", async ({ page }) => {
    const client = await getLmsMongoClient();
    const dbName = process.env.LMS_MONGODB_DB;
    if (!dbName) throw new Error("LMS_MONGODB_DB is missing");
    const users = client.db(dbName).collection("User");

    try {
      await users.updateOne({ email: admin.email }, { $set: { isActive: false } });
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/(login|unauthorized)/);
    } finally {
      await users.updateOne({ email: admin.email }, { $set: { role: "ADMIN", isActive: true } });
    }
  });
});
