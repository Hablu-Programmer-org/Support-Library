import "server-only";

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { N8nAccessRequestModel, UserModel, type N8nRequestType } from "@/models";

export async function createN8nRequest(studentId: string, requestType: N8nRequestType, purpose?: string) {
  await dbConnect();
  try {
    return await N8nAccessRequestModel.create({ studentId, requestType, purpose: purpose || null });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return null;
    throw error;
  }
}

export async function listOwnN8nRequests(studentId: string) {
  await dbConnect();
  return N8nAccessRequestModel.find({ studentId })
    .sort({ createdAt: -1 }).limit(10).lean();
}

export async function listN8nRequests() {
  await dbConnect();
  const requests = await N8nAccessRequestModel.find({}).sort({ createdAt: -1 }).limit(100).lean();
  const students = await UserModel.find({ _id: { $in: requests.map((request) => request.studentId) } })
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
    student: byId.get(request.studentId.toString()) ?? null,
  }));
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
  const request = await N8nAccessRequestModel.findOneAndUpdate(
    { _id: requestId, status: { $in: ["PENDING", "FAILED"] } },
    { $set: { status: "PROCESSING", processingStartedAt: new Date(), handledBy: adminId, failureCode: null }, $inc: { attempts: 1 } },
    { new: true },
  ).lean();
  if (!request) return null;
  const student = await UserModel.findById(request.studentId).select("name email isActive").lean();
  return student ? { request, student } : null;
}

export async function markN8nRequestSent(requestId: string, adminId: string) {
  return N8nAccessRequestModel.updateOne(
    { _id: requestId, status: "PROCESSING", handledBy: adminId },
    { $set: { status: "SENT", sentAt: new Date(), failureCode: null } },
  );
}

export async function markN8nRequestFailed(requestId: string, adminId: string) {
  return N8nAccessRequestModel.updateOne(
    { _id: requestId, status: "PROCESSING", handledBy: adminId },
    { $set: { status: "FAILED", failureCode: "EMAIL_SEND_FAILED" } },
  );
}
