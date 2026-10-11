import { test as setup } from "@playwright/test";
import mongoose from "mongoose";

import { getLmsMongoClient } from "../../lib/lms-db";

/**
 * Seeds the hp-v2 `User` collection inside the dedicated e2e database.
 *
 * LMS_MONGODB_DB is pinned to the same test database (see playwright.config.ts),
 * so this fixture is the only writer those lookups ever see. global-teardown
 * clears every collection in the test database afterwards.
 */
const LMS_FIXTURE_USER = {
  userId: "e2e-lms-1001",
  email: "e2e.lms.student@test.com",
  name: "E2E LMS Student",
  role: "STUDENT",
  image: null,
  isActive: true,
};

setup("seed hp-v2 style user for LMS lookups", async () => {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) throw new Error("MONGODB_DB is missing; cannot target the e2e database");

  const client = await getLmsMongoClient();
  // Always name the db explicitly: a nameless client.db() falls back to the
  // database in the MONGODB_URI path, which is not the e2e database.
  await client.db(dbName).collection("User").updateOne(
    { email: LMS_FIXTURE_USER.email },
    {
      $set: { ...LMS_FIXTURE_USER },
      $setOnInsert: {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
});
