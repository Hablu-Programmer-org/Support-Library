import "server-only";

import mongoose from "mongoose";
import bcrypt from "bcrypt";

import { dbConnect } from "@/lib/db";
import {
  assertOperationPayload,
  mutationRequestHash,
  operationIdSchema,
} from "@/lib/mutation-security";
import { buildIssueSearchText, buildIssueSearchTextWithReplies, buildSearchRegex } from "@/lib/search";
import {
  supportIssueInputSchema,
  type SupportIssueFilter,
  type SupportIssueInput,
  type SupportReplyInput,
} from "@/lib/validation";
import { recordAuditEvent } from "@/lib/services/audit";
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

export type IssueListParams = SupportIssueFilter & {
  page?: number;
  limit?: number;
};

const toIssueListItem = (item: LeanDoc): SupportIssueListItem => ({
  id: String(item._id),
  studentName: String(item.studentName ?? ""),
  studentEmail: (item.studentEmail as string | null) ?? null,
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

function buildIssueFilter(params: IssueListParams = {}, publicOnly = false) {
  const filter: Record<string, unknown> = { deletedAt: null };

  if (publicOnly) filter.visibility = "PUBLISHED";

  if (params.status) filter.status = params.status;
  if (params.courseSlug) filter.courseSlug = params.courseSlug;
  if (params.batchNo) filter.batchNo = params.batchNo;
  if (params.tag) filter.tags = params.tag.toLowerCase();
  if (params.mentorId && mongoose.Types.ObjectId.isValid(params.mentorId)) filter.mentorId = params.mentorId;
  const searchRegex = buildSearchRegex(params.q);
  if (searchRegex) {
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
  operationId: string,
  initialReply: InitialReplyInput | null = null,
  solveIssue = false,
) {
  const parsed = supportIssueInputSchema.parse(input);
  const parsedOperationId = operationIdSchema.parse(operationId);
  const requestHash = mutationRequestHash({ input: parsed, initialReply, solveIssue });
  await dbConnect();
  const actorObjectId = new mongoose.Types.ObjectId(actorId);

  // Hash the student email for privacy
  const studentEmailHash = await bcrypt.hash(parsed.studentEmail.toLowerCase().trim(), 12);

  const existing = await SupportIssueModel.findOne({
    createdBy: actorObjectId,
    createOperationId: parsedOperationId,
  }).lean();
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
        ...parsed,
        studentEmailHash,
        status: finalStatus,
        searchText,
        mentorId: parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : actorObjectId,
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
        await recordAuditEvent({
          actorId,
          action: "REPLY_CREATE",
          resourceType: "SupportReply",
          resourceId: String(reply._id),
          result: "SUCCEEDED",
        }, session);
      }

      return createdIssue.toObject();
    });

    return toIssueListItem(supportIssue);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await SupportIssueModel.findOne({
      createdBy: actorObjectId,
      createOperationId: parsedOperationId,
    }).lean();
    if (!duplicate) throw error;
    assertOperationPayload(duplicate.createOperationHash, requestHash);
    return toIssueListItem(duplicate);
  }
}

export async function updateIssue(id: string, input: SupportIssueInput, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const parsed = supportIssueInputSchema.parse(input);
  await dbConnect();

  // Hash the student email if it's being updated
  const studentEmailHash = await bcrypt.hash(parsed.studentEmail.toLowerCase().trim(), 12);

  const supportIssue = await SupportIssueModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      $set: {
        ...parsed,
        studentEmailHash,
        searchText: buildIssueSearchText(parsed),
        visibility: "INTERNAL",
        publishedAt: null,
        publishedBy: null,
        updatedBy: new mongoose.Types.ObjectId(actorId),
      },
      $push: {
        publicationHistory: {
          action: "CONTENT_CHANGED",
          actorId: new mongoose.Types.ObjectId(actorId),
          at: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();

  return supportIssue ? toIssueListItem(supportIssue) : null;
}

export async function changeIssueStatus(id: string, status: CaseStatus, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  const supportIssue = await SupportIssueModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { status, updatedBy: new mongoose.Types.ObjectId(actorId) },
    { new: true, runValidators: true },
  ).lean();

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
    await recordAuditEvent({
      actorId,
      action: "ISSUE_ARCHIVE",
      resourceType: "SupportIssue",
      resourceId: id,
      result: updated ? "SUCCEEDED" : "DENIED",
    }, session);
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
        ])
      : SupportIssueModel.find(filter)
          .select(options.publicOnly ? PUBLIC_ISSUE_FIELDS : "")
          .sort(params.sort === "oldest" ? { updatedAt: 1 } : { updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

  const [items, total] = await Promise.all([itemsQuery, SupportIssueModel.countDocuments(filter)]);

  return {
    items: (items as LeanDoc[]).map((item) => {
      const mapped = toIssueListItem(item);
      return options.publicOnly
        ? { ...mapped, studentName: "", studentEmail: null, lmsUserId: null }
        : mapped;
    }),
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

  const supportIssue = await SupportIssueModel.findOne({ _id: id, deletedAt: null }).lean();
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
    await recordAuditEvent({
      actorId,
      action: "ISSUE_PUBLISH",
      resourceType: "SupportIssue",
      resourceId: id,
      result: supportIssue ? "SUCCEEDED" : "DENIED",
    }, session);
    return supportIssue;
  });
}

export async function unpublishIssue(id: string, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await dbConnect();

  return mongoose.connection.transaction(async (session) => {
    const supportIssue = await SupportIssueModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
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
    await recordAuditEvent({
      actorId,
      action: "ISSUE_UNPUBLISH",
      resourceType: "SupportIssue",
      resourceId: id,
      result: supportIssue ? "SUCCEEDED" : "DENIED",
    }, session);
    return supportIssue;
  });
}
