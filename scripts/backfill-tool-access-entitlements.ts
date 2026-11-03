/**
 * Backfills `tool-access-entitlements` from historical sent access requests.
 *
 * Dry-run (default): npm run db:backfill-tool-access-entitlements
 * Apply: npm run db:backfill-tool-access-entitlements -- --apply --confirm=<db>
 *
 * Policy:
 * - n8n entitlements start from the earliest SENT ACCESS request.
 * - OpenAI entitlements start from the earliest SENT OPENAI_ACCESS request.
 * - PASSWORD_RESET never creates or extends an entitlement.
 * - If sentAt is missing, the row is reported as needing manual review.
 * - Existing entitlements are never overwritten by this script.
 */
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { accessExpiresAt, requestCreatesEntitlement } from "../lib/tool-access-policy";
import { N8nAccessRequestModel, ToolAccessEntitlementModel, UserModel } from "../models";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10);

async function main() {
  await dbConnect();
  const dbName = process.env.MONGODB_DB;
  if (apply && confirmation !== dbName) {
    throw new Error(`Refusing apply: pass --confirm=${dbName} to confirm the target database`);
  }

  const sent = await N8nAccessRequestModel.find({ status: "SENT" })
    .select("studentId requestType sentAt batchNo enrollmentId courseSlug")
    .sort({ sentAt: 1, createdAt: 1 })
    .lean();
  const earliest = new Map<string, (typeof sent)[number]>();
  for (const row of sent) {
    if (!requestCreatesEntitlement(row.requestType)) continue;
    const key = `${row.studentId}:${row.requestType === "OPENAI_ACCESS" ? "OPENAI" : "N8N"}`;
    if (!earliest.has(key)) earliest.set(key, row);
  }

  const existing = await ToolAccessEntitlementModel.find({})
    .select("studentId policyKey")
    .lean();
  const existingKeys = new Set(existing.map((row) => `${row.studentId}:${row.policyKey}`));

  const report = {
    candidates: earliest.size,
    missingSentAt: 0,
    missingEnrollment: 0,
    existing: 0,
    toCreate: 0,
    created: 0,
    failed: 0,
  };

  for (const [key, row] of earliest) {
    const tool = key.endsWith("OPENAI") ? "OPENAI" : "N8N";
    const policyKey = tool === "OPENAI" ? "agent-openai-v1" : "agent-n8n-v1";
    const durationMonths = tool === "OPENAI" ? 2 : 12;
    if (existingKeys.has(`${row.studentId}:${policyKey}`)) {
      report.existing += 1;
      continue;
    }
    if (!row.sentAt) {
      report.missingSentAt += 1;
      console.warn(`[backfill] manual review required: student=${row.studentId} tool=${tool} has no sentAt`);
      continue;
    }
    if (!row.batchNo) {
      report.missingEnrollment += 1;
      console.warn(`[backfill] manual review recommended: student=${row.studentId} tool=${tool} has no batch snapshot`);
    }
    report.toCreate += 1;
    if (!apply) continue;

    try {
      const student = await UserModel.findById(row.studentId).select("isActive").lean();
      if (!student?.isActive) {
        report.failed += 1;
        console.warn(`[backfill] skipped inactive student=${row.studentId} tool=${tool}`);
        continue;
      }
      await ToolAccessEntitlementModel.create({
        studentId: row.studentId,
        tool,
        policyKey,
        policyDurationMonths: durationMonths,
        courseSlug: row.courseSlug || "agent",
        enrollmentId: row.enrollmentId ?? null,
        grantedBatchNo: row.batchNo ?? null,
        sourceRequestId: row._id,
        grantedAt: row.sentAt,
        expiresAt: accessExpiresAt(tool, row.sentAt),
      });
      report.created += 1;
    } catch (error) {
      report.failed += 1;
      console.error(`[backfill] failed student=${row.studentId} tool=${tool}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  console.info("[backfill] summary", report);
  if (!apply) console.info("Dry run only. Apply with --apply --confirm=<db>.");
}

main()
  .catch((error) => {
    console.error("[backfill] fatal", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
