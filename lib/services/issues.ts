import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  assertOperationPayload,
  mutationRequestHash,
  operationIdSchema,
} from "@/lib/mutation-security";
import { buildIssueSearchText, buildIssueSearchTextWithReplies, buildSearchRegex } from "@/lib/search";
import {
  createStudentEmailLookupCandidates,
  normalizeStudentEmail,
  protectStudentEmail,
  readStudentEmail,
} from "@/lib/student-email-crypto";
import {
  supportIssueInputSchema,
  type SupportIssueFilter,
  type SupportIssueInput,
  type SupportReplyInput,
} from "@/lib/validation";
import { recordAuditEvent } from "@/lib/services/audit";
import { getRequestContext } from "@/lib/request-context";
import {
  CASE_PRIORITIES,
  SupportReplyModel,
  SupportIssueModel,
  type CaseStatus,
  type IssueVisibility,
} from "@/models";

type LeanDoc = Record<string, unknown>;

const PUBLIC_ISSUE_FIELDS =
  "title question status priority courseSlug batchNo tags visibility publishedAt createdAt updatedAt";

/** LOW=1 … URGENT=4 — string order would be wrong, so sorting uses this rank. */
const CASE_PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  CASE_PRIORITIES.map((priority, index) => [priority, index + 1]),
);

export type SupportIssueListItem = {
  id: string;
  studentName: string;
  studentEmail: string | null;
  lmsUserId?: string | null;
  title: string;
  question: string;
  status: CaseStatus;
  priority?: string | null;
  courseSlug?: string | null;
  batchNo?: number | null;
  moduleSlug?: string | null;
  contentSlug?: string | null;
  tags: string[];
  visibility: IssueVisibility;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicIssueDetail = Pick<
  SupportIssueListItem,
  | "id"
  | "title"
  | "question"
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
    ? readStudentEmail(item.studentEmailEncrypted, item.studentEmail)
    : null,
  lmsUserId: (item.lmsUserId as string | null) ?? null,
  title: String(item.title),
  question: String(item.question),
  status: item.status as CaseStatus,
  priority: item.priority as string | null | undefined,
  courseSlug: item.courseSlug as string | null | undefined,
  batchNo: item.batchNo as number | null | undefined,
  moduleSlug: item.moduleSlug as string | null | undefined,
  contentSlug: item.contentSlug as string | null | undefined,
  tags: Array.isArray(item.tags) ? item.tags as string[] : [],
  visibility: item.visibility === "PUBLISHED" ? "PUBLISHED" : "INTERNAL",
  publishedAt: item.publishedAt as Date | null | undefined,
  createdAt: item.createdAt as Date | undefined,
  updatedAt: item.updatedAt as Date | undefined,
});

