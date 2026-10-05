import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { SolutionArticleModel, SupportCaseModel, SupportReplyModel, UserModel, type CaseStatus } from "@/models";

export type DashboardStats = {
  totalCases: number;
  unresolvedCases: number;
  totalSolutions: number;
  staffCount: number;
  weeklyCases: number;
};

export type StatusCount = { status: CaseStatus; count: number };
export type TagCount = { tag: string; count: number };
export type LabelCount = { label: string; count: number };

export type MentorActivity = {
  mentorId: string;
  mentorName: string;
  assignedCases: number;
  unresolvedCases: number;
  replies: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  await dbConnect();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalCases, unresolvedCases, totalSolutions, staffCount, weeklyCases] = await Promise.all([
    SupportCaseModel.countDocuments({ deletedAt: null }),
    SupportCaseModel.countDocuments({ deletedAt: null, status: { $in: ["OPEN", "PENDING", "FOLLOW_UP"] } }),
    SolutionArticleModel.countDocuments({ deletedAt: null }),
    UserModel.countDocuments({}),
    SupportCaseModel.countDocuments({ deletedAt: null, createdAt: { $gte: weekStart } }),
  ]);

  return { totalCases, unresolvedCases, totalSolutions, staffCount, weeklyCases };
}

export async function getStatusCounts(): Promise<StatusCount[]> {
  await dbConnect();
  const rows = await SupportCaseModel.aggregate<{ _id: CaseStatus; count: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((row) => ({ status: row._id, count: row.count }));
}

export async function getTopTags(limit = 12): Promise<TagCount[]> {
  await dbConnect();
  const rows = await SupportCaseModel.aggregate<{ _id: string; count: number }>([
    { $match: { deletedAt: null, tags: { $exists: true, $ne: [] } } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ tag: row._id, count: row.count }));
}

export async function getRecentUnresolvedCases(limit = 8) {
  await dbConnect();
  const cases = await SupportCaseModel.find({
    deletedAt: null,
    status: { $in: ["OPEN", "PENDING", "FOLLOW_UP"] },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("title status updatedAt")
    .lean();

  return cases.map((item) => ({
    id: String(item._id),
    title: item.title,
    status: item.status as CaseStatus,
    updatedAt: item.updatedAt,
  }));
}

const UNRESOLVED: CaseStatus[] = ["OPEN", "PENDING", "FOLLOW_UP"];

/** Live case counts grouped by course slug, highest first. */
export async function getCasesByCourse(limit = 20): Promise<LabelCount[]> {
  await dbConnect();
  const rows = await SupportCaseModel.aggregate<{ _id: string; count: number }>([
    { $match: { deletedAt: null, courseSlug: { $nin: [null, ""] } } },
    { $group: { _id: "$courseSlug", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ label: row._id, count: row.count }));
}

/** Live case counts grouped by batch number, highest first. */
export async function getCasesByBatch(limit = 20): Promise<LabelCount[]> {
  await dbConnect();
  const rows = await SupportCaseModel.aggregate<{ _id: number; count: number }>([
    { $match: { deletedAt: null, batchNo: { $ne: null } } },
    { $group: { _id: "$batchNo", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ label: String(row._id), count: row.count }));
}

/**
 * Per-mentor workload: how many cases they own, how many of those are still
 * unresolved, and how many replies they have written.
 *
 * Built from two independent aggregations rather than a `$lookup` so it stays
 * readable and does not need the reply collection to be populated first.
 */
export async function getMentorActivity(limit = 20): Promise<MentorActivity[]> {
  await dbConnect();

  const [caseRows, replyRows] = await Promise.all([
    SupportCaseModel.aggregate<{ _id: string; assignedCases: number; unresolvedCases: number }>([
      { $match: { deletedAt: null, mentorId: { $ne: null } } },
      {
        $group: {
          _id: "$mentorId",
          assignedCases: { $sum: 1 },
          unresolvedCases: {
            $sum: { $cond: [{ $in: ["$status", UNRESOLVED] }, 1, 0] },
          },
        },
      },
      { $sort: { assignedCases: -1 } },
      { $limit: limit },
    ]),
    SupportReplyModel.aggregate<{ _id: string; replies: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: "$authorId", replies: { $sum: 1 } } },
    ]),
  ]);

  const replyCounts = new Map(replyRows.map((row) => [row._id, row.replies]));
  const ids = caseRows.map((row) => new mongoose.Types.ObjectId(row._id));
  const mentors = ids.length
    ? await UserModel.find({ _id: { $in: ids } }).select("name").lean()
    : [];
  const names = new Map(mentors.map((mentor) => [String(mentor._id), mentor.name as string]));

  return caseRows.map((row) => ({
    mentorId: row._id,
    mentorName: names.get(row._id) ?? "Unknown",
    assignedCases: row.assignedCases,
    unresolvedCases: row.unresolvedCases,
    replies: replyCounts.get(row._id) ?? 0,
  }));
}
