import "server-only";

import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";

import {
  decryptAccessEmailPayload,
  encryptAccessEmailPayload,
  type AccessEmailEncryptedPayload,
} from "@/lib/access-email-payload-crypto";
import { agentEnrollmentAllows } from "@/lib/agent-enrollment-rules";
import { dbConnect } from "@/lib/db";
import { getAgentEnrollment } from "@/lib/lms";
import {
  accessExpiresAt,
  entitlementToolForRequest,
  requestCreatesEntitlement,
  requestEntitlementAllowsProcessing,
  TOOL_ACCESS_POLICY,
  toolEntitlementState,
} from "@/lib/tool-access-policy";
import { recordAuditEvent, type AuditEventContext } from "@/lib/services/audit";
import {
  accessEmailMessageId,
  accessEmailPurgeAt,
  ACCESS_EMAIL_LEASE_MS,
  ACCESS_EMAIL_MAX_ATTEMPTS,
  ACCESS_EMAIL_PAYLOAD_TTL_MS,
  ACCESS_EMAIL_SMTP_DEADLINE_MS,
  accessEmailRetryDelay,
  approvalFinalizePlan,
  isTransientAccessEmailError,
  nextAccessEmailAttemptAt,
  notificationForRequest,
  recipientAccepted,
  sanitizedAccessEmailErrorCode,
} from "@/lib/access-email-outbox-policy";
import {
  closeAccessEmailTransport,
  sendAccessRejectionEmail,
  sendN8nHelpEmail,
  sendOpenAiConfirmationEmail,
} from "@/lib/services/n8n-email";
import {
  AccessEmailOutboxModel,
  N8nAccessRequestModel,
  ToolAccessEntitlementModel,
  UserModel,
  type AccessRejectionReason,
  type N8nRequestType,
} from "@/models";

const PAYLOAD_TTL_MS = ACCESS_EMAIL_PAYLOAD_TTL_MS;
const LEASE_MS = ACCESS_EMAIL_LEASE_MS;
const MAX_ATTEMPTS = ACCESS_EMAIL_MAX_ATTEMPTS;
const messageId = accessEmailMessageId;
const purgeAt = accessEmailPurgeAt;
const sanitizedErrorCode = sanitizedAccessEmailErrorCode;
const transientEmailError = isTransientAccessEmailError;
const acceptedRecipient = recipientAccepted;

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function queueAccessApprovalEmail(input: {
  requestId: string;
  adminId: string;
  expectedTypes: readonly N8nRequestType[];
  link?: string;
  context?: AuditEventContext;
}) {
  if (!mongoose.isValidObjectId(input.requestId) || !mongoose.isValidObjectId(input.adminId)) {
    return null;
  }
  await dbConnect();

  const owner = await N8nAccessRequestModel.findById(input.requestId)
    .select("studentId requestType")
    .lean();
  if (!owner || !input.expectedTypes.includes(owner.requestType)) return null;
  const student = await UserModel.findById(owner.studentId).select("email isActive").lean();
  if (!student?.email || !student.isActive) return null;
  const enrollmentAllowed = agentEnrollmentAllows(await getAgentEnrollment(student.email));
  if (!enrollmentAllowed) return null;

  const notificationType = notificationForRequest(owner.requestType);
  const jobId = new mongoose.Types.ObjectId();
  const now = new Date();
  let encryptedPayload: AccessEmailEncryptedPayload | null = null;
  let payloadExpiresAt: Date | null = null;
  if (notificationType === "N8N_ACCESS" || notificationType === "N8N_PASSWORD_RESET") {
    if (!input.link) return null;
    encryptedPayload = encryptAccessEmailPayload(input.link, {
      jobId: jobId.toString(),
      requestId: input.requestId,
      notificationType,
    });
    payloadExpiresAt = new Date(now.getTime() + PAYLOAD_TTL_MS);
  }

  try {
    return await mongoose.connection.transaction(async (session) => {
      const candidate = await N8nAccessRequestModel.findOne({
        _id: input.requestId,
        status: { $in: ["PENDING", "FAILED"] },
        requestType: { $in: input.expectedTypes },
      }).session(session).lean();
      if (!candidate) return null;

      const tool = entitlementToolForRequest(candidate.requestType);
      const entitlement = await ToolAccessEntitlementModel.findOne({
        studentId: candidate.studentId,
        tool,
      }).session(session).lean();
      if (!requestEntitlementAllowsProcessing(
        candidate.requestType,
        entitlement ? toolEntitlementState(entitlement) : null,
      )) return null;

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

      const updated = await N8nAccessRequestModel.updateOne(
        { _id: candidate._id, status: { $in: ["PENDING", "FAILED"] } },
        {
          $set: {
            status: "PROCESSING",
            processingStartedAt: now,
            handledBy: new mongoose.Types.ObjectId(input.adminId),
            failureCode: null,
          },
          $unset: { processingLeaseId: "", processingExpiresAt: "" },
        },
        { session },
      );
      if (updated.modifiedCount !== 1) return null;

      const previousJob = await AccessEmailOutboxModel.findOne({
        requestId: candidate._id,
        notificationType,
      }).sort({ generation: -1 }).session(session).lean();
      const generation = (previousJob?.generation ?? 0) + 1;

      const [job] = await AccessEmailOutboxModel.create([{
        _id: jobId,
        requestId: candidate._id,
        notificationType,
        generation,
        supersedesJobId: previousJob?._id ?? null,
        status: "QUEUED",
        nextAttemptAt: now,
        messageId: messageId(notificationType, jobId.toString()),
        encryptedPayload,
        payloadExpiresAt,
        createdBy: new mongoose.Types.ObjectId(input.adminId),
      }], { session });

      await recordAuditEvent({
        actorId: input.adminId,
        action: "ACCESS_EMAIL_QUEUED",
        resourceType: "AccessEmailOutbox",
        resourceId: job._id.toString(),
        result: "SUCCEEDED",
      }, input.context, session);
      return job;
    });
  } catch (error) {
    if (isDuplicateKey(error)) return null;
    throw error;
  }
}

