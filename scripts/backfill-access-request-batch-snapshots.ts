/**
 * Backfills requested batch snapshots on historical `n8n-access-requests` rows.
 *
 * Only rows where `batchNo` is still `null` are considered. Existing snapshots
 * are never overwritten, so a later LMS batch change cannot rewrite history.
 *
 * Dry-run (default): npm run db:backfill-access-request-batch-snapshots
 * Apply: npm run db:backfill-access-request-batch-snapshots -- --apply --confirm=<db>
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { maskEmail } from "../lib/bulk-access-input";
import { N8nAccessRequestModel, UserModel } from "../models";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rankStatus = (status: unknown) => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "running") return 2;
  if (normalized === "completed") return 1;
  return 0;
};

const selectEnrollment = (rows: Array<{ _id?: unknown; batchNo?: unknown; status?: unknown }>) => {
  if (rows.length === 0) return null;
  const best = rows.reduce((current, row) => {
    const diff = rankStatus(row.status) - rankStatus(current.status);
    if (diff > 0) return row;
    if (diff < 0) return current;
    return Number(row.batchNo ?? 0) > Number(current.batchNo ?? 0) ? row : current;
  });
  const batch = Number(best.batchNo);
  const allowedStatus = rankStatus(best.status) > 0;
  if (!allowedStatus || !Number.isInteger(batch) || batch < 1) return null;
  return {
    batchNo: batch,
    enrollmentId:
      best._id && mongoose.isValidObjectId(String(best._id)) ? new mongoose.Types.ObjectId(String(best._id)) : null,
    allowed: true,
  };
};

async function main() {
  await dbConnect();
  const dbName = process.env.MONGODB_DB;
  if (apply && confirmation !== dbName) {
    throw new Error(`Refusing apply: pass --confirm=${dbName} to confirm the target database`);
  }
  const lmsDbName = process.env.LMS_MONGODB_DB?.trim() || "hp-v2";
  const lmsDb = mongoose.connection.getClient().db(lmsDbName);

  const nullRequests = await N8nAccessRequestModel.find({ batchNo: null })
    .select("_id studentId requestType status")
    .lean();

  const studentIds = [...new Set(nullRequests.map((row) => String(row.studentId)))].filter((id) =>
    mongoose.isValidObjectId(id),
  );

  const users = await UserModel.find({ _id: { $in: studentIds } }).select("email").lean();
  const emailById = new Map(users.map((user) => [String(user._id), String(user.email || "").trim().toLowerCase()]));

  const byStudent = new Map<string, mongoose.Types.ObjectId[]>();
  for (const row of nullRequests) {
    const id = String(row.studentId);
    const list = byStudent.get(id) ?? [];
    list.push(row._id as mongoose.Types.ObjectId);
    byStudent.set(id, list);
  }

  const report = {
    database: dbName,
    mode: apply ? "APPLY" : "DRY RUN",
    nullRequestRows: nullRequests.length,
    students: studentIds.length,
    missingLocalUser: 0,
    missingLmsUser: 0,
    noAllowedEnrollment: 0,
    resolvableStudents: 0,
    resolvableRequestRows: 0,
    updatedRequestRows: 0,
    updatedStudents: 0,
    unresolvedStudents: [] as string[],
    batchCounts: {} as Record<string, number>,
    unresolvedByStatus: {} as Record<string, number>,
  };

  for (const studentId of studentIds) {
    const email = emailById.get(studentId);
    if (!email) {
      report.missingLocalUser += 1;
      report.unresolvedStudents.push(`local-user-missing:${studentId}`);
      continue;
    }

    const lmsUser = await lmsDb.collection("User").findOne(
      { email: { $regex: `^${escapeRegex(email)}$`, $options: "i" } },
      { projection: { _id: 1 } },
    );
    if (!lmsUser?._id) {
      report.noAllowedEnrollment += 1;
      report.unresolvedStudents.push(maskEmail(email));
      continue;
    }

    const enrollments = await lmsDb.collection("EnrolledCourse").find(
      { userId: lmsUser._id, courseSlug: "agent" },
      { projection: { _id: 1, batchNo: 1, status: 1 } },
    ).toArray();

    const best = selectEnrollment(enrollments);
    if (!best || !best.allowed) {
      report.noAllowedEnrollment += 1;
      report.unresolvedStudents.push(maskEmail(email));
      continue;
    }

    const ids = byStudent.get(studentId) ?? [];
    if (ids.length === 0) continue;

    report.resolvableStudents += 1;
    report.resolvableRequestRows += ids.length;
    report.batchCounts[String(best.batchNo)] = (report.batchCounts[String(best.batchNo)] ?? 0) + ids.length;

    if (!apply) continue;

    const result = await N8nAccessRequestModel.updateMany(
      { _id: { $in: ids }, batchNo: null },
      {
        $set: {
          courseSlug: "agent",
          batchNo: best.batchNo,
          enrollmentId: best.enrollmentId,
        },
      },
    );

    report.updatedRequestRows += result.modifiedCount;
    report.updatedStudents += 1;
  }

  const unresolvedRows = await N8nAccessRequestModel.find({ batchNo: null }).select("status").lean();
  for (const row of unresolvedRows) {
    const status = String(row.status);
    report.unresolvedByStatus[status] = (report.unresolvedByStatus[status] ?? 0) + 1;
  }

  console.info("[backfill-access-batch-snapshots] summary", report);
  if (!apply) {
    console.info("Dry run only. Apply with --apply --confirm=<db>.");
  } else {
    console.info(
      `[backfill-access-batch-snapshots] updated ${report.updatedRequestRows} request rows for ${report.updatedStudents} students`,
    );
  }

  if (report.unresolvedStudents.length > 0) {
    console.warn(
      `[backfill-access-batch-snapshots] unresolved students (${report.unresolvedStudents.length}): ${report.unresolvedStudents.join(", ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[backfill-access-batch-snapshots] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
