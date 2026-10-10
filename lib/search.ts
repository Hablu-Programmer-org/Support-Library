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

export const buildSearchRegex = (query?: string | null) => {
  const normalized = normalizeText(query);
  if (normalized.length < 2) return null;
  return { $regex: escapeRegex(normalized), $options: "i" };
};

/**
 * Issue fields that feed the denormalized `searchText`.
 *
 * Typed as nullable because persisted documents store null for absent slugs,
 * while validated input uses undefined. `joinSearchText` ignores both.
 */
export type IssueSearchTextSource = {
  title: string;
  question: string;
  studentName?: string | null;
  studentEmail?: string | null;
  courseSlug?: string | null;
  moduleSlug?: string | null;
  contentSlug?: string | null;
  tags?: readonly string[] | null;
};

/** Base searchable text for an issue, excluding reply bodies. */
export const buildIssueSearchText = (input: IssueSearchTextSource) =>
  joinSearchText([
    input.title,
    input.question,
    input.studentName,
    input.studentEmail,
    input.courseSlug,
    input.moduleSlug,
    input.contentSlug,
    ...(input.tags ?? []),
  ]);

/**
 * Full searchable text for an issue: its own fields plus the bodies of its public
 * replies.
 *
 * Always rebuilds from the issue's fields rather than appending to whatever is
 * stored, so course/module/content slugs can never be dropped and reply text can
 * never go stale when the last public reply is removed.
 */
export const buildIssueSearchTextWithReplies = (
  input: IssueSearchTextSource,
  replyBodies: readonly string[],
) => joinSearchText([buildIssueSearchText(input), ...replyBodies]);
