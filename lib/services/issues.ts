import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { buildOwnIssueFilter } from "@/lib/issue-ownership";
import { mutationRequestHash, operationIdSchema } from "@/lib/mutation-security";
import { buildIssueSearchText, buildIssueSearchTextWithReplies, buildSearchRegex } from "@/lib/search";
import {
  createStudentEmailLookupCandidates,
  normalizeStudentEmail,
  protectStudentEmail,
  readStudentEmailSafe,
} from "@/lib/student-email-crypto";
import {
  supportIssueInputSchema,
  type SupportIssueFilter,
  type SupportIssueInput,
  type SupportReplyInput,
} from "@/lib/validation";
import { recordAuditEvent } from "@/lib/services/audit";
import { nextCaseRef } from "@/lib/services/case-ref";
import { toAttachmentViews, settleReplayedUploads, type AttachmentView } from "@/lib/services/attachments";
import { getRequestContext } from "@/lib/request-context";
import { discardUploads, type IngestedUpload } from "@/lib/uploads/ingest";
import { uploadLimit } from "@/lib/uploads/limits";
import { UploadValidationError } from "@/lib/uploads/ingest";
import {
  CASE_PRIORITIES,
  SupportReplyModel,
  SupportIssueModel,
  type CaseStatus,
  type IssueVisibility,
} from "@/models";

type LeanDoc = Record<string, unknown>;

const PUBLIC_ISSUE_FIELDS =
  "title question videoLinks status priority courseSlug batchNo tags visibility publishedAt createdAt updatedAt";

/** LOW=1 … URGENT=4 — string order would be wrong, so sorting uses this rank. */
const CASE_PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  CASE_PRIORITIES.map((priority, index) => [priority, index + 1]),
);

export type IssueVideoLink = {
  title: string;
  url: string;
  timestamp?: string | null;
  summary?: string | null;
};

