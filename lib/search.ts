export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 200;
export const SEARCH_MAX_TOKENS = 8;
/**
 * Hard ceiling for a denormalized search field.
 *
 * Every write path applies the same cap, so the regex fallback and the Atlas
 * index never disagree about how much of a thread is searchable.
 */
export const SEARCH_TEXT_MAX = 100_000;

export const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const joinSearchText = (values: Array<string | number | null | undefined>) =>
  normalizeText(values.filter((value) => value !== null && value !== undefined && value !== "").join(" "));

/**
 * The one normalization applied to a user query.
 *
 * The service normalizes independently of the URL parser: `listIssues` is also
 * called from server code (and the backfill/verification scripts), so the cap
 * must not depend on the browser.
 */
export const normalizeSearchQuery = (query?: string | null) =>
  normalizeText(query).slice(0, SEARCH_MAX_QUERY_LENGTH);

export const buildSearchTokens = (query?: string | null) =>
  normalizeSearchQuery(query).split(" ").filter(Boolean).slice(0, SEARCH_MAX_TOKENS);

export const buildSearchRegex = (query?: string | null) => {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) return null;
  return { $regex: escapeRegex(normalized), $options: "i" };
};

export type SearchableVideoLink = {
  title?: string | null;
  summary?: string | null;
  /**
   * The link itself (and its in-video timestamp) is searchable too, so a
   * YouTube ID from the URL finds the link. URLs are already in the public
   * projection (`videoLinks` is a `PUBLIC_ISSUE_FIELDS` member), so indexing
   * them in the public text exposes nothing new; only attachment *filenames*
   * stay staff-only.
   */
  url?: string | null;
  timestamp?: string | null;
};

export type SearchableAttachment = {
  originalName?: string | null;
};

/**
 * Issue fields that feed the denormalized `searchText`.
 *
 * Typed as nullable because persisted documents store null for absent slugs,
 * while validated input uses undefined. `joinSearchText` ignores both.
 *
 * NOTE: studentEmail is intentionally excluded from searchText for privacy.
 * Exact email lookup uses the separately keyed `studentEmailLookup` HMAC fields.
 */
export type IssueSearchTextSource = {
  title: string;
  question: string;
  studentName?: string | null;
  batchNo?: number | string | null;
  courseSlug?: string | null;
  moduleSlug?: string | null;
  contentSlug?: string | null;
  tags?: readonly string[] | null;
  videoLinks?: readonly SearchableVideoLink[] | null;
  uploads?: readonly SearchableAttachment[] | null;
};

export type ReplySearchTextSource = {
  body: string;
  /**
   * `undefined`/`null` on legacy rows; the author role is then the fallback,
   * exactly like `lib/reply-state.ts` does for the queue.
   */
  isStaffReply?: boolean | null;
  authorRole?: string | null;
  videoLinks?: readonly SearchableVideoLink[] | null;
  uploads?: readonly SearchableAttachment[] | null;
};

const linkText = (links?: readonly SearchableVideoLink[] | null) =>
  (links ?? []).flatMap((link) => [link.title, link.summary, link.url, link.timestamp]);

const attachmentText = (uploads?: readonly SearchableAttachment[] | null) =>
  (uploads ?? []).map((upload) => upload.originalName);

/** `Batch 12`: a labelled value so "batch 12" and bare "12" both match. */
const batchText = (batchNo?: number | string | null) => {
  if (batchNo === null || batchNo === undefined || batchNo === "") return "";
  const numeric = typeof batchNo === "number" ? batchNo : Number(batchNo);
  return Number.isFinite(numeric) ? `Batch ${numeric}` : String(batchNo);
};

/** Base searchable text for an issue, excluding reply bodies. */
export const buildIssueSearchText = (input: IssueSearchTextSource) =>
  joinSearchText([
    input.title,
    input.question,
    input.studentName,
    input.courseSlug,
    input.moduleSlug,
    input.contentSlug,
    ...(input.tags ?? []),
  ]);

/**
 * Full searchable text for an issue: its own fields plus the bodies of its
 * non-deleted replies.
 *
 * Always rebuilds from the issue's fields rather than appending to whatever is
 * stored, so course/module/content slugs can never be dropped and reply text can
 * never go stale when the last reply is removed.
 *
 * This is the legacy (staff) shape and is kept because the seed/purge scripts
 * and the existing regression tests rely on it.
 */
export const buildIssueSearchTextWithReplies = (
  input: IssueSearchTextSource,
  replyBodies: readonly string[],
) => joinSearchText([buildIssueSearchText(input), ...replyBodies]);

/**
 * Legacy staff flag fallback: an explicit boolean wins, otherwise the author's
 * role decides. Mirrors `isEffectiveStaffReply` in `lib/reply-state.ts`.
 */
export const isSearchableStaffReply = (reply: ReplySearchTextSource) => {
  if (typeof reply.isStaffReply === "boolean") return reply.isStaffReply;
  return reply.authorRole === "ADMIN" || reply.authorRole === "MENTOR";
};

/**
 * Text a student may search.
 *
 * Deliberately excludes the student's name/e-mail, the case reference and
 * attachment filenames. Staff replies are included because they are the answer
 * the student is looking for — a published thread's answer is 98% of the
 * knowledge base.
 */
export const buildIssuePublicSearchText = (
  input: IssueSearchTextSource,
  replies: readonly ReplySearchTextSource[],
) =>
  joinSearchText([
    input.title,
    input.question,
    input.courseSlug,
    input.moduleSlug,
    input.contentSlug,
    batchText(input.batchNo),
    ...(input.tags ?? []),
    ...linkText(input.videoLinks),
    ...replies
      .filter(isSearchableStaffReply)
      .flatMap((reply) => [reply.body, ...linkText(reply.videoLinks)]),
  ]).slice(0, SEARCH_TEXT_MAX);

/**
 * Staff text: the public text plus identity and attachment metadata.
 *
 * `caseRef` and e-mail stay out on purpose: they are exact-match lookups (a
 * case reference is a six-digit staff-only field), and folding them into free
 * text would make every six-digit query match unrelated replies. The batch
 * number *is* indexed (`batchText`), as a labelled value, so "batch 12" and
 * bare "12" both find the right batch.
 */
export const buildIssueStaffSearchText = (
  input: IssueSearchTextSource,
  replies: readonly ReplySearchTextSource[],
) =>
  joinSearchText([
    input.title,
    input.question,
    input.studentName,
    input.courseSlug,
    input.moduleSlug,
    input.contentSlug,
    batchText(input.batchNo),
    ...(input.tags ?? []),
    ...linkText(input.videoLinks),
    ...attachmentText(input.uploads),
    ...replies.flatMap((reply) => [
      reply.body,
      ...linkText(reply.videoLinks),
      ...attachmentText(reply.uploads),
    ]),
  ]).slice(0, SEARCH_TEXT_MAX);
