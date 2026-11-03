import "server-only";

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildSearchRegex } from "@/lib/search";
import {
  N8nAccessRequestModel,
  ToolAccessEntitlementModel,
  UserModel,
  type AccessRejectionReason,
  type N8nRequestStatus,
  type N8nRequestType,
} from "@/models";
import {
  ACCESS_COURSE_SLUG,
  agentEnrollmentAllows,
  MISSING_AGENT_ENROLLMENT,
  type LmsAgentEnrollment,
} from "@/lib/agent-enrollment-rules";
import { getAgentEnrollment, getAgentEnrollmentsByEmails } from "@/lib/lms";
import {
  accessExpiresAt,
  entitlementToolForRequest,
  requestCreatesEntitlement,
  TOOL_ACCESS_POLICY,
  toolEntitlementState,
} from "@/lib/tool-access-policy";
import { recordAuditEvent, type AuditEventContext } from "@/lib/services/audit";

/** Resolves the local student row into its `agent` enrolment snapshot. */
export async function getStudentAgentEnrollment(
  studentId: string,
): Promise<LmsAgentEnrollment> {
  if (!mongoose.isValidObjectId(studentId)) return MISSING_AGENT_ENROLLMENT;
  await dbConnect();
  const student = await UserModel.findById(studentId).select("email").lean();
  return getAgentEnrollment(student?.email ?? null);
}

export async function createN8nRequest(
  studentId: string,
  requestType: N8nRequestType,
  purpose?: string,
  createdBy?: string,
) {
  await dbConnect();
  const agent = await getStudentAgentEnrollment(studentId);
  // Defence in depth: the actions check this too, but the service is the last
  // gate for any future caller.
  if (!agentEnrollmentAllows(agent)) return null;
  const tool = entitlementToolForRequest(requestType);
  const entitlement = await ToolAccessEntitlementModel.findOne({ studentId, tool }).lean();
  if (requestCreatesEntitlement(requestType) && entitlement) return null;
  if (
    requestType === "PASSWORD_RESET" &&
    (!entitlement || toolEntitlementState(entitlement) !== "ACTIVE")
  ) return null;
  try {
    return await mongoose.connection.transaction(async (session) => {
      // A student may retry after a failure, but the old row must no longer be
      // actionable or an admin could send both the old and the new request.
      await N8nAccessRequestModel.updateMany(
        { studentId, requestType, status: "FAILED" },
        { $set: { status: "SUPERSEDED" } },
        { session },
      );
      const [created] = await N8nAccessRequestModel.create([{
        studentId,
        requestType,
        purpose: purpose || null,
        createdBy: createdBy || null,
        courseSlug: ACCESS_COURSE_SLUG,
        batchNo: agent.batchNo,
        enrollmentId:
          agent.enrollmentId && mongoose.isValidObjectId(agent.enrollmentId)
            ? new mongoose.Types.ObjectId(agent.enrollmentId)
            : null,
      }], { session });
      return created;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return null;
    throw error;
  }
}

export async function listOwnN8nRequests(studentId: string) {
  await dbConnect();
  if (!mongoose.isValidObjectId(studentId)) return [];
  return N8nAccessRequestModel.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: "$requestType", latest: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$latest" } },
    { $sort: { createdAt: -1, _id: -1 } },
  ]);
}

export async function listOwnToolEntitlements(studentId: string) {
  await dbConnect();
  if (!mongoose.isValidObjectId(studentId)) return [];
  return ToolAccessEntitlementModel.find({ studentId })
    .select("tool grantedAt expiresAt revokedAt")
    .lean();
}

export async function listN8nRequests() {
  await dbConnect();
  const requests = await N8nAccessRequestModel.find({}).sort({ createdAt: -1 }).limit(100).lean();
  const userIds = requests.flatMap((request) => [request.studentId, request.createdBy].filter(Boolean));
  const students = await UserModel.find({ _id: { $in: userIds } })
    .select("name email").lean();
  const byId = new Map(students.map((student) => [student._id.toString(), student]));
  return requests.map((request) => ({
    id: request._id.toString(),
    requestType: request.requestType,
    status: request.status,
    attempts: request.attempts,
    createdAt: request.createdAt,
    sentAt: request.sentAt,
    purpose: request.purpose,
    createdBy: request.createdBy ? byId.get(request.createdBy.toString()) ?? null : null,
    student: byId.get(request.studentId.toString()) ?? null,
  }));
}

const STAFF_QUEUE_LIMIT = 25;
/** Upper bound on the ids a search may fan out to, so one broad term cannot build an unbounded `$in`. */
const SEARCH_USER_LIMIT = 200;