export type SupportIssueListItem = {
  id: string;
  studentName: string;
  studentEmail: string | null;
  lmsUserId?: string | null;
  title: string;
  question: string;
  videoLinks: IssueVideoLink[];
  uploads: AttachmentView[];
  status: CaseStatus;
  priority?: string | null;
  courseSlug?: string | null;
  batchNo?: number | null;
  moduleSlug?: string | null;
  contentSlug?: string | null;
  tags: string[];
  visibility: IssueVisibility;
  publishedAt?: Date | null;
  /** Last time the student brought this request into the live room. */
  lastLiveSupportAt?: Date | null;
  /** Six-digit sequential reference (null only for rows awaiting the backfill). */
  caseRef?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicIssueDetail = Pick<
  SupportIssueListItem,
  | "id"
  | "title"
  | "question"
  | "videoLinks"
  | "status"
  | "priority"
  | "courseSlug"
  | "batchNo"
  | "tags"
  | "visibility"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
>;

type PublicIssueListItem = PublicIssueDetail & {
  studentName?: never;
  studentEmail?: never;
  lmsUserId?: never;
};

export type IssueListParams = SupportIssueFilter & {
  page?: number;
  limit?: number;
};

const toIssueListItem = (item: LeanDoc, includeStudentEmail = true): SupportIssueListItem => ({
  id: String(item._id),
  studentName: String(item.studentName ?? ""),
  studentEmail: includeStudentEmail
    ? readStudentEmailSafe(item.studentEmailEncrypted, item.studentEmail, (error) => {
        // A retired key version or a corrupted ciphertext must not take down the
        // whole staff page; log the record id and the reason, never the value.
        console.warn(
          "[issues] encrypted student email could not be read",
          String(item._id),
          error instanceof Error ? error.message : "unknown error",
        );
      })
    : null,
  lmsUserId: (item.lmsUserId as string | null) ?? null,
  title: String(item.title),
  question: String(item.question),
  videoLinks: Array.isArray(item.videoLinks) ? item.videoLinks as IssueVideoLink[] : [],
  uploads: toAttachmentViews(item.uploads),
  status: item.status as CaseStatus,
  priority: item.priority as string | null | undefined,
  courseSlug: item.courseSlug as string | null | undefined,
  batchNo: item.batchNo as number | null | undefined,
  moduleSlug: item.moduleSlug as string | null | undefined,
  contentSlug: item.contentSlug as string | null | undefined,
  tags: Array.isArray(item.tags) ? item.tags as string[] : [],
  visibility: item.visibility === "PUBLISHED" ? "PUBLISHED" : "INTERNAL",
  publishedAt: item.publishedAt as Date | null | undefined,
  lastLiveSupportAt: (item.lastLiveSupportAt as Date | null | undefined) ?? null,
  caseRef: (item.caseRef as string | null | undefined) ?? null,
  createdAt: item.createdAt as Date | undefined,
  updatedAt: item.updatedAt as Date | undefined,
});

const toPublicIssueListItem = (item: LeanDoc): PublicIssueListItem => {
  const mapped = toIssueListItem(item, false);
  return {
    id: mapped.id,
    title: mapped.title,
    question: mapped.question,
    videoLinks: mapped.videoLinks,
    status: mapped.status,
    priority: mapped.priority,
    courseSlug: mapped.courseSlug,
    batchNo: mapped.batchNo,
    tags: mapped.tags,
    visibility: mapped.visibility,
    publishedAt: mapped.publishedAt,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
};

function buildIssueFilter(params: IssueListParams = {}, publicOnly = false) {
  const filter: Record<string, unknown> = { deletedAt: null };

  if (publicOnly) filter.visibility = "PUBLISHED";

  if (params.status) filter.status = params.status;
  if (params.courseSlug) filter.courseSlug = params.courseSlug;
  if (params.batchNo) filter.batchNo = params.batchNo;
  if (params.tag) filter.tags = params.tag.toLowerCase();
  if (params.mentorId && mongoose.Types.ObjectId.isValid(params.mentorId)) filter.mentorId = params.mentorId;
  const normalizedQuery = normalizeStudentEmail(params.q ?? "");
  const isExactEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedQuery);
  // Staff can find a case by the six digits the student reads out in the room.
  // Published (student-facing) search stays text-only, so one student cannot probe
  // another student's reference.
  const referenceQuery =
    !publicOnly && /^\d{6}$/.test((params.q ?? "").trim()) ? (params.q ?? "").trim() : null;
  const searchRegex = buildSearchRegex(params.q);
  if (!publicOnly && isExactEmailQuery) {
    filter.$or = createStudentEmailLookupCandidates(normalizedQuery);
  } else if (searchRegex || referenceQuery) {
    if (publicOnly) {
      filter.$or = [
        { title: searchRegex },
        { question: searchRegex },
        { tags: searchRegex },
        { courseSlug: searchRegex },
      ];
    } else {
      filter.$or = [
        ...(referenceQuery ? [{ caseRef: referenceQuery }] : []),
        ...(searchRegex ? [{ searchText: searchRegex }] : []),
      ];
    }
  }
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: new Date(params.from) } : {}),
      ...(params.to ? { $lte: new Date(params.to) } : {}),
    };
  }

  return filter;
}

