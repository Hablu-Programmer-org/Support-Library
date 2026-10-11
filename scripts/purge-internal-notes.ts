import path from "path";

import dotenv from "dotenv";

import { dbConnect } from "../lib/db";
import { buildIssueSearchTextWithReplies } from "../lib/search";
import { SupportIssueModel, SupportReplyModel } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm="))
  ?.slice("--confirm=".length);

/**
 * Removes the retired private-staff-note feature from the database.
 *
 * Private notes were ordinary `support_replies` documents flagged with
 * `isInternalNote: true`. Because there is no separate collection, the field must
 * not be dropped before the flagged documents are deleted: doing so would make the
 * notes render as normal, student-visible replies.
 *
 * Safe order enforced here: count -> abort on malformed values -> delete notes ->
 * unset the stale field from surviving public replies -> drop the obsolete index ->
 * rebuild issue search text.
 */
async function main() {
  await dbConnect();

  const databaseName = process.env.MONGODB_DB?.trim();
  if (!databaseName) throw new Error("MONGODB_DB is required");
  if (apply && confirmation !== databaseName) {
    throw new Error(`Refusing apply: pass --confirm=${databaseName} to confirm the target database`);
  }

  const collection = SupportReplyModel.collection;

  const [total, internal, publicCount, missing, nonBoolean] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ isInternalNote: true }),
    collection.countDocuments({ isInternalNote: false }),
    collection.countDocuments({ isInternalNote: { $exists: false } }),
    collection.countDocuments({ isInternalNote: { $exists: true, $not: { $type: "bool" } } }),
  ]);

  console.info(`[internal-notes] database: ${databaseName}`);
  console.info(
    `[internal-notes] total=${total} internal=${internal} public=${publicCount} missing=${missing} nonBoolean=${nonBoolean}`,
  );

  if (nonBoolean > 0) {
    throw new Error("Aborting: found replies with a non-boolean isInternalNote value");
  }

  if (!apply) {
    console.info("[internal-notes] dry run only; pass --apply to purge and clean up");
    process.exit(0);
  }

  if (internal > 0) {
    const deleted = await collection.deleteMany({ isInternalNote: true });
    console.info(`[internal-notes] deleted ${deleted.deletedCount} internal note(s)`);
  }

  const unset = await collection.updateMany(
    { isInternalNote: { $exists: true } },
    { $unset: { isInternalNote: "" } },
  );
  console.info(`[internal-notes] unset stale field on ${unset.modifiedCount} reply(ies)`);

  const indexes = await collection.indexes();
  const leftoverIndex = indexes.find(
    (index) => Object.keys(index.key).length === 1 && "isInternalNote" in index.key,
  );
  if (leftoverIndex?.name) {
    await collection.dropIndex(leftoverIndex.name);
    console.info(`[internal-notes] dropped index ${leftoverIndex.name}`);
  }

  const issueIds = await collection.distinct("issueId");
  let rebuilt = 0;
  for (const issueId of issueIds) {
    const supportIssue = await SupportIssueModel.findById(issueId).lean();
    if (!supportIssue) continue;

    const replies = await collection
      .find({ issueId, deletedAt: null })
      .project({ body: 1 })
      .toArray();

    await SupportIssueModel.updateOne(
      { _id: issueId },
      {
        $set: {
          searchText: buildIssueSearchTextWithReplies(
            {
              title: supportIssue.title,
              studentName: supportIssue.studentName,
              question: supportIssue.question,
              courseSlug: supportIssue.courseSlug,
              moduleSlug: supportIssue.moduleSlug,
              contentSlug: supportIssue.contentSlug,
              tags: supportIssue.tags,
            },
            replies.map((reply) => String(reply.body)),
          ),
        },
      },
    );
    rebuilt += 1;
  }
  console.info(`[internal-notes] rebuilt search text for ${rebuilt} issue(s)`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[internal-notes] migration failed", error);
  process.exit(1);
});