export type StaffAccessQueueQuery = {
  requestTypes: N8nRequestType[];
  statuses?: readonly N8nRequestStatus[];
  /** Partial student email. Empty means no email filter. */
  search?: string;
  page?: number;
  limit?: number;
};

/**
 * The queue reads `student.email`, which lives on the user document rather than
 * on the request, so an email search resolves matching user ids first and then
 * filters requests by those ids. The cap keeps a broad term (or one character)
 * from producing an unbounded `$in`.
 */
async function findStudentIdsByEmail(search: string) {
  const regex = buildSearchRegex(search);
  if (!regex) return [];
  const users = await UserModel.find({ email: regex })
    .select("_id")
    .limit(SEARCH_USER_LIMIT)
    .lean();
  return users.map((user) => user._id);
}

export async function listN8nRequestQueue({
  requestTypes,
  statuses,
  search = "",
  page = 1,
  limit = STAFF_QUEUE_LIMIT,
}: StaffAccessQueueQuery) {
  await dbConnect();
  const safePage = Math.max(1, Math.trunc(page));
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const trimmedSearch = search.trim();

  // A one-character search has no regex, and returning every row for it would
  // look like a match. Fail closed instead: the admin types one more character.
  if (trimmedSearch && !buildSearchRegex(trimmedSearch)) {
    return { items: [], page: 1, total: 0, totalPages: 1 };
  }

  const filter: Record<string, unknown> = {
    requestType: { $in: requestTypes },
  };
  if (statuses && statuses.length > 0) {
    filter.status = { $in: statuses };
  }
  if (trimmedSearch) {
    filter.studentId = { $in: await findStudentIdsByEmail(trimmedSearch) };
  }

  const [requests, total] = await Promise.all([
    N8nAccessRequestModel.aggregate([
      { $match: filter },
      {
        $set: {
          staffQueueRank: {
            $switch: {
              branches: [
                { case: { $in: ["$status", ["PENDING", "FAILED"]] }, then: 0 },
                { case: { $eq: ["$status", "PROCESSING"] }, then: 1 },
                { case: { $eq: ["$status", "SENT"] }, then: 2 },
              ],
              default: 3,
            },
          },
        },
      },
      { $sort: { staffQueueRank: 1, createdAt: -1, _id: -1 } },
      { $skip: (safePage - 1) * safeLimit },
      { $limit: safeLimit },
    ]),
    N8nAccessRequestModel.countDocuments(filter),
  ]);
  const userIds = requests.flatMap((request) => [request.studentId, request.createdBy].filter(Boolean));
  const users = await UserModel.find({ _id: { $in: userIds } }).select("name email").lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));

  const studentObjectIds = [...new Set(requests.map((request) => String(request.studentId)))]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // One bounded aggregation for the page instead of one query per row.
  const historyRows = studentObjectIds.length === 0
    ? []
    : await N8nAccessRequestModel.aggregate<{
        _id: { studentId: mongoose.Types.ObjectId; requestType: N8nRequestType };
        firstRequestedAt: Date;
        count: number;
        firstSentAt: Date | null;
        lastSentAt: Date | null;
      }>([
        { $match: { studentId: { $in: studentObjectIds } } },
        {
          $group: {
            _id: { studentId: "$studentId", requestType: "$requestType" },
            firstRequestedAt: { $min: "$createdAt" },
            count: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
            firstSentAt: {
              $min: { $cond: [{ $eq: ["$status", "SENT"] }, "$sentAt", null] },
            },
            lastSentAt: {
              $max: { $cond: [{ $eq: ["$status", "SENT"] }, "$sentAt", null] },
            },
          },
        },
      ]);

  const historyByKey = new Map(
    historyRows.map((row) => [`${row._id.studentId}:${row._id.requestType}`, row]),
  );

  const emails = [...new Set(users.map((user) => user.email).filter(Boolean))];
  // Two LMS reads for the whole page instead of two per row.
  const agentByEmail = await getAgentEnrollmentsByEmails(emails);
  const entitlements = studentObjectIds.length === 0
    ? []
    : await ToolAccessEntitlementModel.find({ studentId: { $in: studentObjectIds } })
      .select("studentId tool grantedAt expiresAt revokedAt")
      .lean();
  const entitlementByKey = new Map(
    entitlements.map((row) => [`${row.studentId}:${row.tool}`, row]),
  );

  return {
    items: requests.map((request) => {
      const student = byId.get(request.studentId.toString()) ?? null;
      const agent = student?.email ? agentByEmail.get(student.email) : undefined;
      const history = historyByKey.get(
        `${request.studentId}:${request.requestType}`,
      );
      const tool = entitlementToolForRequest(request.requestType as N8nRequestType);
      const entitlement = entitlementByKey.get(`${request.studentId}:${tool}`);

      return {
        id: request._id.toString(),
        requestType: request.requestType as N8nRequestType,
        status: request.status,
        attempts: request.attempts,
        createdAt: request.createdAt as Date,
        sentAt: request.sentAt as Date | null,
        purpose: request.purpose as string | null,
        createdBy: request.createdBy ? byId.get(request.createdBy.toString()) ?? null : null,
        student: student ? { name: student.name, email: student.email } : null,
        // Rows created before the snapshot existed fall back to the live batch,
        // so an eligible student never reads "not enrolled".
        batchNo: (request.batchNo as number | null) ?? agent?.batchNo ?? null,
        accessHistory: {
          firstRequestedAt: history?.firstRequestedAt ?? (request.createdAt as Date),
          count: history?.count ?? 0,
          firstSentAt: history?.firstSentAt ?? null,
          lastSentAt: history?.lastSentAt ?? null,
        },
        entitlement: entitlement
          ? {
              tool,
              grantedAt: entitlement.grantedAt,
              expiresAt: entitlement.expiresAt,
              state: toolEntitlementState(entitlement),
            }
          : null,
        agentEligible: agent ? agentEnrollmentAllows(agent) : false,
        currentBatchNo: agent?.batchNo ?? null,
      };
    }),
    page: safePage,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

/**
 * Outstanding work per tab. Deliberately independent of the email search and
 * the sent toggle: the badge answers "how many requests are still waiting?".
 */
export async function countPendingN8nRequests(requestTypes: N8nRequestType[]) {
  await dbConnect();
  return N8nAccessRequestModel.countDocuments({
    requestType: { $in: requestTypes },
    status: "PENDING",
  });
}

export async function getN8nRequestType(requestId: string) {
  if (!mongoose.isValidObjectId(requestId)) return null;
  await dbConnect();
  const request = await N8nAccessRequestModel.findById(requestId).select("requestType").lean();
  return request?.requestType ?? null;
}

export async function claimN8nRequest(requestId: string, adminId: string) {
  if (!mongoose.isValidObjectId(requestId)) return null;
  await dbConnect();
  const now = new Date();
  const leaseId = randomUUID();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  // The LMS lives in another database/client, so its read stays outside the
  // transaction (only transactional DB work runs inside).
  const owner = await N8nAccessRequestModel.findById(requestId)
    .select("studentId requestType")
    .lean();
  const ownerStudent = owner
    ? await UserModel.findById(owner.studentId).select("email").lean()
    : null;
  const agentAllowed = agentEnrollmentAllows(
    await getAgentEnrollment(ownerStudent?.email ?? null),
  );

  return mongoose.connection.transaction(async (session) => {
    const candidate = await N8nAccessRequestModel.findById(requestId).session(session).lean();
    if (
      !candidate ||
      candidate.status === "SENT" ||
      candidate.status === "REJECTED" ||
      candidate.status === "SUPERSEDED"
    ) return null;

    const tool = entitlementToolForRequest(candidate.requestType);
    const entitlement = await ToolAccessEntitlementModel.findOne({
      studentId: candidate.studentId,
      tool,
    }).session(session).lean();
    if (requestCreatesEntitlement(candidate.requestType) && entitlement) return null;
    if (
      candidate.requestType === "PASSWORD_RESET" &&
      (!entitlement || toolEntitlementState(entitlement) !== "ACTIVE")
    ) return null;

    const newerActive = await N8nAccessRequestModel.exists({
      _id: { $ne: candidate._id },
      studentId: candidate.studentId,
      requestType: candidate.requestType,
      status: { $in: ["PENDING", "PROCESSING"] },
      createdAt: { $gt: candidate.createdAt },
    }).session(session);
    if (newerActive) {
      await N8nAccessRequestModel.updateOne(
        { _id: candidate._id, status: { $in: ["PENDING", "FAILED"] } },
        { $set: { status: "SUPERSEDED" } },
        { session },
      );
      return null;
    }

    const request = await N8nAccessRequestModel.findOneAndUpdate(
      {
        _id: candidate._id,
        $or: [
          { status: { $in: ["PENDING", "FAILED"] } },
          { status: "PROCESSING", processingExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "PROCESSING",
          processingStartedAt: now,
          processingExpiresAt: expiresAt,
          processingLeaseId: leaseId,
          handledBy: new mongoose.Types.ObjectId(adminId),
          failureCode: null,
        },
        $inc: { attempts: 1 },
      },
      { new: true, session, select: "+processingLeaseId" },
    ).lean();
    if (!request) return null;
    const student = await UserModel.findById(request.studentId)
      .select("name email isActive")
      .session(session)
      .lean();
    if (!student || !agentAllowed) {
      await N8nAccessRequestModel.updateOne(
        { _id: request._id, processingLeaseId: leaseId },
        {
          $set: {
            status: "FAILED",
            failureCode: student ? "AGENT_ENROLLMENT_UNAVAILABLE" : "STUDENT_NOT_FOUND",
          },
          $unset: { processingLeaseId: "", processingExpiresAt: "" },
        },
        { session },
      );
      return null;
    }
    return { request, student, leaseId };
  });
}

export async function markN8nRequestSent(requestId: string, leaseId: string) {
  const grantedAt = new Date();
  return mongoose.connection.transaction(async (session) => {
    const request = await N8nAccessRequestModel.findOne({
      _id: requestId,
      status: "PROCESSING",
      processingLeaseId: leaseId,
    }).session(session).lean();
    if (!request) return false;

    if (requestCreatesEntitlement(request.requestType)) {
      const tool = entitlementToolForRequest(request.requestType);
      const existing = await ToolAccessEntitlementModel.exists({
        studentId: request.studentId,
        tool,
      }).session(session);
      if (existing) return false;
      const policy = TOOL_ACCESS_POLICY[tool];
      await ToolAccessEntitlementModel.create([{
        studentId: request.studentId,
        tool,
        policyKey: policy.key,
        policyDurationMonths: policy.durationMonths,
        courseSlug: request.courseSlug || ACCESS_COURSE_SLUG,
        enrollmentId: request.enrollmentId ?? null,
        grantedBatchNo: request.batchNo ?? null,
        sourceRequestId: request._id,
        grantedAt,
        expiresAt: accessExpiresAt(tool, grantedAt),
      }], { session });
    }

    const result = await N8nAccessRequestModel.updateOne(
      { _id: request._id, status: "PROCESSING", processingLeaseId: leaseId },
      {
        $set: { status: "SENT", sentAt: grantedAt, failureCode: null },
        $unset: { processingLeaseId: "", processingExpiresAt: "" },
      },
      { session },
    );
    return result.modifiedCount === 1;
  });
}

export async function markN8nRequestFailed(
  requestId: string,
  leaseId: string,
  failureCode = "EMAIL_SEND_FAILED",
) {
  const result = await N8nAccessRequestModel.updateOne(
    { _id: requestId, status: "PROCESSING", processingLeaseId: leaseId },
    {
      $set: { status: "FAILED", failureCode },
      $unset: { processingLeaseId: "", processingExpiresAt: "" },
    },
  );
  return result.modifiedCount === 1;
}

export async function rejectN8nRequest(input: {
  requestId: string;
  adminId: string;
  reason: AccessRejectionReason;
  note?: string;
  context?: AuditEventContext;
}) {
  if (!mongoose.isValidObjectId(input.requestId) || !mongoose.isValidObjectId(input.adminId)) {
    return null;
  }
  await dbConnect();
  const now = new Date();

  return mongoose.connection.transaction(async (session) => {
    const request = await N8nAccessRequestModel.findOneAndUpdate(
      { _id: input.requestId, status: { $in: ["PENDING", "FAILED"] } },
      {
        $set: {
          status: "REJECTED",
          rejectedAt: now,
          rejectedBy: new mongoose.Types.ObjectId(input.adminId),
          handledBy: new mongoose.Types.ObjectId(input.adminId),
          rejectionReasonCode: input.reason,
          rejectionNote: input.note?.trim() || null,
          rejectionEmailStatus: "PENDING",
          failureCode: null,
        },
        $unset: { processingLeaseId: "", processingExpiresAt: "" },
      },
      { new: true, session },
    ).lean();
    if (!request) return null;

    const student = await UserModel.findById(request.studentId)
      .select("name email isActive")
      .session(session)
      .lean();
    if (!student?.email) {
      await N8nAccessRequestModel.updateOne(
        { _id: request._id },
        { $set: { rejectionEmailStatus: "FAILED" } },
        { session },
      );
    }

    await recordAuditEvent({
      actorId: input.adminId,
      action: "ACCESS_REQUEST_REJECT",
      resourceType: "N8nAccessRequest",
      resourceId: request._id.toString(),
      result: "SUCCEEDED",
    }, input.context, session);

    return { request, student };
  });
}

export async function markRejectionEmailResult(requestId: string, sent: boolean) {
  const result = await N8nAccessRequestModel.updateOne(
    { _id: requestId, status: "REJECTED", rejectionEmailStatus: "PENDING" },
    sent
      ? { $set: { rejectionEmailStatus: "SENT", rejectionEmailSentAt: new Date() } }
      : { $set: { rejectionEmailStatus: "FAILED" } },
  );
  return result.modifiedCount === 1;
}