export async function createRejectionEmailJob(
  input: { requestId: string; adminId: string },
  session: ClientSession,
) {
  const jobId = new mongoose.Types.ObjectId();
  const notificationType = "ACCESS_REJECTION" as const;
  const [job] = await AccessEmailOutboxModel.create([{
    _id: jobId,
    requestId: new mongoose.Types.ObjectId(input.requestId),
    notificationType,
    generation: 1,
    status: "QUEUED",
    nextAttemptAt: new Date(),
    messageId: messageId(notificationType, jobId.toString()),
    createdBy: new mongoose.Types.ObjectId(input.adminId),
  }], { session });
  return job;
}

export async function queueRejectionEmailRetry(input: {
  requestId: string;
  adminId: string;
  context?: AuditEventContext;
}) {
  if (!mongoose.isValidObjectId(input.requestId) || !mongoose.isValidObjectId(input.adminId)) {
    return null;
  }
  await dbConnect();
  try {
    return await mongoose.connection.transaction(async (session) => {
      const request = await N8nAccessRequestModel.findOne({
        _id: input.requestId,
        status: "REJECTED",
        rejectionEmailStatus: "FAILED",
      }).session(session).lean();
      if (!request) return null;
      const student = await UserModel.findById(request.studentId)
        .select("email isActive")
        .session(session)
        .lean();
      if (!student?.email || !student.isActive) return null;

      const previousJob = await AccessEmailOutboxModel.findOne({
        requestId: request._id,
        notificationType: "ACCESS_REJECTION",
      }).sort({ generation: -1 }).session(session).lean();
      if (!previousJob) return null;

      const state = await N8nAccessRequestModel.updateOne(
        {
          _id: request._id,
          status: "REJECTED",
          rejectionEmailStatus: "FAILED",
        },
        { $set: { rejectionEmailStatus: "PENDING" } },
        { session },
      );
      if (state.modifiedCount !== 1) return null;

      const jobId = new mongoose.Types.ObjectId();
      const generation = previousJob.generation + 1;
      const [job] = await AccessEmailOutboxModel.create([{
        _id: jobId,
        requestId: request._id,
        notificationType: "ACCESS_REJECTION",
        generation,
        supersedesJobId: previousJob._id,
        status: "QUEUED",
        nextAttemptAt: new Date(),
        messageId: messageId("ACCESS_REJECTION", jobId.toString()),
        createdBy: new mongoose.Types.ObjectId(input.adminId),
      }], { session });
      await recordAuditEvent({
        actorId: input.adminId,
        action: "ACCESS_REJECTION_EMAIL_RETRY",
        resourceType: "AccessEmailOutbox",
        resourceId: job._id.toString(),
        result: "SUCCEEDED",
      }, input.context, session);
      return job;
    });
  } catch (error) {
    if (isDuplicateKey(error)) return null;
    throw error;
  }
}

