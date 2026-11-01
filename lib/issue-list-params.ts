import { CASE_STATUSES } from "@/lib/constants";

/**
 * The issue list keeps its whole state in the URL (filters + page), because the
 * page is `force-dynamic` and a bookmarked/shareable URL is the only thing that
 * survives a refresh, a new tab or the back button.
 *
 * That state has to survive the trip through an issue detail page too: a mentor
 * who filters, walks to page 3 and opens a case must come back to page 3 with the
 * same filters, not to page 1. The detail page therefore receives the list URL as
 * a `returnTo` param and rebuilds it here.
 *
 * `returnTo` is user-editable input that ends up in a redirect, so it is never
 * passed through: `parseIssueListReturnTo` rejects everything that is not one of
 * the known dashboard list pages and then *rebuilds* the href from allowlisted
 * filter values only. That keeps open-redirect and header-injection attempts
 * impossible by construction.
 */

export const ISSUES_PATH = "/dashboard/issues";

export const ISSUE_SORTS = ["newest", "oldest", "priority"] as const;
export type IssueSort = (typeof ISSUE_SORTS)[number];

export type IssueListFilters = {
  q: string;
  status: string;
  tag: string;
  courseSlug: string;
  batchNo: string;
  mentorId: string;
  /** Calendar date (`YYYY-MM-DD`) as typed into the filter panel. */
  from: string;
  /** Calendar date (`YYYY-MM-DD`) as typed into the filter panel. */
  to: string;
  sort: IssueSort;
  /** 1-based, always normalized so the service never sees NaN or an absurd skip. */
  page: number;
};

/** The filter panel's props: everything except pagination. */
export type IssueFilterDefaults = Omit<IssueListFilters, "page">;

export const DEFAULT_ISSUE_FILTERS: IssueFilterDefaults = {
  q: "",
  status: "",
  tag: "",
  courseSlug: "",
  batchNo: "",
  mentorId: "",
  from: "",
  to: "",
  sort: "newest",
};

/** Guardrail for a pasted search string; the service caps the query itself too. */
const MAX_QUERY_LENGTH = 200;
const MAX_TAG_LENGTH = 32;
const MAX_SLUG_LENGTH = 120;
const MAX_ID_LENGTH = 64;
/**
 * Upper bound on the page number. Anything larger is a typo or an attempt to make
 * the server scan a huge `skip`; the list redirects back into range anyway.
 */
const MAX_PAGE = 10_000;
/** `returnTo` is a short internal path, never a document. */
const MAX_RETURN_TO_LENGTH = 512;

/** Pages whose list context may be restored. Everything else is rejected. */
const RETURNABLE_PATHS = new Set<string>([
  ISSUES_PATH,
  "/dashboard",
  "/dashboard/my-requests",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIGITS = /^\d+$/;
/** Matches the service schema: batch 1–9999. */
const BATCH_NUMBER = /^\d{1,4}$/;
/** Matches the service schema: a 24-char ObjectId hex string. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * A real calendar day, not just the right shape.
 *
 * `2026-02-30` or `2026-13-01` passes a regex but becomes an Invalid Date in the
 * Mongo filter, which fails the query — the same failure mode as `?page=abc`.
 */
const isCalendarDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return false;
  return new Date(timestamp).toISOString().slice(0, 10) === value;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : "";
  }
  return typeof value === "string" ? value : "";
};

const text = (value: unknown, maxLength = MAX_QUERY_LENGTH): string =>
  firstValue(value).trim().slice(0, maxLength);

