/**
 * Honest wording for access-request outcomes.
 *
 * Kept separate from the actions so every surface (admin create, student card,
 * send/confirm) says the same thing for the same reason, and so the wording can
 * be unit-tested without a database.
 */
import type { N8nRequestType } from "@/models/n8n-access-request";
import { formatSupportDateOnly } from "@/lib/format-date";
import type { CreateFailure } from "@/lib/access-request-outcome";

export type AccessMessageAudience = "ADMIN" | "STUDENT";

export type CreateAttemptSummary = {
  error?: string;
  success?: string;
  warning?: string;
};

const TYPE_LABELS: Record<N8nRequestType, string> = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "n8n password reset",
  OPENAI_ACCESS: "OpenAI API access",
};

/** The tool whose entitlement decided the outcome. */
const TOOL_LABELS: Record<N8nRequestType, string> = {
  ACCESS: "n8n",
  PASSWORD_RESET: "n8n",
  OPENAI_ACCESS: "OpenAI",
};

const UNKNOWN_DATE = "an unknown date";

function dateLabel(value?: Date | string | null): string {
  return formatSupportDateOnly(value) ?? UNKNOWN_DATE;
}

/**
 * Short clause used inside a multi-type sentence, e.g.
 * `n8n access: active until 7 Nov 2027`.
 */
export function failureDetail(failure: CreateFailure): string {
  const tool = TOOL_LABELS[failure.requestType];
  const expiresAt = dateLabel(failure.entitlement?.expiresAt);
  const revokedAt = dateLabel(failure.entitlement?.revokedAt);

  switch (failure.code) {
    case "ALREADY_HAS_ACCESS":
      return `${tool} access is active until ${expiresAt}`;
    case "ACCESS_EXPIRED":
      return `${tool} access expired on ${expiresAt}`;
    case "ACCESS_REVOKED":
      return `${tool} access was revoked on ${revokedAt}`;
    case "NO_ACTIVE_ACCESS_FOR_RESET":
      return "needs active n8n access first";
    case "RESET_ACCESS_EXPIRED":
      return `n8n access expired on ${expiresAt}, so a reset link is unavailable`;
    case "RESET_ACCESS_REVOKED":
      return `n8n access was revoked on ${revokedAt}, so a reset link is unavailable`;
    case "ACTIVE_REQUEST_EXISTS":
      return `already has an active ${TYPE_LABELS[failure.requestType]} request`;
    case "ENROLLMENT_BLOCKED":
      return "is not enrolled in the AI Agent course";
  }
}

/** Full sentence used when exactly one selected type was refused. */
export function describeCreateFailure(
  failure: CreateFailure,
  audience: AccessMessageAudience,
): string {
  const tool = TOOL_LABELS[failure.requestType];
  const expiresAt = dateLabel(failure.entitlement?.expiresAt);
  const revokedAt = dateLabel(failure.entitlement?.revokedAt);

  if (audience === "STUDENT") {
    switch (failure.code) {
      case "ALREADY_HAS_ACCESS":
        return `Your ${tool} access is active until ${expiresAt}.`;
      case "ACCESS_EXPIRED":
        return `Your ${tool} access expired on ${expiresAt}.`;
      case "ACCESS_REVOKED":
        return `Your ${tool} access was revoked on ${revokedAt}.`;
      case "NO_ACTIVE_ACCESS_FOR_RESET":
        return "A password reset needs active n8n access. Request n8n access first.";
      case "RESET_ACCESS_EXPIRED":
        return `Your n8n access expired on ${expiresAt}, so a reset link is not available.`;
      case "RESET_ACCESS_REVOKED":
        return `Your n8n access was revoked on ${revokedAt}, so a reset link is not available.`;
      case "ACTIVE_REQUEST_EXISTS":
        return `You already have an active ${TYPE_LABELS[failure.requestType]} request.`;
      case "ENROLLMENT_BLOCKED":
        return "These tools are only for students enrolled in the AI Agent course.";
    }
  }

  switch (failure.code) {
    case "ALREADY_HAS_ACCESS":
      return `This student already has ${tool} access until ${expiresAt}.`;
    case "ACCESS_EXPIRED":
      return `This student's ${tool} access expired on ${expiresAt}.`;
    case "ACCESS_REVOKED":
      return `This student's ${tool} access was revoked on ${revokedAt}.`;
    case "NO_ACTIVE_ACCESS_FOR_RESET":
      return "This student has no active n8n access yet. Send the n8n access request first, then create the password reset.";
    case "RESET_ACCESS_EXPIRED":
      return `This student's n8n access expired on ${expiresAt}; a password reset needs active access.`;
    case "RESET_ACCESS_REVOKED":
      return `This student's n8n access was revoked on ${revokedAt}; a password reset needs active access.`;
    case "ACTIVE_REQUEST_EXISTS":
      return `An active ${TYPE_LABELS[failure.requestType]} request already exists for this account.`;
    case "ENROLLMENT_BLOCKED":
      return "This student is not enrolled in the AI Agent course.";
  }
}

