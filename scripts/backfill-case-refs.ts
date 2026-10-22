import path from "path";

import dotenv from "dotenv";

import { caseRefFor } from "../lib/config/live-support";
import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/**
 * Fill `caseRef` on issues created before the field existed.
 *
 * The six-digit reference is derived from the issue id, so this only stores a
 * value the API already computes on the fly — it makes the reference searchable
 * (`/dashboard/issues?q=274819`) without changing what a student sees.
 *
 * Dry-run by default; `--apply` requires the exact database name.
 */
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

  const filter = { caseRef: null };
  const total = await SupportIssueModel.countDocuments(filter);
  console.info(`[case-ref] database: ${databaseName}`);
  console.info(`[case-ref] ${total} issue(s) without a reference`);

  if (!apply) {
    console.info("[case-ref] dry run only; pass --apply to write the references");
    process.exit(0);
  }

  // Bounded batches keep memory flat and let an interrupted run resume: the next
  // invocation simply picks up the rows that still have no reference.
  let updated = 0;
  for (;;) {
    const batch = await SupportIssueModel.find(filter, "_id").limit(500).lean();
    if (batch.length === 0) break;

    const result = await SupportIssueModel.bulkWrite(
      batch.map((issue) => ({
        updateOne: {
          filter: { _id: issue._id, caseRef: null },
          update: { $set: { caseRef: caseRefFor(String(issue._id)) } },
        },
      })),
      // A derived display field must not bump `updatedAt` and invalidate staff revisions.
      { ordered: false, timestamps: false },
    );

    updated += result.modifiedCount;
    console.info(`[case-ref] batch done: ${batch.length} read, ${result.modifiedCount} updated`);
    if (batch.length < 500) break;
  }

  console.info(`[case-ref] updated ${updated} issue(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[case-ref] backfill failed", error);
  process.exit(1);
});
