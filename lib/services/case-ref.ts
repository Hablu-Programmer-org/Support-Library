import "server-only";

import type { ClientSession } from "mongoose";

import { CASE_REF_COUNTER_ID, formatCaseRef } from "@/lib/config/live-support";
import { CounterModel } from "@/models";

export { CASE_REF_COUNTER_ID };

/**
 * Reserve the next request reference.
 *
 * Must be called **inside** the issue-creation transaction: `$inc` is atomic, and
 * putting it in the same transaction means an aborted create rolls the number
 * back instead of burning it. A parallel create simply blocks on the counter row
 * until the first transaction commits.
 */
export async function nextCaseRef(session: ClientSession): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: CASE_REF_COUNTER_ID },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true },
  ).lean();

  if (!counter || typeof counter.seq !== "number") {
    throw new Error("Could not allocate a request reference");
  }

  return formatCaseRef(counter.seq);
}
