import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildOwnIssueFilter } from "@/lib/issue-ownership";
import { SupportIssueModel } from "@/models";

export async function getIssueActivitySnapshot() {
  await dbConnect();
  const [latest, count] = await Promise.all([
    SupportIssueModel.findOne({ deletedAt: null }).select("updatedAt").sort({ updatedAt: -1 }).lean(),
    SupportIssueModel.countDocuments({ deletedAt: null }).maxTimeMS(5000),
  ]);
  const updatedAt = latest?.updatedAt?.toISOString() ?? "empty";
  return { revision: `${updatedAt}:${count}`, count };
}

/**
 * Student-scoped change signal for "My requests" and an open request.
 *
 * Same contract as the staff snapshot — a revision token and a count, never
 * content — but the filter is the authenticated student's own ownership scope.
 * One student can therefore never learn whether (or how often) another
 * student's request changed. `student_own_requests` backs both queries.
 */
export async function getOwnIssueActivitySnapshot(studentUserId: string) {
  if (!mongoose.isValidObjectId(studentUserId)) {
    return { revision: "empty", count: 0 };
  }
  await dbConnect();

  const filter = buildOwnIssueFilter(studentUserId);
  const [latest, count] = await Promise.all([
    SupportIssueModel.findOne(filter).select("updatedAt").sort({ updatedAt: -1 }).lean(),
    SupportIssueModel.countDocuments(filter).maxTimeMS(5000),
  ]);
  const updatedAt = latest?.updatedAt?.toISOString() ?? "empty";
  return { revision: `${updatedAt}:${count}`, count };
}