type InitialReplyInput = Omit<SupportReplyInput, "issueId">;

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function createIssue(
  input: SupportIssueInput,
  actorId: string,
  actorRole: "ADMIN" | "MENTOR" | "STUDENT",
  operationId: string,
  initialReply: InitialReplyInput | null = null,
  solveIssue = false,
  uploads: IngestedUpload[] = [],
  replyUploads: IngestedUpload[] = [],
) {
  const parsed = supportIssueInputSchema.parse(input);
  const parsedOperationId = operationIdSchema.parse(operationId);

  // Uploads are excluded from the hash on purpose: their object keys are
  // generated server-side and are not part of the client's request, so including
  // them would make an identical retry hash differently and look like a conflict.
  const requestHash = mutationRequestHash({ input: parsed, initialReply, solveIssue });
  // An initial answer only exists when `initialReply` does; files selected for an
  // answer that was not submitted must not be stored.
  const replyFiles = initialReply ? replyUploads : [];
  const attachedUploads = [...uploads, ...replyFiles];

  await dbConnect();
  const actorObjectId = new mongoose.Types.ObjectId(actorId);

  const { studentEmail, studentName, lmsUserId, ...issueFields } = parsed;
  const protectedEmail = studentEmail ? protectStudentEmail(studentEmail) : null;

  // A student submission is never assigned a mentor — the submitter is the
  // student, not the owner of the case. For MENTOR the mentor is always the
  // actor; for ADMIN a custom mentorId is allowed and falls back to the actor.
  const effectiveMentorId =
    actorRole === "STUDENT"
      ? null
      : actorRole === "MENTOR"
        ? actorObjectId
        : parsed.mentorId
          ? new mongoose.Types.ObjectId(parsed.mentorId)
          : actorObjectId;

  const existing = await SupportIssueModel.findOne({
    createdBy: actorObjectId,
    createOperationId: parsedOperationId,
  }).select("+studentEmail").lean();
  if (existing) {
    await settleReplayedUploads(attachedUploads, existing.createOperationHash, requestHash, existing.uploads);
    return toIssueListItem(existing);
  }

  try {
    const supportIssue = await mongoose.connection.transaction(async (session) => {
      const finalStatus = initialReply && solveIssue ? "SOLVED" : "OPEN";
      // Filenames are deliberately kept out of `searchText`: an image attachment named
      // after the student would otherwise become searchable PII.
      const searchText = initialReply
        ? buildIssueSearchTextWithReplies(parsed, [initialReply.body])
        : buildIssueSearchText(parsed);
      // Sequential and unique; allocated inside this transaction so an aborted
      // create does not burn a number.
      const caseRef = await nextCaseRef(session);
      const [createdIssue] = await SupportIssueModel.create([{
        caseRef,
        ...issueFields,
        studentName: studentName ?? null,
        lmsUserId: lmsUserId ?? null,
        ...(protectedEmail
          ? {
              studentEmailEncrypted: protectedEmail.encrypted,
              studentEmailLookup: protectedEmail.lookup,
            }
          : {}),
        status: finalStatus,
        searchText,
        mentorId: effectiveMentorId,
        uploads,
        createdBy: actorObjectId,
        updatedBy: actorObjectId,
        createOperationId: parsedOperationId,
        createOperationHash: requestHash,
      }], { session });

      const context = await getRequestContext();
      for (const upload of uploads) {
        await recordAuditEvent({
          actorId,
          action: "ATTACHMENT_UPLOAD",
          resourceType: "SupportAttachment",
          resourceId: upload._id,
          result: "SUCCEEDED",
        }, context, session);
      }

      if (initialReply) {
        const [reply] = await SupportReplyModel.create([{
          ...initialReply,
          uploads: replyFiles,
          issueId: createdIssue._id,
          authorId: actorObjectId,
        }], { session });
        for (const upload of replyFiles) {
          await recordAuditEvent({
            actorId,
            action: "ATTACHMENT_UPLOAD",
            resourceType: "SupportAttachment",
            resourceId: upload._id,
            result: "SUCCEEDED",
          }, context, session);
        }
        await recordAuditEvent({
          actorId,
          action: "REPLY_CREATE",
          resourceType: "SupportReply",
          resourceId: String(reply._id),
          result: "SUCCEEDED",
        }, context, session);
      }

      await recordAuditEvent({
        actorId,
        action: "ISSUE_CREATE",
        resourceType: "SupportIssue",
        resourceId: String(createdIssue._id),
        result: "SUCCEEDED",
      }, context, session);

      return createdIssue.toObject();
    });

    return toIssueListItem(supportIssue);
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      // Nothing was committed, so nothing may reference these objects.
      await discardUploads(attachedUploads);
      throw error;
    }
    const duplicate = await SupportIssueModel.findOne({
      createdBy: actorObjectId,
      createOperationId: parsedOperationId,
    }).select("+studentEmail").lean();
    if (!duplicate) {
      await discardUploads(attachedUploads);
      throw error;
    }
    await settleReplayedUploads(attachedUploads, duplicate.createOperationHash, requestHash, duplicate.uploads);
    return toIssueListItem(duplicate);
  }
}

