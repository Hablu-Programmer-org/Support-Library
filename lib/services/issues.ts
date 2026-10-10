import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildIssueSearchText, buildSearchRegex } from "@/lib/search";
import { supportIssueInputSchema, type SupportIssueFilter, type SupportIssueInput } from "@/lib/validation";
import { CASE_PRIORITIES, SupportIssueModel, type CaseStatus } from "@/models";

type LeanDoc = Record<string, unknown>;

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
  createdAt?: Date;
  updatedAt?: Date;
};

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
  createdAt: item.createdAt as Date | undefined,
  updatedAt: item.updatedAt as Date | undefined,
});

function buildIssueFilter(params: IssueListParams = {}) {
  const filter: Record<string, unknown> = { deletedAt: null };

  if (params.status) filter.status = params.status;
  if (params.courseSlug) filter.courseSlug = params.courseSlug;
  if (params.batchNo) filter.batchNo = params.batchNo;
  if (params.tag) filter.tags = params.tag.toLowerCase();
  if (params.mentorId && mongoose.Types.ObjectId.isValid(params.mentorId)) filter.mentorId = params.mentorId;
  const searchRegex = buildSearchRegex(params.q);
  if (searchRegex) filter.searchText = searchRegex;
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: new Date(params.from) } : {}),
      ...(params.to ? { $lte: new Date(params.to) } : {}),
    };
  }

  return filter;
}

export async function createIssue(input: SupportIssueInput, actorId: string) {
  const parsed = supportIssueInputSchema.parse(input);
  await dbConnect();

  const supportIssue = await SupportIssueModel.create({
    ...parsed,
    searchText: buildIssueSearchText(parsed),
    mentorId: parsed.mentorId ? new mongoose.Types.ObjectId(parsed.mentorId) : new mongoose.Types.ObjectId(actorId),
    createdBy: new mongoose.Types.ObjectId(actorId),
    updatedBy: new mongoose.Types.ObjectId(actorId),
  });

  return toIssueListItem(supportIssue.toObject());
}

export async function updateIssue(id: string, input: SupportIssueInput, actorId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const parsed = supportIssueInputSchema.parse(input);
  await dbConnect();

  const supportIssue = await SupportIssueModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      ...parsed,
      searchText: buildIssueSearchText(parsed),
      updatedBy: new mongoose.Types.ObjectId(actorId),
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

  const supportIssue = await SupportIssueModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(actorId),
      updatedBy: new mongoose.Types.ObjectId(actorId),
    },
    { new: true },
  ).lean();

  return supportIssue ? toIssueListItem(supportIssue) : null;
}

export async function listIssues(params: IssueListParams = {}) {
  await dbConnect();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter = buildIssueFilter(params);
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
        ])
      : SupportIssueModel.find(filter)
          .sort(params.sort === "oldest" ? { updatedAt: 1 } : { updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

  const [items, total] = await Promise.all([itemsQuery, SupportIssueModel.countDocuments(filter)]);

  return {
    items: (items as LeanDoc[]).map(toIssueListItem),
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
export async function listIssueFilterOptions() {
  await dbConnect();

  const [courseSlugs, batchNos] = await Promise.all([
    SupportIssueModel.distinct("courseSlug", {
      deletedAt: null,
      courseSlug: { $nin: [null, ""] },
    }) as Promise<unknown[]>,
    SupportIssueModel.distinct("batchNo", {
      deletedAt: null,
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