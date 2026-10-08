import "server-only";

import { dbConnect } from "@/lib/db";
import { SolutionArticleModel, SupportCaseModel, UserModel, type CaseStatus } from "@/models";

export type DashboardStats = {
  totalCases: number;
  unresolvedCases: number;
  totalSolutions: number;
  staffCount: number;
  weeklyCases: number;
};

export type TagCount = { tag: string; count: number };

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