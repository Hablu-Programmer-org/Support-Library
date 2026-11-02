import path from "path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import { deriveIssueReplyState, EFFECTIVE_STAFF_REPLY_EXPRESSION } from "../lib/reply-state";
import { SupportIssueModel, SupportReplyModel, UserModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);
const BATCH = 500;

async function backfillReplyKinds() {
  let scanned = 0;
  let changed = 0;
  let cursor: unknown = null;
  for (;;) {
    const query: Record<string, unknown> = {
      isStaffReply: { $exists: false },
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    };
    const replies = await SupportReplyModel.find(query).select("_id authorId").sort({ _id: 1 }).limit(BATCH).lean();
    if (!replies.length) break;
    const authorIds = [...new Set(replies.map((reply) => String(reply.authorId)))];
    const staff = await UserModel.find({ _id: { $in: authorIds }, role: { $in: ["ADMIN", "MENTOR"] } })
      .select("_id").lean();
    const staffIds = new Set(staff.map((user) => String(user._id)));
    const operations = replies.map((reply) => ({
      updateOne: {
        filter: { _id: reply._id, isStaffReply: { $exists: false } },
        update: { $set: { isStaffReply: staffIds.has(String(reply.authorId)) } },
      },
    }));
    if (apply) {
      const result = await SupportReplyModel.bulkWrite(operations, { ordered: false, timestamps: false });
      changed += result.modifiedCount;
    } else {
      changed += operations.length;
    }
    scanned += replies.length;
    cursor = replies.at(-1)?._id;
    if (replies.length < BATCH) break;
  }
  return { scanned, changed };
}

async function backfillIssues() {
  let scanned = 0;
  let changed = 0;
  let awaitingStaff = 0;
  let cursor: unknown = null;
  for (;;) {
    const query: Record<string, unknown> = cursor ? { _id: { $gt: cursor } } : {};
    const issues = await SupportIssueModel.find(query)
      .select("_id lastStaffReplyAt lastStudentReplyAt awaitingStaff")
      .sort({ _id: 1 }).limit(BATCH).lean();
    if (!issues.length) break;
    const issueIds = issues.map((issue) => issue._id);
    const summaries = await SupportReplyModel.aggregate<{
      _id: unknown;
      lastStaffReplyAt: Date | null;
      lastStudentReplyAt: Date | null;
    }>([
      { $match: { issueId: { $in: issueIds }, deletedAt: null } },
      { $lookup: { from: "staff-users", localField: "authorId", foreignField: "_id", as: "author" } },
      { $set: {
        effectiveStaff: {
          ...EFFECTIVE_STAFF_REPLY_EXPRESSION,
        },
      } },
      { $group: {
        _id: "$issueId",
        lastStaffReplyAt: { $max: { $cond: ["$effectiveStaff", "$createdAt", null] } },
        lastStudentReplyAt: { $max: { $cond: ["$effectiveStaff", null, "$createdAt"] } },
      } },
    ]);
    const byIssue = new Map(summaries.map((summary) => [String(summary._id), summary]));
    const operations = [];
    for (const issue of issues) {
      const summary = byIssue.get(String(issue._id));
      const state = deriveIssueReplyState(
        summary?.lastStaffReplyAt ?? null,
        summary?.lastStudentReplyAt ?? null,
      );
      if (state.awaitingStaff) awaitingStaff += 1;
      const differs = issue.awaitingStaff !== state.awaitingStaff
        || issue.lastStaffReplyAt?.getTime() !== state.lastStaffReplyAt?.getTime()
        || issue.lastStudentReplyAt?.getTime() !== state.lastStudentReplyAt?.getTime();
      if (differs) {
        operations.push({ updateOne: { filter: { _id: issue._id }, update: { $set: state } } });
      }
    }
    if (operations.length) {
      if (apply) {
        const result = await SupportIssueModel.bulkWrite(operations, { ordered: false, timestamps: false });
        changed += result.modifiedCount;
      } else {
        changed += operations.length;
      }
    }
    scanned += issues.length;
    cursor = issues.at(-1)?._id;
    if (issues.length < BATCH) break;
  }
  return { scanned, changed, awaitingStaff };
}

async function main() {
  await dbConnect();
  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }
  console.info(`[reply-state] database: ${databaseName}; mode: ${apply ? "apply" : "dry-run"}`);
  const replies = await backfillReplyKinds();
  const issues = await backfillIssues();
  console.info("[reply-state] replies", replies);
  console.info("[reply-state] issues", issues);
  if (!apply) console.info(`[reply-state] dry run only; apply with --apply --confirm=${databaseName}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[reply-state] migration failed", error);
  process.exit(1);
});