export async function updateIssue(
  id: string,
  input: SupportIssueInput,
  actorId: string,
  actorRole: "ADMIN" | "MENTOR",
  expectedUpdatedAt: Date,
  uploads: IngestedUpload[] = [],
  removeUploadIds: string[] = [],
) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const parsed = supportIssueInputSchema.parse(input);
  await dbConnect();

  const { studentEmail, studentName, lmsUserId, status, ...issueFields } = parsed;
  const protectedEmail = studentEmail ? protectStudentEmail(studentEmail) : null;

  // Editing can never archive an issue: ARCHIVED is only reachable through the
  // dedicated soft-delete flow, which also clears visibility, records the
  // ARCHIVED publication event, and removes the issue from active lists. Dropping
  // the field here leaves the current status untouched instead of persisting a
  // status that would keep the issue visible but marked archived.
  const safeStatus = status === "ARCHIVED" ? undefined : status;

  // For MENTOR role, enforce mentorId = actorId (ignore input)
  // For ADMIN role, allow custom mentorId
  const effectiveMentorId = actorRole === "MENTOR"
    ? new mongoose.Types.ObjectId(actorId)
    : (parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : undefined);

  const updateData: Record<string, unknown> = {
    ...issueFields,
    ...(safeStatus ? { status: safeStatus } : {}),
    ...(protectedEmail
      ? {
          studentName,
          studentEmailEncrypted: protectedEmail.encrypted,
          studentEmailLookup: protectedEmail.lookup,
        }
      : {}),
    ...(lmsUserId ? { lmsUserId } : {}),
    visibility: "INTERNAL",
    publishedAt: null,
    publishedBy: null,
    updatedBy: new mongoose.Types.ObjectId(actorId),
  };

  // Only set mentorId if it's defined (for ADMIN with custom mentorId)
  if (effectiveMentorId) {
    updateData.mentorId = effectiveMentorId;
  } else if (actorRole === "MENTOR") {
    // For MENTOR, explicitly set to actorId
    updateData.mentorId = new mongoose.Types.ObjectId(actorId);
  }

  let result: ReturnType<typeof toIssueListItem> | null = null;
  let removedUploads: { key: string }[] = [];
  try {
    result = await mongoose.connection.transaction(async (session) => {
      const existing = await SupportIssueModel.findOne({ _id: id, deletedAt: null })
        .select("uploads")
        .session(session)
        .lean();
      if (!existing) return null;

      const removeSet = new Set(removeUploadIds);
      const removed = ((existing.uploads ?? []) as unknown as LeanDoc[]).filter((entry) =>
        removeSet.has(String(entry._id)),
      );
      const kept = ((existing.uploads ?? []) as unknown as LeanDoc[]).filter(
        (entry) => !removeSet.has(String(entry._id)),
      );
      removedUploads = removed as unknown as { key: string }[];

      const replies = await SupportReplyModel.find({ issueId: id, deletedAt: null })
        .select("body")
        .session(session)
        .lean();
      updateData.searchText = buildIssueSearchTextWithReplies(
        parsed,
        replies.map((reply) => reply.body),
      );

      // Guard the per-item cap across kept + newly added uploads: ingestUploads
      // only sees the incoming batch, so the combined total must be checked here.
      const remaining = uploadLimit() - kept.length;
      if (uploads.length > remaining) {
        throw new UploadValidationError(
          "uploads",
          `This issue already has ${kept.length} image attachment(s); you can add at most ${Math.max(0, remaining)} more`,
        );
      }

      updateData.uploads = [...kept, ...uploads];

      const supportIssue = await SupportIssueModel.findOneAndUpdate(
        { _id: id, deletedAt: null, updatedAt: expectedUpdatedAt },
        {
          $set: updateData,
          $unset: {
            studentEmail: "",
            studentEmailHash: "",
            ...(!protectedEmail
              ? {
                  studentName: "",
                  studentEmailEncrypted: "",
                  studentEmailLookup: "",
                  lmsUserId: "",
                }
              : !lmsUserId
                ? { lmsUserId: "" }
                : {}),
          },
          $push: {
            publicationHistory: {
              action: "CONTENT_CHANGED",
              actorId: new mongoose.Types.ObjectId(actorId),
              at: new Date(),
            },
          },
        },
        { new: true, runValidators: true, session },
      ).lean();

      if (!supportIssue) {
        const context = await getRequestContext();
        await recordAuditEvent(
          {
            actorId,
            action: "ISSUE_UPDATE",
            resourceType: "SupportIssue",
            resourceId: id,
            result: "DENIED",
          },
          context,
          session,
        );
        return null;
      }

      const context = await getRequestContext();
      for (const upload of uploads) {
        await recordAuditEvent(
          {
            actorId,
            action: "ATTACHMENT_UPLOAD",
            resourceType: "SupportAttachment",
            resourceId: upload._id,
            result: "SUCCEEDED",
          },
          context,
          session,
        );
      }
      for (const entry of removed) {
        await recordAuditEvent(
          {
            actorId,
            action: "ATTACHMENT_DELETE",
            resourceType: "SupportAttachment",
            resourceId: String(entry._id),
            result: "SUCCEEDED",
          },
          context,
          session,
        );
      }
      await recordAuditEvent(
        {
          actorId,
          action: "ISSUE_UPDATE",
          resourceType: "SupportIssue",
          resourceId: id,
          result: "SUCCEEDED",
        },
        context,
        session,
      );

      return toIssueListItem(supportIssue);
    });
  } catch (error) {
    await discardUploads(uploads);
    throw error;
  }

  if (!result) {
    // Stale optimistic lock or missing issue: drop the freshly written objects.
    await discardUploads(uploads);
    return null;
  }

  // The removed objects are no longer referenced by any document.
  await discardUploads(removedUploads);
  return result;
}

