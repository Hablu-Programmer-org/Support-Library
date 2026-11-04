import { ISSUE_DETAILS_CREATE_MIN } from "@/lib/constants";

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
