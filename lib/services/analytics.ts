import "server-only";

import { dbConnect } from "@/lib/db";
import { SupportIssueModel, UserModel, type CaseStatus } from "@/models";

export type DashboardStats = {
  totalIssues: number;
  unresolvedIssues: number;
  staffCount: number;
  weeklyIssues: number;
};

export type TagCount = { tag: string; count: number };

export async function getDashboardStats(): Promise<DashboardStats> {
  await dbConnect();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalIssues, unresolvedIssues, staffCount, weeklyIssues] = await Promise.all([
    SupportIssueModel.countDocuments({ deletedAt: null }),
    SupportIssueModel.countDocuments({ deletedAt: null, status: { $in: ["OPEN", "PENDING", "FOLLOW_UP"] } }),
    UserModel.countDocuments({}),
    SupportIssueModel.countDocuments({ deletedAt: null, createdAt: { $gte: weekStart } }),
  ]);

  return { totalIssues, unresolvedIssues, staffCount, weeklyIssues };
}

export async function getTopTags(limit = 12): Promise<TagCount[]> {
  await dbConnect();
  const rows = await SupportIssueModel.aggregate<{ _id: string; count: number }>([
    { $match: { deletedAt: null, tags: { $exists: true, $ne: [] } } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ tag: row._id, count: row.count }));
}

export async function getRecentUnresolvedIssues(limit = 8) {
  await dbConnect();
  const issues = await SupportIssueModel.find({
    deletedAt: null,
    status: { $in: ["OPEN", "PENDING", "FOLLOW_UP"] },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("title status updatedAt")
    .lean();

  return issues.map((item) => ({
    id: String(item._id),
    title: item.title,
    status: item.status as CaseStatus,
    updatedAt: item.updatedAt,
  }));
}