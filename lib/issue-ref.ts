/**
 * Issue URL keys.
 *
 * An issue page lives at `/dashboard/issues/<key>`. The key is the six-digit
 * request reference (`000123`) — short, speakable, and the same number the
 * student reads out in the live room — instead of the Mongo `_id`.
 *
 * Inside the app (actions, forms, services) the `_id` stays the identifier; only
 * the URL uses the reference. An issue without a reference (rows inserted
 * directly by tests or scripts) falls back to its `_id`, and an old `_id` URL is
 * redirected to the reference by the page itself, after the access check.
 *
 * The reference is sequential and therefore guessable. That is fine because
 * every page still checks staff / owner / published access and answers "no
 * such issue" and "not yours" with the same 404.
 */

const CASE_REF = /^\d{6}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isCaseRef(value: string): boolean {
  return CASE_REF.test(value);
}

export function isObjectIdKey(value: string): boolean {
  return OBJECT_ID.test(value);
}

export type IssueUrlRef = { id: string; caseRef?: string | null };

/** The URL segment for an issue: its reference when it has one, else its `_id`. */
export function issueUrlKey(issue: IssueUrlRef | string): string {
  if (typeof issue === "string") return issue;
  return issue.caseRef && isCaseRef(issue.caseRef) ? issue.caseRef : issue.id;
}