const toPublicIssueListItem = (item: LeanDoc): PublicIssueListItem => {
  const mapped = toIssueListItem(item, false);
  return {
    id: mapped.id,
    title: mapped.title,
    question: mapped.question,
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
  const searchRegex = buildSearchRegex(params.q);
  if (!publicOnly && isExactEmailQuery) {
    filter.$or = createStudentEmailLookupCandidates(normalizedQuery);
  } else if (searchRegex) {
    if (publicOnly) {
      filter.$or = [
        { title: searchRegex },
        { question: searchRegex },
        { tags: searchRegex },
        { courseSlug: searchRegex },
      ];
    } else {
      filter.searchText = searchRegex;
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
  actorRole: "ADMIN" | "MENTOR",
  operationId: string,
  initialReply: InitialReplyInput | null = null,
  solveIssue = false,
) {
  const parsed = supportIssueInputSchema.parse(input);
  const parsedOperationId = operationIdSchema.parse(operationId);
  const requestHash = mutationRequestHash({ input: parsed, initialReply, solveIssue });
  await dbConnect();
  const actorObjectId = new mongoose.Types.ObjectId(actorId);

  const { studentEmail, ...issueFields } = parsed;
  const protectedEmail = protectStudentEmail(studentEmail);

  // For MENTOR role, enforce mentorId = actorId (ignore input)
  // For ADMIN role, allow custom mentorId or default to actorId
  const effectiveMentorId = actorRole === "MENTOR" 
    ? actorObjectId 
    : (parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : actorObjectId);

  const existing = await SupportIssueModel.findOne({
    createdBy: actorObjectId,
    createOperationId: parsedOperationId,
  }).select("+studentEmail").lean();
  if (existing) {
    assertOperationPayload(existing.createOperationHash, requestHash);
    return toIssueListItem(existing);
  }

  try {
    const supportIssue = await mongoose.connection.transaction(async (session) => {
      const finalStatus = initialReply && solveIssue ? "SOLVED" : "OPEN";
      const searchText = initialReply
        ? buildIssueSearchTextWithReplies(parsed, [initialReply.body])
        : buildIssueSearchText(parsed);
      const [createdIssue] = await SupportIssueModel.create([{
        ...issueFields,
        studentEmailEncrypted: protectedEmail.encrypted,
        studentEmailLookup: protectedEmail.lookup,
        status: finalStatus,
        searchText,
        mentorId: effectiveMentorId,
        createdBy: actorObjectId,
        updatedBy: actorObjectId,
        createOperationId: parsedOperationId,
        createOperationHash: requestHash,
      }], { session });

      if (initialReply) {
        const [reply] = await SupportReplyModel.create([{
          ...initialReply,
          issueId: createdIssue._id,
          authorId: actorObjectId,
        }], { session });
        const context = await getRequestContext();
        await recordAuditEvent({
          actorId,
          action: "REPLY_CREATE",
          resourceType: "SupportReply",
          resourceId: String(reply._id),
          result: "SUCCEEDED",
        }, context, session);
      }

      const context = await getRequestContext();
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
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await SupportIssueModel.findOne({
      createdBy: actorObjectId,
      createOperationId: parsedOperationId,
    }).select("+studentEmail").lean();
    if (!duplicate) throw error;
    assertOperationPayload(duplicate.createOperationHash, requestHash);
    return toIssueListItem(duplicate);
  }
}

export async function updateIssue(
  id: string,
  input: SupportIssueInput,
  actorId: string,
  actorRole: "ADMIN" | "MENTOR",
  expectedUpdatedAt: Date,
) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const parsed = supportIssueInputSchema.parse(input);
  await dbConnect();

  const { studentEmail, ...issueFields } = parsed;
  const protectedEmail = protectStudentEmail(studentEmail);

  // For MENTOR role, enforce mentorId = actorId (ignore input)
  // For ADMIN role, allow custom mentorId
  const effectiveMentorId = actorRole === "MENTOR"
    ? new mongoose.Types.ObjectId(actorId)
    : (parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : undefined);

  const updateData: Record<string, unknown> = {
    ...issueFields,
    studentEmailEncrypted: protectedEmail.encrypted,
    studentEmailLookup: protectedEmail.lookup,
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

  return mongoose.connection.transaction(async (session) => {
    const replies = await SupportReplyModel.find({ issueId: id, deletedAt: null })
      .select("body")
      .session(session)
      .lean();
    updateData.searchText = buildIssueSearchTextWithReplies(
      parsed,
      replies.map((reply) => reply.body),
    );

    const supportIssue = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null, updatedAt: expectedUpdatedAt },
    {
      $set: updateData,
      $unset: { studentEmail: "", studentEmailHash: "" },
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

    const context = await getRequestContext();
    await recordAuditEvent({
      actorId,
      action: "ISSUE_UPDATE",
      resourceType: "SupportIssue",
      resourceId: id,
      result: supportIssue ? "SUCCEEDED" : "DENIED",
    }, context, session);

    return supportIssue ? toIssueListItem(supportIssue) : null;
  });
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
