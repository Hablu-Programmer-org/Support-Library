import path from "path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/**
 * Drop the old non-unique `case_ref` index on `support-issues`.
 *
 * It was replaced by `case_ref_unique` (same key, unique + partial). `db:indexes`
 * only creates, never drops, so the old one stays behind until this runs.
 *
 * Order: `npm run db:check-case-refs` → `npm run db:indexes -- --apply --create-only`
 * → this script. It refuses to drop while `case_ref_unique` is missing, so the
 * reference lookup is never left without an index.
 *
 * Dry-run by default; `--apply --confirm=<MONGODB_DB>` to drop. Idempotent: a
 * second run finds nothing to drop. Rollback: re-create with
 * `db.getCollection("support-issues").createIndex({ caseRef: 1 }, { name: "case_ref" })`.
 */
const LEGACY_NAME = "case_ref";
const REPLACEMENT_NAME = "case_ref_unique";

const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

async function main() {
  await dbConnect();

  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }

  const indexes = await SupportIssueModel.collection.indexes();
  const names = new Set(indexes.map((index) => index.name));
  console.info(`[case-ref-index] database: ${databaseName}`);
  console.info(`[case-ref-index] ${REPLACEMENT_NAME}: ${names.has(REPLACEMENT_NAME) ? "present" : "MISSING"}`);
  console.info(`[case-ref-index] ${LEGACY_NAME}: ${names.has(LEGACY_NAME) ? "present (to drop)" : "absent"}`);

  if (!names.has(LEGACY_NAME)) {
    console.info("[case-ref-index] nothing to drop");
    process.exit(0);
  }
  if (!names.has(REPLACEMENT_NAME)) {
    throw new Error(`Refusing: create ${REPLACEMENT_NAME} first (npm run db:indexes -- --apply --create-only)`);
  }
  if (!apply) {
    console.info("[case-ref-index] dry run only; pass --apply --confirm=<db> to drop");
    process.exit(0);
  }

  await SupportIssueModel.collection.dropIndex(LEGACY_NAME);
  console.info(`[case-ref-index] dropped ${LEGACY_NAME}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[case-ref-index] failed", error);
  process.exit(1);
});
