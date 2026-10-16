/**
 * Removes E2E artifacts from a database that Playwright wrote to before the
 * dedicated test database (`MONGODB_TEST_DB`) was wired up.
 *
 * Every filter is anchored on patterns the fixtures themselves generate, so real
 * data is never matched. Next-auth adapter collections (`users`, `accounts`,
 * `sessions`) are intentionally left untouched.
 *
 * Dry run by default:
 *   npm run clean:e2e-artifacts
 *   npm run clean:e2e-artifacts -- --apply
 */
import path from "path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { STAFF_FIXTURE_EMAILS } from "../e2e/fixtures/staff-users";

dotenv.config({ path: path.resolve(".env.local") });

const APPLY = process.argv.includes("--apply");

const E2E_TITLE_PREFIX = /^E2E /;

type Plan = {
  collection: string;
  filter: Record<string, unknown>;
  label: string;
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Copy .env.example to .env.local.");

  const conn = await mongoose
    .createConnection(uri, {
      dbName: process.env.MONGODB_DB,
      serverSelectionTimeoutMS: 10_000,
    })
    .asPromise();
  const db = conn.db!;

  // Resolve child records first so their parents can be matched by id.
  const e2eIssues = await db
    .collection("support-issues")
    .find({ title: E2E_TITLE_PREFIX }, { projection: { _id: 1 } })
    .toArray();

  const issueIds = e2eIssues.map((doc) => doc._id);

  const plans: Plan[] = [
    {
      collection: "support-replies",
      filter: issueIds.length ? { issueId: { $in: issueIds } } : { issueId: { $in: [] } },
      label: "replies on E2E issues",
    },
    {
      collection: "support-issues",
      filter: { title: E2E_TITLE_PREFIX },
      label: "issues titled 'E2E ...'",
    },
    {
      collection: "staff-users",
      filter: { email: { $in: STAFF_FIXTURE_EMAILS } },
      label: "Playwright fixture staff users",
    },
  ];

  console.log(`Database: ${process.env.MONGODB_DB}`);
  console.log(APPLY ? "Mode: APPLY\n" : "Mode: DRY RUN (pass --apply to delete)\n");

  let total = 0;
  for (const { collection, filter, label } of plans) {
    const count = await db.collection(collection).countDocuments(filter);
    total += count;
    console.log(`  ${String(count).padStart(4)}  ${collection.padEnd(20)} ${label}`);

    if (APPLY && count > 0) {
      await db.collection(collection).deleteMany(filter);
    }
  }

  console.log(`\n${APPLY ? "Deleted" : "Would delete"} ${total} document(s).`);
  await conn.close();
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});