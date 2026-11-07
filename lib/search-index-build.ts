import {
  buildIssuePublicSearchText,
  buildIssueStaffSearchText,
  type IssueSearchTextSource,
  type ReplySearchTextSource,
  type SearchableAttachment,
  type SearchableVideoLink,
} from "@/lib/search";

/**
 * Pure builders for the two denormalized search fields.
 *
 * Kept free of `server-only` (and of any database import) so the backfill and
 * verification scripts can produce byte-identical text to the live write path.
 */

export type SearchFieldUpdate = {
  searchText: string;
  publicSearchText: string;
  searchUpdatedAt: Date;
};

export type SearchIndexIssueSource = {
  title?: unknown;
  question?: unknown;
  studentName?: unknown;
  batchNo?: unknown;
  courseSlug?: unknown;
  moduleSlug?: unknown;
  contentSlug?: unknown;
  tags?: unknown;
  videoLinks?: unknown;
  uploads?: unknown;
};

export type SearchIndexReplySource = {
  body?: unknown;
  isStaffReply?: unknown;
  authorId?: unknown;
  videoLinks?: unknown;
  uploads?: unknown;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toIssueSource = (issue: SearchIndexIssueSource): IssueSearchTextSource => ({
  title: String(issue.title ?? ""),
  question: String(issue.question ?? ""),
  studentName: (issue.studentName as string | null | undefined) ?? null,
  batchNo: toBatchNumber(issue.batchNo),
  courseSlug: (issue.courseSlug as string | null | undefined) ?? null,
  moduleSlug: (issue.moduleSlug as string | null | undefined) ?? null,
  contentSlug: (issue.contentSlug as string | null | undefined) ?? null,
  tags: asArray<string>(issue.tags),
  videoLinks: asArray<SearchableVideoLink>(issue.videoLinks),
  uploads: asArray<SearchableAttachment>(issue.uploads),
});

const toBatchNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

/**
 * Both scopes from one pass over the thread. Legacy replies fall back to the
 * author's role, matching `lib/reply-state.ts`.
 */
export function buildSearchFieldUpdate(
  issue: SearchIndexIssueSource,
  replies: readonly SearchIndexReplySource[],
  roleById: ReadonlyMap<string, string | null | undefined>,
  now = new Date(),
): SearchFieldUpdate {
  const replySources: ReplySearchTextSource[] = replies.map((reply) => ({
    body: String(reply.body ?? ""),
    isStaffReply: typeof reply.isStaffReply === "boolean" ? reply.isStaffReply : null,
    authorRole: roleById.get(String(reply.authorId)) ?? null,
    videoLinks: asArray<SearchableVideoLink>(reply.videoLinks),
    uploads: asArray<SearchableAttachment>(reply.uploads),
  }));
  const source = toIssueSource(issue);

  return {
    searchText: buildIssueStaffSearchText(source, replySources),
    publicSearchText: buildIssuePublicSearchText(source, replySources),
    searchUpdatedAt: now,
  };
}

/** Field lists shared with the scripts, so a change is visible in one place. */
export const SEARCH_INDEX_SOURCE_FIELDS = {
  issue:
    "title question studentName batchNo courseSlug moduleSlug contentSlug tags videoLinks uploads",
  reply: "body isStaffReply authorId videoLinks uploads",
} as const;