/**
 * One response for a whole multi-type submission.
 *
 * - nothing created + one reason → that sentence
 * - nothing created + mixed reasons → one line per type
 * - partial success → success plus a warning naming what was skipped and why
 */
export function summarizeCreateAttempt(input: {
  createdTypes: readonly N8nRequestType[];
  skipped: readonly CreateFailure[];
  audience: AccessMessageAudience;
  email?: string | null;
}): CreateAttemptSummary {
  const { createdTypes, skipped, audience } = input;

  if (createdTypes.length === 0) {
    if (skipped.length === 1) {
      return { error: describeCreateFailure(skipped[0], audience) };
    }
    if (skipped.length === 0) return { error: "Nothing was created." };
    return {
      error: `Nothing was created. ${skipped
        .map((failure) => `${TYPE_LABELS[failure.requestType]}: ${failureDetail(failure)}`)
        .join(" · ")}.`,
    };
  }

  const noun = createdTypes.length === 1 ? "request" : "requests";
  const success = audience === "ADMIN"
    ? `${createdTypes.length} ${noun} created${input.email ? ` for ${input.email}` : ""}.`
    : `${createdTypes.length} ${noun} submitted.`;

  if (skipped.length === 0) return { success };

  const skippedText = skipped
    .map((failure) => `${TYPE_LABELS[failure.requestType]} (${failureDetail(failure)})`)
    .join(", ");
  return { success, warning: `Skipped ${skippedText}.` };
}

export type QueueEmailFailureCode =
  | "INVALID_REQUEST"
  | "REQUEST_NOT_ACTIONABLE"
  | "STUDENT_UNAVAILABLE"
  | "ENROLLMENT_BLOCKED"
  | "ENTITLEMENT_MISMATCH"
  | "SUPERSEDED"
  | "DUPLICATE_JOB"
  | "LINK_REQUIRED";

/** Send/confirm wording, so a decision failure is never called "already handled". */
export function describeQueueEmailFailure(
  code: QueueEmailFailureCode,
  requestType: N8nRequestType | null,
): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "Invalid request.";
    case "REQUEST_NOT_ACTIONABLE":
      return "This request was already handled. Refresh to see its latest status.";
    case "STUDENT_UNAVAILABLE":
      return "The student account is inactive or has no deliverable email.";
    case "ENROLLMENT_BLOCKED":
      return "This student is no longer in the AI Agent course.";
    case "ENTITLEMENT_MISMATCH":
      if (requestType === "PASSWORD_RESET") {
        return "This student no longer has active n8n access, so a reset link cannot be sent.";
      }
      if (requestType === "OPENAI_ACCESS") {
        return "This student already has OpenAI access; this confirmation is no longer needed.";
      }
      return "This student already has n8n access; this invitation is no longer needed.";
    case "SUPERSEDED":
      return "A newer request replaced this one. Refresh the queue.";
    case "DUPLICATE_JOB":
      return "A send for this request is already queued.";
    case "LINK_REQUIRED":
      return "Paste the secure n8n link before sending.";
  }
}
