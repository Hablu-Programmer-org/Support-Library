import "server-only";

import { dbConnect } from "@/lib/db";
import { AccessEmailOutboxModel, N8nAccessRequestModel } from "@/models";

/** PII-free change token used to avoid refreshing the full queue unnecessarily. */
export async function getAccessRequestActivitySnapshot() {
  await dbConnect();
  const [latest, count] = await Promise.all([
    N8nAccessRequestModel.findOne({})
      .sort({ updatedAt: -1, _id: -1 })
      .select("updatedAt _id")
      .lean(),
    AccessEmailOutboxModel.countDocuments({
      status: { $in: ["QUEUED", "SENDING", "SMTP_ACCEPTED", "RETRY"] },
    }),
  ]);
  return {
    revision: latest
      ? `${latest.updatedAt.toISOString()}:${latest._id.toString()}`
      : "empty",
    count,
  };
}
