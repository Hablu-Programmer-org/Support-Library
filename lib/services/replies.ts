import "server-only";

import mongoose, { type ClientSession } from "mongoose";

import { dbConnect } from "@/lib/db";
import { mutationRequestHash, operationIdSchema } from "@/lib/mutation-security";
import { isAdmin, type UserRole } from "@/lib/roles";
import { buildIssueSearchTextWithReplies } from "@/lib/search";
import { recordAuditEvent } from "@/lib/services/audit";
import { settleReplayedUploads, toAttachmentViews, type AttachmentView } from "@/lib/services/attachments";
import { getRequestContext } from "@/lib/request-context";
import { discardUploads, type IngestedUpload } from "@/lib/uploads/ingest";
import { supportReplyInputSchema, type SupportReplyInput } from "@/lib/validation";
import { SupportIssueModel, SupportReplyModel, UserModel } from "@/models";

type LeanDoc = Record<string, unknown>;

export type SupportReplyListItem = {
  id: string;
  issueId: string;
  authorId: string;
  authorName?: string;
  body: string;
  videoLinks: Array<{ title: string; url: string; timestamp?: string | null; summary?: string | null }>;
  uploads: AttachmentView[];
  createdAt?: Date;
  updatedAt?: Date;
  editedAt?: Date | null;
};

const toReplyListItem = (reply: LeanDoc, authors: Map<string, LeanDoc> = new Map()): SupportReplyListItem => {
  const authorId = String(reply.authorId);
  const author = authors.get(authorId);

  return {
    id: String(reply._id),
    issueId: String(reply.issueId),
    authorId,
    authorName: author?.name as string | undefined,
    body: String(reply.body),
    videoLinks: Array.isArray(reply.videoLinks) ? reply.videoLinks as SupportReplyListItem["videoLinks"] : [],
    uploads: toAttachmentViews(reply.uploads),
    createdAt: reply.createdAt as Date | undefined,
    updatedAt: reply.updatedAt as Date | undefined,
    editedAt: reply.editedAt as Date | null | undefined,
  };
};

async function buildAuthorMap(replies: LeanDoc[]) {
  const ids = [...new Set(replies.map((reply) => String(reply.authorId)).filter(Boolean))];
  if (!ids.length) return new Map<string, LeanDoc>();

  const authors = await UserModel.find({ _id: { $in: ids } }).select("name").lean();
  return new Map(authors.map((author) => [String(author._id), author as LeanDoc]));
}

/**
 * Rebuilds an issue's denormalized `searchText` from its own fields plus every
 * non-deleted reply body.
 *
 * This recomputes from the issue's fields instead of appending to the stored value
 * with an aggregation pipeline. The earlier pipeline concatenated only
 * `$title`/`$question`/`$tags`, which silently dropped
 * courseSlug/moduleSlug/contentSlug as soon as a reply existed, and left stale
 * reply text behind once the last public reply was removed.
 */
async function refreshIssueReplySearchText(issueId: string, session: ClientSession) {
  const [supportIssue, replies] = await Promise.all([
    SupportIssueModel.findById(issueId).session(session).lean(),
    SupportReplyModel.find({ issueId, deletedAt: null })
      .select("body")
      .session(session)
      .lean(),
  ]);
  if (!supportIssue) return;

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
          replies.map((reply) => reply.body),
        ),
      },
    },
  ).session(session);
}

async function requireLiveIssue(issueId: string, session: ClientSession) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) return null;
  return SupportIssueModel.findOne({ _id: issueId, deletedAt: null })
    .select("_id")
    .session(session)
    .lean();
}

