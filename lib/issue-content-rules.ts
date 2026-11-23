import { ISSUE_DETAILS_CREATE_MIN, ISSUE_DETAILS_MAX } from "@/lib/constants";
import { hasTemplateHeadings, withoutTemplateHeadings } from "@/lib/issue-template";

/**
 * Count visible issue-detail characters consistently on the client and server.
 * Collapsing whitespace means padding a two-word request with spaces/newlines
 * cannot satisfy the create-only minimum, and the "Use template" headings are
 * not the student's words, so they never count either.
 */
export function normalizedIssueDetails(value: string): string {
  return withoutTemplateHeadings(value).trim().replace(/\s+/g, " ");
}

export function issueDetailsCharacterCount(value: string): number {
  return normalizedIssueDetails(value).length;
}

export function hasEnoughIssueDetails(value: string): boolean {
  return issueDetailsCharacterCount(value) >= ISSUE_DETAILS_CREATE_MIN;
}

/** Only the template outline, nothing written under it. */
export function isTemplateOnlyIssueDetails(value: string): boolean {
  return hasTemplateHeadings(value) && issueDetailsCharacterCount(value) === 0;
}

/**
 * Why the details fail the create minimum, or null. Shared by the client
 * check and the server schema so both name the same problem.
 */
export function issueDetailsMinimumProblem(value: string): "template-only" | "too-short" | null {
  if (isTemplateOnlyIssueDetails(value)) return "template-only";
  return hasEnoughIssueDetails(value) ? null : "too-short";
}

export const TEMPLATE_ONLY_MESSAGE = "নিজের ভাষায় সমস্যাটা লিখুন — template-এর প্রতিটা heading-এর নিচে।";

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

/** The edit contract keeps the old five-character floor (`supportIssueInputSchema`). */
export const ISSUE_DETAILS_EDIT_MIN = 5;

/**
 * Client copy of the staff form's details rules: the create schema on a new
 * issue, the wider edit schema on an existing one. The editor submits through
 * a hidden input, which the browser never validates.
 */
export function staffIssueDetailsProblem(value: string, mode: "create" | "edit"): string | null {
  if (!value.trim()) return "Describe the issue.";
  if (mode === "create") {
    const minimum = issueDetailsMinimumProblem(value);
    if (minimum === "template-only") return TEMPLATE_ONLY_MESSAGE;
    if (minimum === "too-short") {
      return `Add at least ${ISSUE_DETAILS_CREATE_MIN} characters so the support team can understand the issue.`;
    }
  } else if (issueDetailsLength(value) < ISSUE_DETAILS_EDIT_MIN) {
    return `Add at least ${ISSUE_DETAILS_EDIT_MIN} characters.`;
  }
  if (isIssueDetailsTooLong(value)) {
    return `Keep the details to ${ISSUE_DETAILS_MAX.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}
