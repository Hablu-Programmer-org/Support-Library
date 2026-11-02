import "server-only";

import { dbConnect } from "@/lib/db";
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