const parsePage = (value: unknown): number => {
  const raw = firstValue(value).trim();
  if (!DIGITS.test(raw)) return 1;
  // `Math.min` after the parse: a very long digit string must clamp, and the
  // slice keeps `Number.parseInt` away from precision loss on absurd input.
  const page = Number.parseInt(raw.slice(0, 9), 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
};

/**
 * Turns raw `searchParams` into the one shape the list page, the filter panel and
 * the detail page's `returnTo` all agree on. Invalid values are dropped instead of
 * forwarded to the service, so `?page=abc` or `?status=NOPE` degrade to the
 * default view rather than throwing.
 */
export function parseIssueListFilters(
  searchParams: RawSearchParams | undefined,
  options: { canManage: boolean },
): IssueListFilters {
  const params = searchParams ?? {};
  const status = text(params.status, 32);
  const batchNo = text(params.batchNo, 16);
  const from = text(params.from, 10);
  const to = text(params.to, 10);
  const sort = text(params.sort, 16);
  const mentorId = text(params.mentorId, MAX_ID_LENGTH);

  return {
    q: text(params.q),
    status: (CASE_STATUSES as readonly string[]).includes(status) ? status : "",
    tag: text(params.tag, MAX_TAG_LENGTH),
    courseSlug: text(params.courseSlug, MAX_SLUG_LENGTH),
    batchNo: BATCH_NUMBER.test(batchNo) && Number(batchNo) >= 1 ? batchNo : "",
    // Mentors are the only viewers who may filter by mentor; a student must not
    // be handed a link that even carries a staff id.
    mentorId: options.canManage && OBJECT_ID.test(mentorId) ? mentorId : "",
    from: isCalendarDate(from) ? from : "",
    to: isCalendarDate(to) ? to : "",
    sort: (ISSUE_SORTS as readonly string[]).includes(sort) ? (sort as IssueSort) : "newest",
    page: parsePage(params.page),
  };
}

/**
 * Canonical list URL — the single place that knows which query keys exist.
 *
 * Defaults are omitted (`page=1`, `sort=newest`) so the plain list stays a clean
 * `/dashboard/issues`, which is what the reset button and the e2e suite expect.
 */
export function buildIssueListHref(
  filters: IssueListFilters,
  override?: { page?: number },
): string {
  const page = override?.page ?? filters.page;
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.courseSlug) params.set("courseSlug", filters.courseSlug);
  if (filters.batchNo) params.set("batchNo", filters.batchNo);
  if (filters.mentorId) params.set("mentorId", filters.mentorId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `${ISSUES_PATH}?${query}` : ISSUES_PATH;
}

/** `/dashboard/issues/<id>` plus the list context it was opened from, if any. */
export function buildIssueDetailHref(issueId: string, returnTo?: string | null): string {
  return withReturnToHref(`${ISSUES_PATH}/${encodeURIComponent(issueId)}`, returnTo);
}

export function buildIssueEditHref(issueId: string, returnTo?: string | null): string {
  return withReturnToHref(
    `${ISSUES_PATH}/${encodeURIComponent(issueId)}/edit`,
    returnTo,
  );
}

/** Appends `?returnTo=` to an internal detail/edit path. */
export function withReturnToHref(path: string, returnTo?: string | null): string {
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

/**
 * Validates a `returnTo` value and returns the canonical href it stands for.
 *
 * Returns `null` for anything that is not a known internal list page, so callers
 * can decide whether to fall back to a plain path or to omit the param entirely.
 * The returned string is always built by `buildIssueListHref`, never echoed back.
 */
export function parseIssueListReturnTo(
  value: unknown,
  options: { canManage: boolean },
): string | null {
  const raw = firstValue(value);
  if (!raw || raw.length > MAX_RETURN_TO_LENGTH) return null;
  // Only an internal absolute path can be a dashboard list; protocol-relative and
  // backslash variants (`//evil.test`, `/\evil.test`) are refused before parsing.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }

  const base = "http://internal.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  if (url.username || url.password) return null;
  if (!RETURNABLE_PATHS.has(url.pathname)) return null;

  if (url.pathname !== ISSUES_PATH) {
    // Dashboard-home and my-requests lists carry no filters worth preserving.
    return url.pathname;
  }

  const filters: RawSearchParams = {};
  url.searchParams.forEach((paramValue, paramName) => {
    // Repeated keys keep the first value; the list parser reads a single string.
    if (!(paramName in filters)) filters[paramName] = paramValue;
  });

  return buildIssueListHref(parseIssueListFilters(filters, options));
}

/** Same as above, but always yields a usable internal path. */
export function sanitizeIssueListReturnTo(
  value: unknown,
  options: { canManage: boolean },
): string {
  return parseIssueListReturnTo(value, options) ?? ISSUES_PATH;
}

/**
 * The filter panel and the service disagree about dates on purpose: the panel
 * speaks calendar days, the Mongo filter wants ISO datetimes. `from` covers the
 * whole start day, `to` the whole end day.
 */
export function toIssueDateRange(filters: Pick<IssueListFilters, "from" | "to">): {
  from?: string;
  to?: string;
} {
  return {
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
  };
}

/** True when anything other than the default view is active. */
export function hasActiveIssueFilters(filters: IssueFilterDefaults): boolean {
  return Boolean(
    filters.q ||
      filters.status ||
      filters.tag ||
      filters.courseSlug ||
      filters.batchNo ||
      filters.mentorId ||
      filters.from ||
      filters.to ||
      filters.sort !== "newest",
  );
}
