import { formatSupportShortDate } from "@/lib/format-date";
import type { N8nRequestType } from "@/models";

/** What the email delivered, per request type. */
const SENT_NOUN: Record<N8nRequestType, string> = {
  ACCESS: "n8n access",
  PASSWORD_RESET: "reset link",
  OPENAI_ACCESS: "OpenAI invite",
};

const FIRST_LABEL: Record<N8nRequestType, string> = {
  ACCESS: "First n8n access request",
  PASSWORD_RESET: "First password reset request",
  OPENAI_ACCESS: "First OpenAI request",
};

/**
 * One line answering "has this student been given this before, and when?".
 *
 * Only successfully delivered emails are counted (the caller passes `SENT`
 * history), so a failed send never looks like prior access.
 */
export function accessHistoryLabel(
  requestType: N8nRequestType,
  count: number,
  lastSentAt?: Date | string | null,
): string {
  if (!Number.isFinite(count) || count <= 0) return FIRST_LABEL[requestType];

  const noun = SENT_NOUN[requestType];
  const date = formatSupportShortDate(lastSentAt);
  if (!date) return `${noun} sent ${count}×`;
  return `${noun} sent ${count}× · Last ${date}`;
}