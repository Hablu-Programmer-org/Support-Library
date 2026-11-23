import "server-only";

import { dbConnect } from "@/lib/db";
import { toUnresolvedBreakdown, UNRESOLVED_STATUSES, type StatusCount } from "@/lib/status-breakdown";
import { SupportIssueModel, UserModel } from "@/models";

export type DashboardStats = {
  totalIssues: number;
  unresolvedIssues: number;
  staffCount: number;
  weeklyIssues: number;
};

export type TagCount = { tag: string; count: number };

export async function getDashboardStats(publicOnly = false): Promise<DashboardStats> {
  await dbConnect();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const baseFilter = publicOnly ? { deletedAt: null, visibility: "PUBLISHED" } : { deletedAt: null };

  const [totalIssues, unresolvedIssues, staffCount, weeklyIssues] = await Promise.all([
    SupportIssueModel.countDocuments(baseFilter),
    SupportIssueModel.countDocuments({ ...baseFilter, status: { $in: [...UNRESOLVED_STATUSES] } }),
    UserModel.countDocuments({}),
    SupportIssueModel.countDocuments({ ...baseFilter, createdAt: { $gte: weekStart } }),
  ]);

  return { totalIssues, unresolvedIssues, staffCount, weeklyIssues };
}

export async function getTopTags(limit = 12, publicOnly = false): Promise<TagCount[]> {
  await dbConnect();
  const rows = await SupportIssueModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        deletedAt: null,
        ...(publicOnly ? { visibility: "PUBLISHED" } : {}),
        tags: { $exists: true, $ne: [] },
      },
    },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ tag: row._id, count: row.count }));
}

/** Unresolved issues per status, every status present (zero-filled), in a fixed order. */
export async function getUnresolvedStatusBreakdown(): Promise<StatusCount[]> {
  await dbConnect();
  const rows = await SupportIssueModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { deletedAt: null, status: { $in: [...UNRESOLVED_STATUSES] } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return toUnresolvedBreakdown(rows);
}