async function requirePublicationReview(issueId: string, actorId: string, session: ClientSession) {
  const supportIssue = await SupportIssueModel.findOneAndUpdate(
    { _id: issueId, deletedAt: null },
    {
      $set: {
        visibility: "INTERNAL",
        publishedAt: null,
        publishedBy: null,
        updatedBy: new mongoose.Types.ObjectId(actorId),
      },
      $push: {
        publicationHistory: {
          action: "PUBLIC_REPLY_CHANGED",
          actorId: new mongoose.Types.ObjectId(actorId),
          at: new Date(),
        },
      },
    },
    { new: true, runValidators: true, session },
  ).lean();
  if (!supportIssue) throw new Error("Issue not found");
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function addReply(
  input: SupportReplyInput,
  authorId: string,
  operationId: string,
  uploads: IngestedUpload[] = [],
) {
  const parsed = supportReplyInputSchema.parse(input);
  const parsedOperationId = operationIdSchema.parse(operationId);
  // Uploads stay out of the hash: object keys are server-generated, so a retry
  // that carries the same client payload must still be recognized as a replay.
  const requestHash = mutationRequestHash({ input: parsed });
  await dbConnect();
  const authorObjectId = new mongoose.Types.ObjectId(authorId);

  const existing = await SupportReplyModel.findOne({
    authorId: authorObjectId,
    createOperationId: parsedOperationId,
  }).lean();
  if (existing) {
    await settleReplayedUploads(uploads, existing.createOperationHash, requestHash, existing.uploads);
    return toReplyListItem(existing);
  }

  let reply: SupportReplyListItem | null;
  try {
    reply = await mongoose.connection.transaction(async (session) => {
      const supportIssue = await requireLiveIssue(parsed.issueId, session);
      if (!supportIssue) return null;

      const [createdReply] = await SupportReplyModel.create([{
        ...parsed,
        uploads,
        authorId: authorObjectId,
        createOperationId: parsedOperationId,
        createOperationHash: requestHash,
      }], { session });
      await requirePublicationReview(parsed.issueId, authorId, session);
      await refreshIssueReplySearchText(parsed.issueId, session);
      const context = await getRequestContext();
      for (const upload of uploads) {
        await recordAuditEvent({
          actorId: authorId,
          action: "ATTACHMENT_UPLOAD",
          resourceType: "SupportAttachment",
          resourceId: upload._id,
          result: "SUCCEEDED",
        }, context, session);
      }
      await recordAuditEvent({
        actorId: authorId,
        action: "REPLY_CREATE",
        resourceType: "SupportReply",
        resourceId: String(createdReply._id),
        result: "SUCCEEDED",
      }, context, session);
      return toReplyListItem(createdReply.toObject());
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      // The transaction rolled back, so nothing references these objects.
      await discardUploads(uploads);
      throw error;
    }
    const duplicate = await SupportReplyModel.findOne({
      authorId: authorObjectId,
      createOperationId: parsedOperationId,
    }).lean();
    if (!duplicate) {
      await discardUploads(uploads);
      throw error;
    }
    await settleReplayedUploads(uploads, duplicate.createOperationHash, requestHash, duplicate.uploads);
    return toReplyListItem(duplicate);
  }

  // The issue disappeared between page load and submit; drop the orphaned files.
  if (!reply) await discardUploads(uploads);
  return reply;
}

export async function listReplies(issueId: string, redactActorIds = false) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) return [];
  await dbConnect();

  const filter: Record<string, unknown> = { issueId, deletedAt: null };

  const replies = await SupportReplyModel.find(filter).sort({ createdAt: 1 }).lean();
  const authors = await buildAuthorMap(replies as LeanDoc[]);
  return (replies as LeanDoc[]).map((reply) => {
    const mapped = toReplyListItem(reply, authors);
    // The public projection strips uploads entirely: the bytes are staff-only by
    // policy, and even the id and original filename would leak — filenames
    // routinely contain a person's name, which is exactly what this app is
    // careful never to expose to a student.
    return redactActorIds ? { ...mapped, authorId: "", uploads: [] } : mapped;
  });
}

/**
 * Reply mutation is limited to the author, plus ADMIN as an override.
 *
 * Both edit and delete must use this, otherwise the UI shows a control that
 * silently does nothing for a mentor acting on someone else's reply.
 */
function replyMutationFilter(
  issueId: string,
  replyId: string,
  actorId: string,
  actorRole?: UserRole | null,
) {
  const base: Record<string, unknown> = { _id: replyId, issueId, deletedAt: null };
  if (isAdmin(actorRole ?? "STUDENT")) return base;
  return { ...base, authorId: actorId };
}

export async function editReply(
  issueId: string,
  replyId: string,
  body: string,
  actorId: string,
  actorRole?: UserRole | null,
  videoLinks?: SupportReplyInput["videoLinks"],
) {
  if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(replyId)) {
    return null;
  }
  await dbConnect();

  return mongoose.connection.transaction(async (session) => {
    const filter = replyMutationFilter(issueId, replyId, actorId, actorRole);
    const existingReply = await SupportReplyModel.findOne(filter).select("_id").session(session).lean();
    if (!existingReply) {
      const context = await getRequestContext();
      await recordAuditEvent({
        actorId,
        action: "REPLY_EDIT",
        resourceType: "SupportReply",
        resourceId: replyId,
        result: "DENIED",
      }, context, session);
      return null;
    }

    // Video links are replace-only: the edit form always posts the full list, so
    // omitting the field leaves the stored links untouched and an empty string
    // clears them.
    const update: Record<string, unknown> = { body: body.trim(), editedAt: new Date() };
    if (videoLinks !== undefined) update.videoLinks = videoLinks;

    const reply = await SupportReplyModel.findOneAndUpdate(
      filter,
      update,
      { new: true, runValidators: true, session },
    ).lean();
    if (!reply) return null;
    await requirePublicationReview(issueId, actorId, session);
    await refreshIssueReplySearchText(issueId, session);
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "REPLY_EDIT",
      resourceType: "SupportReply",
      resourceId: replyId,
      result: "SUCCEEDED",
    }, context, session);
    return toReplyListItem(reply);
  });
}

export async function softDeleteReply(
  issueId: string,
  replyId: string,
  actorId: string,
  actorRole?: UserRole | null,
) {
  if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(replyId)) {
    return null;
  }
  await dbConnect();

  return mongoose.connection.transaction(async (session) => {
    const filter = replyMutationFilter(issueId, replyId, actorId, actorRole);
    const existingReply = await SupportReplyModel.findOne(filter).select("_id").session(session).lean();
    if (!existingReply) {
      const context = await getRequestContext();
      await recordAuditEvent({
        actorId,
        action: "REPLY_DELETE",
        resourceType: "SupportReply",
        resourceId: replyId,
        result: "DENIED",
      }, context, session);
      return null;
    }

    const reply = await SupportReplyModel.findOneAndUpdate(
      filter,
      { deletedAt: new Date() },
      { new: true, session },
    ).lean();
    if (!reply) return null;
    await requirePublicationReview(issueId, actorId, session);
    await refreshIssueReplySearchText(issueId, session);
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "REPLY_DELETE",
      resourceType: "SupportReply",
      resourceId: replyId,
      result: "SUCCEEDED",
    }, context, session);
    return toReplyListItem(reply);
  });
}
