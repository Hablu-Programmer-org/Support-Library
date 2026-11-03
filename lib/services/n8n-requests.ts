import "server-only";

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { buildSearchRegex } from "@/lib/search";
import {
  N8nAccessRequestModel,
  UserModel,
  type N8nRequestStatus,
  type N8nRequestType,
} from "@/models";

export async function createN8nRequest(
  studentId: string,
  requestType: N8nRequestType,
  purpose?: string,
  createdBy?: string,
) {
  await dbConnect();
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
  return {
    items: requests.map((request) => ({
      id: request._id.toString(),
      requestType: request.requestType as N8nRequestType,
      status: request.status,
      attempts: request.attempts,
      createdAt: request.createdAt as Date,
      sentAt: request.sentAt as Date | null,
      purpose: request.purpose as string | null,
      createdBy: request.createdBy ? byId.get(request.createdBy.toString()) ?? null : null,
      student: byId.get(request.studentId.toString()) ?? null,
    })),
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
  return mongoose.connection.transaction(async (session) => {
    const candidate = await N8nAccessRequestModel.findById(requestId).session(session).lean();
    if (!candidate || candidate.status === "SENT" || candidate.status === "SUPERSEDED") return null;

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
    if (!student) {
      await N8nAccessRequestModel.updateOne(
        { _id: request._id, processingLeaseId: leaseId },
        {
          $set: { status: "FAILED", failureCode: "STUDENT_NOT_FOUND" },
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
  const result = await N8nAccessRequestModel.updateOne(
    { _id: requestId, status: "PROCESSING", processingLeaseId: leaseId },
    {
      $set: { status: "SENT", sentAt: new Date(), failureCode: null },
      $unset: { processingLeaseId: "", processingExpiresAt: "" },
    },
  );
  return result.modifiedCount === 1;
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