export async function changeIssueStatus(id: string, status: CaseStatus, actorId: string, expectedUpdatedAt: Date) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportIssue = await mongoose.connection.transaction(async (session) => {
    const updated = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null, updatedAt: expectedUpdatedAt },
      { status, updatedBy: new mongoose.Types.ObjectId(actorId) },
      { new: true, runValidators: true, session },
    ).lean();
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "ISSUE_STATUS_CHANGE",
      resourceType: "SupportIssue",
      resourceId: id,
      result: updated ? "SUCCEEDED" : "DENIED",
    }, context, session);
    return updated;
  });

  return supportIssue ? toIssueListItem(supportIssue) : null;
}

export async function softDeleteIssue(id: string, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportIssue = await mongoose.connection.transaction(async (session) => {
    const updated = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          visibility: "INTERNAL",
          publishedAt: null,
          publishedBy: null,
          deletedBy: new mongoose.Types.ObjectId(actorId),
          updatedBy: new mongoose.Types.ObjectId(actorId),
        },
        $push: {
          publicationHistory: {
            action: "ARCHIVED",
            actorId: new mongoose.Types.ObjectId(actorId),
            at: new Date(),
          },
        },
      },
      { new: true, session },
    ).lean();
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "ISSUE_ARCHIVE",
      resourceType: "SupportIssue",
      resourceId: id,
      result: updated ? "SUCCEEDED" : "DENIED",
    }, context, session);
    return updated;
  });

  return supportIssue ? toIssueListItem(supportIssue) : null;
}

