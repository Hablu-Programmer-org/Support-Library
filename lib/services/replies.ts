import "server-only";

import mongoose, { type ClientSession } from "mongoose";

import { dbConnect } from "@/lib/db";
import { mutationRequestHash, operationIdSchema } from "@/lib/mutation-security";
import { isAdmin, type UserRole } from "@/lib/roles";
import { recordAuditEvent } from "@/lib/services/audit";
import { rebuildIssueSearchFields } from "@/lib/services/search-index";
import { settleReplayedUploads, toAttachmentViews, type AttachmentView } from "@/lib/services/attachments";
import { getRequestContext } from "@/lib/request-context";
import { deriveIssueReplyState, EFFECTIVE_STAFF_REPLY_EXPRESSION, isEffectiveStaffReply } from "@/lib/reply-state";
import { discardUploads, type IngestedUpload } from "@/lib/uploads/ingest";
import { supportReplyInputSchema, type SupportReplyInput } from "@/lib/validation";
import { buildOwnIssueFilter } from "@/lib/issue-ownership";
import { projectRepliesForViewer, type ReplyViewer } from "@/lib/reply-view";
import { SupportIssueModel, SupportReplyModel, UserModel } from "@/models";

type LeanDoc = Record<string, unknown>;

export type SupportReplyListItem = {
  id: string;
  issueId: string;
  authorId: string;
  authorName?: string;
  isStaffReply: boolean;
  body: string;
  videoLinks: Array<{ title: string; url: string; timestamp?: string | null; summary?: string | null }>;
  uploads: Array<Omit<AttachmentView, "uploadedBy">>;
  createdAt?: Date;
  updatedAt?: Date;
  editedAt?: Date | null;
};

const toReplyListItem = (reply: LeanDoc, authors: Map<string, LeanDoc> = new Map()): SupportReplyListItem => {
  const authorId = String(reply.authorId);
  const author = authors.get(authorId);

  const uploads = toAttachmentViews(reply.uploads).map((upload) => ({
    id: upload.id,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    byteSize: upload.byteSize,
    width: upload.width,
    height: upload.height,
    createdAt: upload.createdAt,
  }));
  return {
    id: String(reply._id),
    issueId: String(reply.issueId),
    authorId,
    authorName: author?.name as string | undefined,
    isStaffReply: isEffectiveStaffReply(reply, (author as { role?: string | null } | undefined)?.role),
    body: String(reply.body),
    videoLinks: Array.isArray(reply.videoLinks) ? reply.videoLinks as SupportReplyListItem["videoLinks"] : [],
    uploads,
    createdAt: reply.createdAt as Date | undefined,
    updatedAt: reply.updatedAt as Date | undefined,
    editedAt: reply.editedAt as Date | null | undefined,
  };
};

async function buildAuthorMap(replies: LeanDoc[]) {
  const ids = [...new Set(replies.map((reply) => String(reply.authorId)).filter(Boolean))];
  if (!ids.length) return new Map<string, LeanDoc>();

  const authors = await UserModel.find({ _id: { $in: ids } }).select("name role").lean();
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
  await rebuildIssueSearchFields(issueId, session, { touchUpdatedAt: false });
}

