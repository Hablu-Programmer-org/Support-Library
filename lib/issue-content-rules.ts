import { ISSUE_DETAILS_CREATE_MIN, ISSUE_DETAILS_MAX } from "@/lib/constants";

/**
 * Count visible issue-detail characters consistently on the client and server.
 * Collapsing whitespace means padding a two-word request with spaces/newlines
 * cannot satisfy the create-only minimum.
 */
export function normalizedIssueDetails(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function issueDetailsCharacterCount(value: string): number {
  return normalizedIssueDetails(value).length;
}

export function hasEnoughIssueDetails(value: string): boolean {
  return issueDetailsCharacterCount(value) >= ISSUE_DETAILS_CREATE_MIN;
}

/**
 * The server caps the trimmed raw string (`z.string().trim().max()`), not the
 * collapsed count, so indented code can hit the cap earlier than the count says.
 */
export function issueDetailsLength(value: string): number {
  return value.trim().length;
}

export function isIssueDetailsTooLong(value: string): boolean {
  return issueDetailsLength(value) > ISSUE_DETAILS_MAX;
}
