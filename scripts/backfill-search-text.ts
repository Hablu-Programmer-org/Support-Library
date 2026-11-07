import path from "path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { buildSearchFieldUpdate } from "../lib/search-index-build";
import { SupportIssueModel, SupportReplyModel, UserModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

export function parseBackfillFlags(argv: string[] = process.argv) {
  return {
    apply: argv.includes("--apply"),
    verify: argv.includes("--verify"),
    confirmation: argv
      .find((argument) => argument.startsWith("--confirm="))
      ?.slice("--confirm=".length),
  };
}

const { apply, verify, confirmation } = parseBackfillFlags();
const BATCH = 200;

type Counters = {
  scanned: number;
  searchTextChanged: number;
  publicSearchTextChanged: number;
  missingPublicSearchText: number;
  withoutReplies: number;
};

const emptyCounters = (): Counters => ({
  scanned: 0,
  searchTextChanged: 0,
  publicSearchTextChanged: 0,
  missingPublicSearchText: 0,
  withoutReplies: 0,
});

/**
 * Rebuilds `searchText` (staff) and `publicSearchText` (student) from the source
 * documents.
 *
 * `timestamps: false` is deliberate: `updatedAt` drives the default queue order
 * and the optimistic revision, so a maintenance backfill must not look like 217
 * staff edits. The text itself is rebuilt by the same pure builder the live write
 * path uses, so a second run reports zero drift.
 */
async function run(applyWrites: boolean) {
  const counters = emptyCounters();
  let cursor: unknown = null;

  for (;;) {
    const query: Record<string, unknown> = cursor ? { _id: { $gt: cursor } } : {};
    const issues = await SupportIssueModel.find(query)
      .select(
        "_id title question studentName batchNo courseSlug moduleSlug contentSlug tags videoLinks uploads searchText publicSearchText",
      )
      .sort({ _id: 1 })
      .limit(BATCH)
      .lean();
    if (!issues.length) break;

    const issueIds = issues.map((issue) => issue._id);
    const replies = await SupportReplyModel.find({
      issueId: { $in: issueIds },
      deletedAt: null,
    })
      .select("issueId body isStaffReply authorId videoLinks uploads")
      .lean();

    const authorIds = [
      ...new Set(replies.map((reply) => String((reply as { authorId?: unknown }).authorId ?? ""))),
    ].filter(Boolean);
    const authors = authorIds.length
      ? await UserModel.find({ _id: { $in: authorIds } })
          .select("role")
          .lean()
      : [];
    const roleById = new Map(
      authors.map((author) => [String(author._id), String(author.role ?? "")]),
    );

    const repliesByIssue = new Map<string, typeof replies>();
    for (const reply of replies) {
      const key = String((reply as { issueId?: unknown }).issueId ?? "");
      const list = repliesByIssue.get(key) ?? [];
      list.push(reply);
      repliesByIssue.set(key, list);
    }

    const operations: Parameters<typeof SupportIssueModel.bulkWrite>[0] = [];
    for (const issue of issues) {
      counters.scanned += 1;
      const thread = repliesByIssue.get(String(issue._id)) ?? [];
      if (thread.length === 0) counters.withoutReplies += 1;

      const next = buildSearchFieldUpdate(issue, thread, roleById);
      const storedPublic = String((issue as { publicSearchText?: unknown }).publicSearchText ?? "");
      if (!storedPublic) counters.missingPublicSearchText += 1;

      const searchTextChanged = String(issue.searchText ?? "") !== next.searchText;
      const publicSearchTextChanged = storedPublic !== next.publicSearchText;
      if (searchTextChanged) counters.searchTextChanged += 1;
      if (publicSearchTextChanged) counters.publicSearchTextChanged += 1;

      if (searchTextChanged || publicSearchTextChanged) {
        operations.push({
          updateOne: {
            filter: { _id: issue._id },
            update: { $set: next },
          },
        });
      }
    }

    if (applyWrites && operations.length) {
      await SupportIssueModel.bulkWrite(operations, { ordered: false, timestamps: false });
    }

    cursor = issues.at(-1)?._id;
    if (issues.length < BATCH) break;
  }

  return counters;
}

/**
 * Independent verification pass: recompute every document and compare, so a
 * partially applied backfill cannot pass silently.
 */
async function verifyAll() {
  const counters = emptyCounters();
  let mismatches = 0;
  let cursor: unknown = null;

  for (;;) {
    const query: Record<string, unknown> = cursor ? { _id: { $gt: cursor } } : {};
    const issues = await SupportIssueModel.find(query)
      .select(
        "_id title question studentName batchNo courseSlug moduleSlug contentSlug tags videoLinks uploads searchText publicSearchText",
      )
      .sort({ _id: 1 })
      .limit(BATCH)
      .lean();
    if (!issues.length) break;

    const issueIds = issues.map((issue) => issue._id);
    const replies = await SupportReplyModel.find({
      issueId: { $in: issueIds },
      deletedAt: null,
    })
      .select("issueId body isStaffReply authorId videoLinks uploads")
      .lean();
    const authorIds = [
      ...new Set(replies.map((reply) => String((reply as { authorId?: unknown }).authorId ?? ""))),
    ].filter(Boolean);
    const authors = authorIds.length
      ? await UserModel.find({ _id: { $in: authorIds } })
          .select("role")
          .lean()
      : [];
    const roleById = new Map(
      authors.map((author) => [String(author._id), String(author.role ?? "")]),
    );
    const repliesByIssue = new Map<string, typeof replies>();
    for (const reply of replies) {
      const key = String((reply as { issueId?: unknown }).issueId ?? "");
      const list = repliesByIssue.get(key) ?? [];
      list.push(reply);
      repliesByIssue.set(key, list);
    }

    for (const issue of issues) {
      const expected = buildSearchFieldUpdate(
        issue,
        repliesByIssue.get(String(issue._id)) ?? [],
        roleById,
      );
      const storedPublic = String((issue as { publicSearchText?: unknown }).publicSearchText ?? "");
      if (String(issue.searchText ?? "") !== expected.searchText) mismatches += 1;
      if (storedPublic !== expected.publicSearchText) mismatches += 1;
      counters.scanned += 1;
    }

    cursor = issues.at(-1)?._id;
    if (issues.length < BATCH) break;
  }

  return { ...counters, mismatches };
}

async function main() {
  if (apply && verify) throw new Error("Use --verify separately from --apply");
  await dbConnect();

  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }

  if (verify) {
    const result = await verifyAll();
    console.info(`[search-text] verify database=${databaseName}`, result);
    if (result.mismatches > 0) process.exitCode = 1;
    return;
  }

  console.info(`[search-text] database=${databaseName}; mode=${apply ? "apply" : "dry-run"}`);
  const result = await run(apply);
  console.info("[search-text] result", result);
  if (!apply) {
    console.info(`[search-text] dry run only; apply with --apply --confirm=${databaseName}`);
  }
}

/**
 * Runs only when executed as the script itself (`tsx scripts/...`), never when
 * imported by a test — so the flag parser above stays unit-testable.
 */
const isDirectRun =
  process.argv[1]?.replace(/\\/g, "/").endsWith("backfill-search-text.ts") ?? false;

if (isDirectRun) {
  main()
    .then(async () => {
      await mongoose.connection.close();
      process.exit(process.exitCode ?? 0);
    })
    .catch((error) => {
      console.error("[search-text] failed", error);
      process.exit(1);
    });
}