export async function listIssues(
  params: IssueListParams = {},
  options: { publicOnly?: boolean } = {},
) {
  await dbConnect();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter = buildIssueFilter(params, options.publicOnly === true);
  const skip = (page - 1) * limit;

  const queryOptions = { maxTimeMS: 5000 }; // 5 second timeout for search queries

  // `priority` needs a computed rank (URGENT highest), which a plain field
  // sort can't express; other modes sort on `updatedAt` directly.
  const itemsQuery =
    params.sort === "priority"
      ? SupportIssueModel.aggregate([
          { $match: filter },
          {
            $addFields: {
              priorityRank: {
                $switch: {
                  branches: CASE_PRIORITIES.map((priority) => ({
                    case: { $eq: ["$priority", priority] },
                    then: CASE_PRIORITY_RANK[priority],
                  })),
                  default: CASE_PRIORITY_RANK.NORMAL,
                },
              },
            },
          },
          { $sort: { priorityRank: -1, updatedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...(options.publicOnly
            ? [{
                $project: {
                  title: 1,
                  question: 1,
                  videoLinks: 1,
                  status: 1,
                  priority: 1,
                  courseSlug: 1,
                  batchNo: 1,
                  tags: 1,
                  visibility: 1,
                  publishedAt: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              }]
            : []),
        ], { maxTimeMS: 5000 })
      : SupportIssueModel.find(filter, null, queryOptions)
          .select(options.publicOnly ? PUBLIC_ISSUE_FIELDS : "")
          .select(options.publicOnly ? "" : "+studentEmail")
          .sort(params.sort === "oldest" ? { updatedAt: 1 } : { updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

  const [items, total] = await Promise.all([
    itemsQuery,
    SupportIssueModel.countDocuments(filter).maxTimeMS(5000),
  ]);

  return {
    items: (items as LeanDoc[]).map((item) => options.publicOnly
      ? toPublicIssueListItem(item)
      : toIssueListItem(item)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Distinct course slugs and batch numbers that actually exist on live issues, for
 * populating the filter dropdowns. Reading them from the data keeps the dropdowns
 * from offering combinations that can never match.
 */
export async function listIssueFilterOptions(publicOnly = false) {
  await dbConnect();

  const visibilityFilter = publicOnly ? { visibility: "PUBLISHED" } : {};

  const [courseSlugs, batchNos] = await Promise.all([
    SupportIssueModel.distinct("courseSlug", {
      deletedAt: null,
      ...visibilityFilter,
      courseSlug: { $nin: [null, ""] },
    }) as Promise<unknown[]>,
    SupportIssueModel.distinct("batchNo", {
      deletedAt: null,
      ...visibilityFilter,
      batchNo: { $nin: [null] },
    }) as Promise<unknown[]>,
  ]);

  return {
    courseSlugs: courseSlugs.filter((value): value is string => typeof value === "string").sort(),
    batchNos: batchNos.filter((value): value is number => typeof value === "number").sort((a, b) => a - b),
  };
}

export async function getIssueDetail(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportIssue = await SupportIssueModel.findOne({ _id: id, deletedAt: null })
    .select("+studentEmail")
    .lean();
  if (!supportIssue) return null;

  return toIssueListItem(supportIssue as LeanDoc);
}

/**
 * A student's own request, whatever its visibility.
 *
 * Scoped by `createdBy` from the session, so a published issue the student does
 * not own is still answered by the public view, and an unpublished one stays a
 * 404. Soft-deleted requests are never returned.
 */
export async function getOwnIssueDetail(id: string, studentUserId: string) {
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.isValidObjectId(studentUserId)) {
    return null;
  }
  await dbConnect();

  const supportIssue = await SupportIssueModel.findOne({
    ...buildOwnIssueFilter(studentUserId),
    _id: new mongoose.Types.ObjectId(id),
  }).lean();
  if (!supportIssue) return null;

  // The viewer is the owner: their own email, mentor and audit fields are not
  // part of this DTO and must not be added.
  return toIssueListItem(supportIssue as LeanDoc, false);
}

/** Newest-first list of the student's own requests, bounded for one page. */
const MAX_OWN_ISSUES = 50;
export async function listOwnIssues(
  studentUserId: string,
  limit = MAX_OWN_ISSUES,
): Promise<SupportIssueListItem[]> {
  if (!mongoose.isValidObjectId(studentUserId)) return [];
  await dbConnect();

  const docs = await SupportIssueModel.find(buildOwnIssueFilter(studentUserId))
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), MAX_OWN_ISSUES))
    .lean();

  return docs.map((doc) => toIssueListItem(doc as LeanDoc, false));
}

/**
 * Student-submitted requests that no mentor has been assigned yet.
 *
 * `createIssue` deliberately stores `mentorId: null` for a STUDENT actor, while
 * every staff-created case carries a mentor — so this list is exactly "a student
 * opened a case and nobody has picked it up". Oldest first, because the longest
 * wait is the one that needs attention.
 */
export async function listStudentRequestsAwaitingStaff(limit = 8) {
  await dbConnect();

  const docs = await SupportIssueModel.find({
    deletedAt: null,
    mentorId: null,
    status: { $in: [...LIVE_SUPPORT_ELIGIBLE_STATUSES] },
  })
    .sort({ createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .select("title status createdAt")
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    status: doc.status as CaseStatus,
    createdAt: doc.createdAt as Date | undefined,
  }));
}

export async function getPublishedIssueDetail(id: string): Promise<PublicIssueDetail | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportIssue = await SupportIssueModel.findOne({
    _id: id,
    deletedAt: null,
    visibility: "PUBLISHED",
  })
    .select(PUBLIC_ISSUE_FIELDS)
    .lean();
  if (!supportIssue) return null;

  const mapped = toIssueListItem(supportIssue as LeanDoc);
  return {
    id: mapped.id,
    title: mapped.title,
    question: mapped.question,
    videoLinks: mapped.videoLinks,
    status: mapped.status,
    priority: mapped.priority,
    courseSlug: mapped.courseSlug,
    batchNo: mapped.batchNo,
    tags: mapped.tags,
    visibility: mapped.visibility,
    publishedAt: mapped.publishedAt,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export async function publishIssue(id: string, actorId: string, reviewedAt: Date) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  return mongoose.connection.transaction(async (session) => {
    const supportIssue = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null, status: { $ne: "ARCHIVED" }, updatedAt: reviewedAt },
      {
        $set: {
          visibility: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: new mongoose.Types.ObjectId(actorId),
          updatedBy: new mongoose.Types.ObjectId(actorId),
        },
        $push: {
          publicationHistory: {
            action: "PUBLISHED",
            actorId: new mongoose.Types.ObjectId(actorId),
            at: new Date(),
          },
        },
      },
      { new: true, runValidators: true, session },
    ).lean();
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "ISSUE_PUBLISH",
      resourceType: "SupportIssue",
      resourceId: id,
      result: supportIssue ? "SUCCEEDED" : "DENIED",
    }, context, session);
    return supportIssue;
  });
}

export async function unpublishIssue(id: string, actorId: string, expectedUpdatedAt: Date) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  return mongoose.connection.transaction(async (session) => {
    const supportIssue = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null, visibility: "PUBLISHED", updatedAt: expectedUpdatedAt },
      {
        $set: {
          visibility: "INTERNAL",
          publishedAt: null,
          publishedBy: null,
          updatedBy: new mongoose.Types.ObjectId(actorId),
        },
        $push: {
          publicationHistory: {
            action: "UNPUBLISHED",
            actorId: new mongoose.Types.ObjectId(actorId),
            at: new Date(),
          },
        },
      },
      { new: true, runValidators: true, session },
    ).lean();
    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "ISSUE_UNPUBLISH",
      resourceType: "SupportIssue",
      resourceId: id,
      result: supportIssue ? "SUCCEEDED" : "DENIED",
    }, context, session);
    return supportIssue;
  });
}