export async function claimDueAccessEmailJob() {
  await dbConnect();
  const now = new Date();
  const leaseId = randomUUID();
  const accepted = await AccessEmailOutboxModel.findOneAndUpdate(
    {
      status: "SMTP_ACCEPTED",
      leaseExpiresAt: { $lte: now },
    },
    {
      $set: {
        leaseId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    },
    { new: true, sort: { leaseExpiresAt: 1 }, select: "+leaseId +encryptedPayload" },
  ).lean();
  if (accepted) return accepted;

  return AccessEmailOutboxModel.findOneAndUpdate(
    {
      attempts: { $lt: MAX_ATTEMPTS },
      $or: [
        {
          status: { $in: ["QUEUED", "RETRY"] },
          $or: [
            { nextAttemptAt: { $lte: now } },
            { payloadExpiresAt: { $lte: now } },
          ],
        },
        { status: "SENDING", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "SENDING",
        leaseId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 }, select: "+leaseId +encryptedPayload" },
  ).lean();
}

/** Claims one exhausted stale job so it cannot remain SENDING forever. */
export async function reapExhaustedAccessEmailJob() {
  await dbConnect();
  const now = new Date();
  const leaseId = randomUUID();
  const job = await AccessEmailOutboxModel.findOneAndUpdate(
    {
      attempts: { $gte: MAX_ATTEMPTS },
      $or: [
        { status: { $in: ["QUEUED", "RETRY"] } },
        { status: "SENDING", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "SENDING",
        leaseId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    },
    { new: true, sort: { updatedAt: 1 }, select: "+leaseId +encryptedPayload" },
  ).lean();
  if (!job) return false;
  await markTerminalFailure(job, "MAX_ATTEMPTS_EXHAUSTED");
  return true;
}

async function markTerminalFailure(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
  errorCode: string,
  expired = false,
) {
  const now = new Date();
  await mongoose.connection.transaction(async (session) => {
    const result = await AccessEmailOutboxModel.updateOne(
      { _id: job._id, status: "SENDING", leaseId: job.leaseId },
      {
        $set: {
          status: expired ? "EXPIRED" : "FAILED",
          lastErrorCode: errorCode,
          failedAt: now,
          purgeAt: purgeAt(now),
        },
        $unset: { leaseId: "", leaseExpiresAt: "", encryptedPayload: "" },
      },
      { session },
    );
    if (result.modifiedCount !== 1) return;
    if (job.notificationType === "ACCESS_REJECTION") {
      await N8nAccessRequestModel.updateOne(
        { _id: job.requestId, status: "REJECTED" },
        { $set: { rejectionEmailStatus: "FAILED" } },
        { session },
      );
    } else {
      await N8nAccessRequestModel.updateOne(
        { _id: job.requestId, status: "PROCESSING" },
        { $set: { status: "FAILED", failureCode: errorCode } },
        { session },
      );
    }
    await recordAuditEvent({
      actorId: job.createdBy.toString(),
      action: "ACCESS_EMAIL_DELIVERY_FAILED",
      resourceType: "AccessEmailOutbox",
      resourceId: job._id.toString(),
      result: "DENIED",
    }, {}, session);
  });
}

async function scheduleRetry(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
  errorCode: string,
) {
  const delay = accessEmailRetryDelay(job.attempts);
  const jitter = Math.floor(delay * (Math.random() * 0.2 - 0.1));
  const nextAttemptAt = nextAccessEmailAttemptAt({
    now: Date.now(),
    attempts: job.attempts,
    payloadExpiresAt: job.payloadExpiresAt ?? null,
    jitter,
  });
  await AccessEmailOutboxModel.updateOne(
    { _id: job._id, status: "SENDING", leaseId: job.leaseId },
    {
      $set: {
        status: "RETRY",
        lastErrorCode: errorCode,
        nextAttemptAt,
      },
      $unset: { leaseId: "", leaseExpiresAt: "" },
    },
  );
}

export async function recoverClaimedAccessEmailJob(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
  errorCode = "WORKER_INFRASTRUCTURE_ERROR",
) {
  if (job.status === "SMTP_ACCEPTED") {
    await AccessEmailOutboxModel.updateOne(
      { _id: job._id, status: "SMTP_ACCEPTED", leaseId: job.leaseId },
      {
        $set: { leaseExpiresAt: new Date(), lastErrorCode: errorCode },
        $unset: { leaseId: "" },
      },
    );
    return "FINALIZE_RETRY" as const;
  }
  if (job.attempts >= MAX_ATTEMPTS) {
    await markTerminalFailure(job, "MAX_ATTEMPTS_EXHAUSTED");
    return "FAILED" as const;
  }
  await scheduleRetry(job, errorCode);
  return "RETRY" as const;
}

async function recordProviderAcceptance(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
  providerCode: string,
) {
  const now = new Date();
  const result = await AccessEmailOutboxModel.updateOne(
    { _id: job._id, status: "SENDING", leaseId: job.leaseId },
    {
      $set: {
        status: "SMTP_ACCEPTED",
        providerAcceptedAt: now,
        providerCode,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
      $unset: { encryptedPayload: "", lastErrorCode: "" },
    },
  );
  return result.modifiedCount === 1;
}

type FinalizeOutcome = "SENT" | "LEASE_LOST" | "CONFLICT";

async function finalizeDelivery(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
): Promise<FinalizeOutcome> {
  const now = new Date();
  return mongoose.connection.transaction(async (session) => {
    const current = await AccessEmailOutboxModel.findOne({
      _id: job._id,
      status: "SMTP_ACCEPTED",
      leaseId: job.leaseId,
    }).session(session).lean();
    // Another worker re-leased or already finalized this job. That is not a
    // terminal conflict: the new lease owner will finish the same work.
    if (!current) return "LEASE_LOST" as const;

    const request = await N8nAccessRequestModel.findById(job.requestId).session(session).lean();
    if (!request) return "CONFLICT" as const;
    if (job.notificationType === "ACCESS_REJECTION") {
      if (request.status !== "REJECTED") return "CONFLICT" as const;
      if (request.rejectionEmailStatus !== "SENT") {
        const updated = await N8nAccessRequestModel.updateOne(
          { _id: request._id, status: "REJECTED" },
          { $set: { rejectionEmailStatus: "SENT", rejectionEmailSentAt: now } },
          { session },
        );
        if (updated.modifiedCount !== 1) return "CONFLICT" as const;
      }
    } else {
      // A stale generation can leave the request FAILED while this generation's
      // email was already accepted by the provider. Delivery is the authoritative
      // fact, so finalize the request forward instead of looping on the mismatch.
      const plan = approvalFinalizePlan(request.status);
      if (plan === "CONFLICT") return "CONFLICT" as const;
      if (plan === "FINALIZE" && requestCreatesEntitlement(request.requestType)) {
        const tool = entitlementToolForRequest(request.requestType);
        const existing = await ToolAccessEntitlementModel.exists({
          studentId: request.studentId,
          tool,
        }).session(session);
        if (!existing) {
          const policy = TOOL_ACCESS_POLICY[tool];
          await ToolAccessEntitlementModel.create([{
            studentId: request.studentId,
            tool,
            policyKey: policy.key,
            policyDurationMonths: policy.durationMonths,
            courseSlug: request.courseSlug || "agent",
            enrollmentId: request.enrollmentId ?? null,
            grantedBatchNo: request.batchNo ?? null,
            sourceRequestId: request._id,
            grantedAt: now,
            expiresAt: accessExpiresAt(tool, now),
          }], { session });
        }
      }
      if (plan === "FINALIZE") {
        const updated = await N8nAccessRequestModel.updateOne(
          { _id: request._id, status: request.status },
          { $set: { status: "SENT", sentAt: now, failureCode: null } },
          { session },
        );
        if (updated.modifiedCount !== 1) return "CONFLICT" as const;
      }
    }

    const finalized = await AccessEmailOutboxModel.updateOne(
      { _id: job._id, status: "SMTP_ACCEPTED", leaseId: job.leaseId },
      {
        $set: {
          status: "SENT",
          sentAt: now,
          purgeAt: purgeAt(now),
        },
        $unset: {
          leaseId: "",
          leaseExpiresAt: "",
          encryptedPayload: "",
          lastErrorCode: "",
        },
      },
      { session },
    );
    if (finalized.modifiedCount !== 1) return "LEASE_LOST" as const;
    await recordAuditEvent({
      actorId: job.createdBy.toString(),
      action: "ACCESS_EMAIL_DELIVERED",
      resourceType: "AccessEmailOutbox",
      resourceId: job._id.toString(),
      result: "SUCCEEDED",
    }, {}, session);
    return "SENT" as const;
  });
}

/**
 * A provider-accepted job whose request can no longer be finalized must stop
 * being retried; otherwise recovery would re-lease it forever without ever
 * resending or completing.
 */
async function markFinalizeConflict(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
) {
  const now = new Date();
  await mongoose.connection.transaction(async (session) => {
    const result = await AccessEmailOutboxModel.updateOne(
      { _id: job._id, status: "SMTP_ACCEPTED", leaseId: job.leaseId },
      {
        $set: {
          status: "FAILED",
          lastErrorCode: "STATUS_FINALIZE_CONFLICT",
          failedAt: now,
          purgeAt: purgeAt(now),
        },
        $unset: { leaseId: "", leaseExpiresAt: "", encryptedPayload: "" },
      },
      { session },
    );
    if (result.modifiedCount !== 1) return;
    if (job.notificationType === "ACCESS_REJECTION") {
      await N8nAccessRequestModel.updateOne(
        { _id: job.requestId, status: "REJECTED" },
        { $set: { rejectionEmailStatus: "FAILED" } },
        { session },
      );
    } else {
      await N8nAccessRequestModel.updateOne(
        { _id: job.requestId, status: "PROCESSING" },
        { $set: { status: "FAILED", failureCode: "STATUS_FINALIZE_CONFLICT" } },
        { session },
      );
    }
    await recordAuditEvent({
      actorId: job.createdBy.toString(),
      action: "ACCESS_EMAIL_FINALIZE_CONFLICT",
      resourceType: "AccessEmailOutbox",
      resourceId: job._id.toString(),
      result: "DENIED",
    }, {}, session);
  });
}

async function finishAcceptedAccessEmailJob(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
) {
  const outcome = await finalizeDelivery(job);
  if (outcome === "SENT") return "SENT" as const;
  if (outcome === "LEASE_LOST") return "DEFERRED" as const;
  await markFinalizeConflict(job);
  return "FAILED" as const;
}

async function withSmtpDeadline<T>(operation: Promise<T>) {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      closeAccessEmailTransport();
      reject(Object.assign(new Error("SMTP attempt deadline exceeded"), { code: "SMTP_DEADLINE" }));
    }, ACCESS_EMAIL_SMTP_DEADLINE_MS);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function processAccessEmailJob(
  job: NonNullable<Awaited<ReturnType<typeof claimDueAccessEmailJob>>>,
) {
  if (job.status === "SMTP_ACCEPTED") {
    return finishAcceptedAccessEmailJob(job);
  }

  if (job.attempts > MAX_ATTEMPTS) {
    await markTerminalFailure(job, "MAX_ATTEMPTS_EXHAUSTED");
    return "FAILED" as const;
  }
  const request = await N8nAccessRequestModel.findById(job.requestId)
    .select("+rejectionNote")
    .lean();
  const student = request
    ? await UserModel.findById(request.studentId).select("name email isActive").lean()
    : null;
  if (!request || !student?.email || !student.isActive) {
    await markTerminalFailure(job, request ? "STUDENT_UNAVAILABLE" : "REQUEST_NOT_FOUND");
    return "FAILED" as const;
  }

  if (job.notificationType !== "ACCESS_REJECTION") {
    const enrollment = await getAgentEnrollment(student.email);
    const tool = entitlementToolForRequest(request.requestType);
    const entitlement = await ToolAccessEntitlementModel.findOne({
      studentId: request.studentId,
      tool,
    }).lean();
    if (
      !agentEnrollmentAllows(enrollment) ||
      !requestEntitlementAllowsProcessing(
        request.requestType,
        entitlement ? toolEntitlementState(entitlement) : null,
      )
    ) {
      await markTerminalFailure(job, "ELIGIBILITY_CHANGED");
      return "FAILED" as const;
    }
  }

  let link: string | undefined;
  if (job.notificationType === "N8N_ACCESS" || job.notificationType === "N8N_PASSWORD_RESET") {
    if (!job.payloadExpiresAt || job.payloadExpiresAt.getTime() <= Date.now()) {
      await markTerminalFailure(job, "LINK_PAYLOAD_EXPIRED", true);
      return "EXPIRED" as const;
    }
    if (!job.encryptedPayload) {
      await markTerminalFailure(job, "LINK_PAYLOAD_MISSING");
      return "FAILED" as const;
    }
    try {
      link = decryptAccessEmailPayload(job.encryptedPayload, {
        jobId: job._id.toString(),
        requestId: job.requestId.toString(),
        notificationType: job.notificationType,
      });
    } catch {
      await markTerminalFailure(job, "LINK_PAYLOAD_INVALID");
      return "FAILED" as const;
    }
  }

  try {
    const operation = job.notificationType === "OPENAI_CONFIRMATION"
      ? sendOpenAiConfirmationEmail({
          to: student.email,
          studentName: student.name,
          requestId: request._id.toString(),
          messageId: job.messageId,
        })
      : job.notificationType === "ACCESS_REJECTION"
        ? sendAccessRejectionEmail({
            to: student.email,
            studentName: student.name,
            requestType: request.requestType,
            reason: request.rejectionReasonCode as AccessRejectionReason,
            batchNo: request.batchNo ?? null,
            requestId: request._id.toString(),
            messageId: job.messageId,
          })
        : sendN8nHelpEmail({
            to: student.email,
            studentName: student.name,
            requestType: request.requestType,
            link: link!,
            requestId: request._id.toString(),
            messageId: job.messageId,
          });
    const info = await withSmtpDeadline(operation);
    if (!acceptedRecipient(info, student.email)) throw Object.assign(new Error("recipient rejected"), {
      code: "ERECIPIENT",
      responseCode: 550,
    });
    const providerCode = String(info.response ?? "ACCEPTED")
      .split(/\s+/)[0]
      .replace(/[^A-Za-z0-9_.-]/g, "")
      .slice(0, 40);
    const accepted = await recordProviderAcceptance(job, providerCode || "ACCEPTED");
    if (!accepted) throw new Error("SMTP acceptance state conflict");
  } catch (error) {
    const code = sanitizedErrorCode(error);
    closeAccessEmailTransport();
    if (transientEmailError(error) && job.attempts < MAX_ATTEMPTS) {
      await scheduleRetry(job, code);
      return "RETRY" as const;
    }
    await markTerminalFailure(job, code);
    return "FAILED" as const;
  }

  const acceptedJob = { ...job, status: "SMTP_ACCEPTED" as const };
  return finishAcceptedAccessEmailJob(acceptedJob);
}
