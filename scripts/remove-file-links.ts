/**
 * Removes the retired `fileLinks` field from support issues and replies.
 *
 * Default mode is dry-run. Apply is intentionally destructive and requires both
 * `--confirm=<MONGODB_DB>` and `--backup-acknowledged`. Re-running the command is
 * safe because it only targets documents where the field still exists.
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const apply = process.argv.includes("--apply");
const backupAcknowledged = process.argv.includes("--backup-acknowledged");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

function redactMongoUri(uri: string) {
  return uri
    .replace(/\/\/[^/@]+@/, "//***:***@")
    .replace(/\?.*$/, "?<redacted>");
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }
  if (apply && !backupAcknowledged) {
    throw new Error("Refusing apply without --backup-acknowledged");
  }

  console.info(`[remove-file-links] target=${redactMongoUri(uri)} database=${databaseName}`);
  console.info(`[remove-file-links] mode=${apply ? "APPLY" : "DRY RUN"}`);
  console.info("[remove-file-links] rollback: restore the pre-apply mongodump");

  await mongoose.connect(uri, { dbName: databaseName });
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection did not expose a database handle");

  const targets = [
    { label: "issues", collection: database.collection("support-issues") },
    { label: "replies", collection: database.collection("support-replies") },
  ];

  let totalMatched = 0;
  let totalModified = 0;
  for (const target of targets) {
    const filter = { fileLinks: { $exists: true } };
    const matched = await target.collection.countDocuments(filter);
    totalMatched += matched;

    let modified = 0;
    if (apply && matched > 0) {
      const result = await target.collection.updateMany(filter, { $unset: { fileLinks: "" } });
      modified = result.modifiedCount;
      if (result.matchedCount !== matched || modified !== matched) {
        throw new Error(
          `${target.label} changed during migration: expected=${matched} matched=${result.matchedCount} modified=${modified}`,
        );
      }
    }
    totalModified += modified;
    console.info(`[remove-file-links] ${target.label}: matched=${matched} modified=${modified}`);
  }

  console.info(`[remove-file-links] summary matched=${totalMatched} modified=${totalModified}`);
  if (!apply) {
    console.info(
      `[remove-file-links] dry run only; after taking a backup, pass --apply --confirm=${databaseName} --backup-acknowledged`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[remove-file-links] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
