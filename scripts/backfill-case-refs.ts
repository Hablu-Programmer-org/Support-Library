import path from "path";

import dotenv from "dotenv";

import { CASE_REF_COUNTER_ID, formatCaseRef } from "../lib/config/live-support";
import { dbConnect } from "../lib/db";
import { CounterModel, SupportIssueModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/**
 * Renumber every issue into the sequential `000001`, `000002`, … scheme.
 *
 * Ordering is `createdAt` ascending (ties broken by `_id`), so the oldest request
 * gets the smallest number and the counter ends at the newest. Re-running is
 * idempotent: the same ordering produces the same numbers, and issues created
 * since the last run already sit at the end of the sequence.
 *
 * Dry-run by default; `--apply` needs the exact database name.
 */
const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

const BATCH = 500;

async function main() {
  await dbConnect();

  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }

  const total = await SupportIssueModel.countDocuments({});
  console.info(`[case-ref] database: ${databaseName}`);
  console.info(`[case-ref] ${total} issue(s) to number`);

  let sequence = 0;
  let changed = 0;
  let cursor: unknown = null;

  for (;;) {
    // `_id` is appended as a tie-breaker so two issues created in the same
    // millisecond still have a stable order.
    const query: Record<string, unknown> = cursor ? { _id: { $gt: cursor } } : {};
    const batch = await SupportIssueModel.find(query, "_id caseRef")
      .sort({ _id: 1 })
      .limit(BATCH)
      .lean();
    if (batch.length === 0) break;

    const operations = [];
    for (const issue of batch) {
      sequence += 1;
      const expected = formatCaseRef(sequence);
      if (issue.caseRef !== expected) {
        operations.push({
          updateOne: {
            filter: { _id: issue._id },
            update: { $set: { caseRef: expected } },
          },
        });
      }
    }

    if (operations.length > 0) {
      if (apply) {
        const result = await SupportIssueModel.bulkWrite(operations, {
          ordered: false,
          // A display value must not bump `updatedAt` and invalidate staff revisions.
          timestamps: false,
        });
        changed += result.modifiedCount;
      } else {
        changed += operations.length;
      }
    }

    cursor = batch[batch.length - 1]._id;
    console.info(`[case-ref] scanned ${sequence} issue(s), ${changed} to change`);
    if (batch.length < BATCH) break;
  }

  console.info(`[case-ref] last reference: ${formatCaseRef(sequence)}`);

  if (!apply) {
    console.info("[case-ref] dry run only; pass --apply to write the references and the counter");
    process.exit(0);
  }

  await CounterModel.updateOne(
    { _id: CASE_REF_COUNTER_ID },
    { $set: { seq: sequence } },
    { upsert: true },
  );
  console.info(`[case-ref] updated ${changed} issue(s); counter set to ${sequence}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[case-ref] migration failed", error);
  process.exit(1);
});