/** Recompute from live replies so edits/deletes and retries can never drift the queue state. */
async function refreshIssueReplyState(issueId: string, session: ClientSession) {
  const [summary] = await SupportReplyModel.aggregate<{
    lastStaffReplyAt: Date | null;
    lastStudentReplyAt: Date | null;
  }>([
    { $match: { issueId: new mongoose.Types.ObjectId(issueId), deletedAt: null } },
    { $lookup: { from: "staff-users", localField: "authorId", foreignField: "_id", as: "author" } },
    { $set: { effectiveStaff: EFFECTIVE_STAFF_REPLY_EXPRESSION } },
    {
      $group: {
        _id: null,
        lastStaffReplyAt: { $max: { $cond: ["$effectiveStaff", "$createdAt", null] } },
        lastStudentReplyAt: { $max: { $cond: ["$effectiveStaff", null, "$createdAt"] } },
      },
    },
  ]).session(session);
  const state = deriveIssueReplyState(
    summary?.lastStaffReplyAt ?? null,
    summary?.lastStudentReplyAt ?? null,
  );
  await SupportIssueModel.updateOne(
    { _id: issueId },
    { $set: state },
    { timestamps: false },
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

export async function addStudentReply(
  input: SupportReplyInput,
  studentId: string,
  operationId: string,
  uploads: IngestedUpload[] = [],
) {
  const parsed = supportReplyInputSchema.parse(input);
  const parsedOperationId = operationIdSchema.parse(operationId);
  const requestHash = mutationRequestHash({ input: parsed });
  await dbConnect();
  const studentObjectId = new mongoose.Types.ObjectId(studentId);

  let existing: LeanDoc | null = null;
  try {
    existing = await SupportReplyModel.findOne({
      authorId: studentObjectId,
      createOperationId: parsedOperationId,
    }).lean();
  } catch (error) {
    await discardUploads(uploads);
    throw error;
  }
  if (existing) {
    await settleReplayedUploads(uploads, existing.createOperationHash as string | null, requestHash, existing.uploads);
    return toReplyListItem(existing);
  }

  let reply: SupportReplyListItem | null;
  try {
    reply = await mongoose.connection.transaction(async (session) => {
      const supportIssue = await SupportIssueModel.findOne({
        _id: new mongoose.Types.ObjectId(parsed.issueId),
        ...buildOwnIssueFilter(studentId),
        status: { $ne: "ARCHIVED" },
      })
        .select("_id status visibility")
        .session(session)
        .lean();
      if (!supportIssue) return null;

      const studentReplyCount = await SupportReplyModel.countDocuments({
        issueId: new mongoose.Types.ObjectId(parsed.issueId),
        authorId: studentObjectId,
        isStaffReply: false,
        deletedAt: null,
      }).session(session);
      if (studentReplyCount >= 25) return null;

      const staffReplyExists = await SupportReplyModel.exists({
        issueId: new mongoose.Types.ObjectId(parsed.issueId),
        deletedAt: null,
        isStaffReply: true,
      }).session(session);
      let staffReplyFound = Boolean(staffReplyExists);
      if (!staffReplyFound) {
        const fallbackStaffReply = await SupportReplyModel.aggregate([
          { $match: { issueId: new mongoose.Types.ObjectId(parsed.issueId), deletedAt: null } },
          { $lookup: { from: "staff-users", localField: "authorId", foreignField: "_id", as: "author" } },
          { $set: { effectiveStaff: EFFECTIVE_STAFF_REPLY_EXPRESSION } },
          { $match: { effectiveStaff: true } },
          { $limit: 1 },
        ]).session(session);
        staffReplyFound = fallbackStaffReply.length > 0;
      }
      if (!staffReplyFound) return null;

      const [createdReply] = await SupportReplyModel.create([{
        ...parsed,
        uploads,
        authorId: studentObjectId,
        isStaffReply: false,
        createOperationId: parsedOperationId,
        createOperationHash: requestHash,
      }], { session });

      const nextStatus =
        supportIssue.status === "SOLVED"
          ? "FOLLOW_UP"
          : supportIssue.status === "AWAITING_STUDENT"
            ? "OPEN"
            : supportIssue.status;
      // Preserve the latest staff reply timestamp while marking this as waiting.
      const currentIssue = await SupportIssueModel.findById(parsed.issueId)
        .select("lastStaffReplyAt")
        .session(session)
        .lean();
      const derivedState = deriveIssueReplyState(
        currentIssue?.lastStaffReplyAt ?? null,
        new Date(),
      );
      const updateResult = await SupportIssueModel.updateOne(
        { _id: parsed.issueId, createdBy: studentObjectId, deletedAt: null, status: { $ne: "ARCHIVED" } },
        {
          $set: {
            status: nextStatus,
            updatedBy: studentObjectId,
            visibility: "INTERNAL",
            publishedAt: null,
            publishedBy: null,
            lastStudentReplyAt: derivedState.lastStudentReplyAt,
            awaitingStaff: derivedState.awaitingStaff,
            lastStaffReplyAt: derivedState.lastStaffReplyAt,
          },
          $push: {
            publicationHistory: {
              $each: [
                {
                  action: "PUBLIC_REPLY_CHANGED",
                  actorId: studentObjectId,
                  at: new Date(),
                },
              ],
              $slice: -50,
            },
          },
        },
        { session },
      );
      if (updateResult.matchedCount !== 1) throw new Error("Student reply issue update did not match");

      await refreshIssueReplySearchText(parsed.issueId, session);
      await refreshIssueReplyState(parsed.issueId, session);
      const context = await getRequestContext();
      for (const upload of uploads) {
        await recordAuditEvent({
          actorId: studentId,
          action: "ATTACHMENT_UPLOAD",
          resourceType: "SupportAttachment",
          resourceId: upload._id,
          result: "SUCCEEDED",
        }, context, session);
      }
      await recordAuditEvent({
        actorId: studentId,
        action: "REPLY_CREATE",
        resourceType: "SupportReply",
        resourceId: String(createdReply._id),
        result: "SUCCEEDED",
      }, context, session);
      return toReplyListItem(createdReply.toObject());
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      await discardUploads(uploads);
      throw error;
    }
    const duplicate = await SupportReplyModel.findOne({
      authorId: studentObjectId,
      createOperationId: parsedOperationId,
    }).lean();
    if (!duplicate) {
      await discardUploads(uploads);
      throw error;
    }
    await settleReplayedUploads(uploads, duplicate.createOperationHash, requestHash, duplicate.uploads);
    return toReplyListItem(duplicate);
  }

  if (!reply) await discardUploads(uploads);
  return reply;
}

export async function addReply(
  input: SupportReplyInput,
  authorId: string,
  operationId: string,
  uploads: IngestedUpload[] = [],
  authorRole: UserRole = "MENTOR",
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
    await settleReplayedUploads(uploads, existing.createOperationHash as string | null, requestHash, existing.uploads);
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
        isStaffReply: authorRole !== "STUDENT",
        createOperationId: parsedOperationId,
        createOperationHash: requestHash,
      }], { session });
      await requirePublicationReview(parsed.issueId, authorId, session);
      await refreshIssueReplySearchText(parsed.issueId, session);
      await refreshIssueReplyState(parsed.issueId, session);
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

export type ListRepliesOptions = {
  viewerId?: string;
  /**
   * Defaults to `staff`. Every student-facing caller must say `owner` or
   * `public`; the redaction itself lives in `lib/reply-view.ts`.
   */
  viewer?: ReplyViewer;
};

export async function listReplies(issueId: string, options?: ListRepliesOptions) {
  const viewer = options?.viewer ?? "staff";
  const viewerId = options?.viewerId;
  if (!mongoose.Types.ObjectId.isValid(issueId)) return [];
  await dbConnect();

  const filter: Record<string, unknown> = { issueId, deletedAt: null };

  const replies = await SupportReplyModel.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
  const authors = await buildAuthorMap(replies as LeanDoc[]);
  const mapped = (replies as LeanDoc[]).map((reply) => toReplyListItem(reply, authors));
  return projectRepliesForViewer(mapped, viewer, viewerId);
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
  removeUploadIds: readonly string[] = [],
) {
  if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(replyId)) {
    return null;
  }
  await dbConnect();

  let removedUploads: { key: string }[] = [];
  const result = await mongoose.connection.transaction(async (session) => {
    const filter = replyMutationFilter(issueId, replyId, actorId, actorRole);
    const existingReply = await SupportReplyModel.findOne(filter)
      .select("_id uploads")
      .session(session)
      .lean();
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

    // Only ids that really belong to **this** reply can be removed; an id from
    // another case or reply simply matches nothing.
    const removeSet = new Set(removeUploadIds);
    const currentUploads = (existingReply.uploads ?? []) as unknown as LeanDoc[];
    const removed = currentUploads.filter((entry) => removeSet.has(String(entry._id)));
    const kept = currentUploads.filter((entry) => !removeSet.has(String(entry._id)));
    removedUploads = removed as unknown as { key: string }[];

    // Video links are replace-only: the edit form always posts the full list, so
    // omitting the field leaves the stored links untouched and an empty string
    // clears them. Uploads follow the same rule — an empty `removeUploadIds`
    // leaves the existing images alone.
    const update: Record<string, unknown> = { body: body.trim(), editedAt: new Date() };
    if (videoLinks !== undefined) update.videoLinks = videoLinks;
    if (removed.length) update.uploads = kept;

    const reply = await SupportReplyModel.findOneAndUpdate(
      filter,
      update,
      { new: true, runValidators: true, session },
    ).lean();
    if (!reply) return null;
    await requirePublicationReview(issueId, actorId, session);
    await refreshIssueReplySearchText(issueId, session);
    await refreshIssueReplyState(issueId, session);
    const context = await getRequestContext();
    for (const entry of removed) {
      await recordAuditEvent({
        actorId,
        action: "ATTACHMENT_DELETE",
        resourceType: "SupportAttachment",
        resourceId: String(entry._id),
        result: "SUCCEEDED",
      }, context, session);
    }
    await recordAuditEvent({
      actorId,
      action: "REPLY_EDIT",
      resourceType: "SupportReply",
      resourceId: replyId,
      result: "SUCCEEDED",
    }, context, session);
    return toReplyListItem(reply);
  });

  // The removed objects are no longer referenced by any document. Delete them
  // only after the write committed, so a failed edit cannot destroy a live image.
  if (!result) return null;
  await discardUploads(removedUploads);
  return result;
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
    await refreshIssueReplyState(issueId, session);
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
