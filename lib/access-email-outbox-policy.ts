import type { AccessEmailNotificationType, N8nRequestType, N8nRequestStatus } from "@/models";

/** Short-lived ciphertext window for invitation/reset links. */
export const ACCESS_EMAIL_PAYLOAD_TTL_MS = 30 * 60_000;
/** A worker lease must exceed the hard SMTP deadline twice over. */
export const ACCESS_EMAIL_LEASE_MS = 2 * 60_000;
export const ACCESS_EMAIL_MAX_ATTEMPTS = 5;
export const ACCESS_EMAIL_SMTP_DEADLINE_MS = 45_000;
export const ACCESS_EMAIL_TERMINAL_RETENTION_MS = 90 * 24 * 60 * 60_000;
export const ACCESS_EMAIL_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNRESET",
  "EAI_AGAIN",
  "ESOCKET",
  "SMTP_DEADLINE",
]);

export function notificationForRequest(
  requestType: N8nRequestType,
): AccessEmailNotificationType {
  if (requestType === "OPENAI_ACCESS") return "OPENAI_CONFIRMATION";
  if (requestType === "PASSWORD_RESET") return "N8N_PASSWORD_RESET";
  return "N8N_ACCESS";
}

/**
 * Deterministic per-job Message-ID: a retry generation reuses its own id (so a
 * provider can de-duplicate a resend) but never collides with a fresh decision.
 */
export function accessEmailMessageId(
  type: AccessEmailNotificationType,
  jobId: string,
) {
  const prefix = type === "OPENAI_CONFIRMATION"
    ? "openai-access"
    : type === "ACCESS_REJECTION"
      ? "access-rejected"
      : "access";
  return `<${prefix}-${jobId}@hablu-programmer.com>`;
}

export function accessEmailRetryDelay(attempts: number) {
  return ACCESS_EMAIL_BACKOFF_MS[
    Math.min(Math.max(attempts - 1, 0), ACCESS_EMAIL_BACKOFF_MS.length - 1)
  ];
}

/**
 * Never schedule a retry past the ciphertext expiry: the link would already be
 * gone, so the job must fail closed at the deadline instead of silently keeping
 * stale ciphertext in the database.
 */
export function nextAccessEmailAttemptAt(input: {
  now: number;
  attempts: number;
  payloadExpiresAt: Date | null;
  jitter?: number;
}) {
  const delay = accessEmailRetryDelay(input.attempts);
  const proposed = input.now + delay + (input.jitter ?? 0);
  return new Date(
    input.payloadExpiresAt
      ? Math.min(proposed, input.payloadExpiresAt.getTime())
      : proposed,
  );
}

export function accessEmailPurgeAt(now: Date) {
  return new Date(now.getTime() + ACCESS_EMAIL_TERMINAL_RETENTION_MS);
}

export function sanitizedAccessEmailErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const candidate = error as { code?: unknown; responseCode?: unknown; command?: unknown };
  const value = candidate.responseCode ?? candidate.code ?? candidate.command ?? "UNKNOWN";
  return String(value).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60) || "UNKNOWN";
}

/**
 * SMTP 4xx replies are temporary, so they retry; 5xx replies are permanent for
 * this message. Unknown transport errors retry (bounded by max attempts).
 */
export function isTransientAccessEmailError(error: unknown) {
  if (!error || typeof error !== "object") return true;
  const candidate = error as { code?: string; responseCode?: number };
  if (candidate.responseCode) {
    return candidate.responseCode >= 400 && candidate.responseCode < 500;
  }
  if (!candidate.code) return true;
  return TRANSIENT_CODES.has(candidate.code);
}

export function recipientAccepted(
  info: { accepted?: Array<string | { address?: string }>; rejected?: unknown[] },
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const accepted = (info.accepted ?? []).some((entry) =>
    (typeof entry === "string" ? entry : entry.address ?? "").trim().toLowerCase() === normalized
  );
  return accepted && (info.rejected?.length ?? 0) === 0;
}

export type ApprovalFinalizePlan = "ALREADY_SENT" | "FINALIZE" | "CONFLICT";

/**
 * Provider acceptance is authoritative: the request is moved forward even if a
 * stale generation had already marked it FAILED. PENDING/REJECTED/SUPERSEDED
 * requests are a genuine state conflict and must stop the retry loop.
 */
export function approvalFinalizePlan(status: N8nRequestStatus): ApprovalFinalizePlan {
  if (status === "SENT") return "ALREADY_SENT";
  if (status === "PROCESSING" || status === "FAILED") return "FINALIZE";
  return "CONFLICT";
}
