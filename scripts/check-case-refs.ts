import path from "path";

import dotenv from "dotenv";

import { CASE_REF_COUNTER_ID } from "../lib/config/live-support";
import { dbConnect } from "../lib/db";
import { CounterModel, SupportIssueModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

/**
 * Read-only health check for request references. Never writes.
 *
 * Run before the `case_ref_unique` index is created (it fails on duplicates) and
 * before relying on references in issue URLs:
 * - issues without a reference (they keep an `_id` URL until filled);
 * - duplicate references (would break the unique index and URL lookup);
 * - the counter must sit at or above the highest reference, or the next create
 *   would hand out a number that already exists.
 */
async function main() {
  await dbConnect();
  const databaseName = process.env.MONGODB_DB?.trim();

  const [total, missing, duplicates, highest, counter] = await Promise.all([
    SupportIssueModel.countDocuments({}),
    SupportIssueModel.countDocuments({ $or: [{ caseRef: null }, { caseRef: { $exists: false } }] }),
    SupportIssueModel.aggregate<{ _id: string; count: number }>([
      { $match: { caseRef: { $type: "string" } } },
      { $group: { _id: "$caseRef", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 50 },
    ]),
    SupportIssueModel.findOne({ caseRef: { $type: "string" } }, "caseRef")
      .sort({ caseRef: -1 })
      .lean(),
    CounterModel.findOne({ _id: CASE_REF_COUNTER_ID }).lean(),
  ]);

  const highestRef = (highest?.caseRef as string | undefined) ?? null;
  const counterSeq = typeof counter?.seq === "number" ? counter.seq : null;
  const counterBehind = highestRef !== null && (counterSeq ?? 0) < Number(highestRef);

  console.info(`[case-ref:check] database: ${databaseName}`);
  console.info(`[case-ref:check] issues: ${total}`);
  console.info(`[case-ref:check] without reference: ${missing}`);
  console.info(`[case-ref:check] duplicate references: ${duplicates.length}`);
  for (const duplicate of duplicates) {
    console.info(`  ${duplicate._id} × ${duplicate.count}`);
  }
  console.info(`[case-ref:check] highest reference: ${highestRef ?? "none"}`);
  console.info(`[case-ref:check] counter: ${counterSeq ?? "missing"}${counterBehind ? "  <-- BEHIND" : ""}`);

  const ok = duplicates.length === 0 && !counterBehind;
  console.info(`[case-ref:check] ${ok ? "OK" : "PROBLEM"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("[case-ref:check] failed", error);
  process.exit(1);
});
