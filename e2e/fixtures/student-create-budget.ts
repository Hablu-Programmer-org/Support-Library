import { dbConnect } from "../../lib/db";
import { RateLimitBucketModel } from "../../models";
import { STAFF_USERS } from "./staff-users";

const STUDENT = STAFF_USERS.find((user) => user.role === "STUDENT")!;

/**
 * Students may create 5 requests per 10-minute window (`issue.create.student`).
 * One worker runs every student spec against the same account inside one
 * window, so each spec that creates requests starts from a fresh budget.
 * Only that account's create buckets are removed, and only in the E2E database
 * Playwright is pinned to. The limit itself is covered by unit tests.
 */
export async function resetStudentCreateBudget() {
  await dbConnect();
  await RateLimitBucketModel.deleteMany({
    key: { $regex: `^issue\.create\.student:${STUDENT.id}:` },
  });
}
