#!/usr/bin/env node
/**
 * Data-preserving migration for the kebab-case model rename (2026-10-16).
 *
 * The support-library collections were renamed (`staff_users` → `staff-users`,
 * …). The document data is NOT lost by the code change, but the application now
 * reads the new (kebab) collection names, so the existing data must be moved.
 *
 * This script RENAMES the old collections in place (no data loss). It never
 * drops data and never touches the external LMS collections (`User`, `hp-v2`) or
 * the NextAuth adapter collections (`users`, `accounts`).
 *
 * Safety:
 *   - only touches databases whose name contains `support_library`;
 *   - dry-run by default — pass `--apply` to execute;
 *   - a rename is skipped when the source does not exist, and refused when the
 *     destination already exists (so it is safe to re-run).
 *
 * Usage:
 *   node scripts/migrate-rename-collections.mjs            # dry run
 *   node scripts/migrate-rename-collections.mjs --apply    # execute
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(".env.local") });

const APPLY = process.argv.includes("--apply");

const RENAMES = [
  ["staff_users", "staff-users"],
  ["support_issues", "support-issues"],
  ["support_replies", "support-replies"],
  ["audit_events", "audit-events"],
  ["rate_limit_buckets", "rate-limit-buckets"]
];

const main = async () => {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB;

  if (!uri || !database) {
    throw new Error("MONGODB_URI / MONGODB_DB missing. Copy .env.example to .env.local.");
  }

  if (!database.includes("support_library")) {
    throw new Error(`Refusing to touch database '${database}'. Expected a *support_library* database.`);
  }

  const connection = await mongoose.createConnection(uri, { dbName: database }).asPromise();
  const db = connection.db;

  console.log(`Database: ${database}`);
  console.log(APPLY ? "Mode: APPLY\n" : "Mode: DRY RUN (pass --apply to execute)\n");

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const [from, to] of RENAMES) {
    if (!existing.has(from)) {
      console.log(`  skip  ${from} → ${to}  (source absent)`);
      continue;
    }
    if (existing.has(to)) {
      console.log(`  SKIP  ${from} → ${to}  (destination already exists — resolve manually)`);
      continue;
    }

    const count = await db.collection(from).estimatedDocumentCount();
    console.log(`  ${APPLY ? "rename" : "would rename"}  ${from} → ${to}  (~${count} docs)`);

    if (APPLY) {
      await db.collection(from).rename(to);
    }
  }

  await connection.close();
  await mongoose.disconnect();
  console.log(APPLY ? "\nMigration applied." : "\nRe-run with --apply to execute.");
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
