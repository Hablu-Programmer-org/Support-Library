import { normalizeEmail } from "@/lib/email";
import type { N8nRequestStatus } from "@/models/n8n-access-request";

/**
 * The staff access-request queue keeps its whole state in the URL: which tab is
 * open, the student-email search, whether already-sent requests are shown, and
 * the page. The page is `force-dynamic`, so a bookmarked or shared URL is the
 * only state that survives a refresh, a new tab or the back button.
 *
 * This module is imported by a client component (the toolbar), so it must stay
 * free of server-only imports and database types.
 */

export const ACCESS_REQUESTS_PATH = "/dashboard/access-requests";

export const ACCESS_REQUEST_TABS = ["openai", "n8n"] as const;
export type AccessRequestTab = (typeof ACCESS_REQUEST_TABS)[number];

/**
 * What the queue shows by default: work that still needs an admin. `FAILED`
 * stays visible because retrying it is an action, and `PROCESSING` because a
 * send is in flight. `SUPERSEDED` history is never part of the working queue.
 */
export const ACCESS_QUEUE_ACTIVE_STATUSES = ["PENDING", "FAILED", "PROCESSING"] as const;
export const ACCESS_QUEUE_SENT_STATUS = "SENT" as const;
export const ACCESS_QUEUE_COMPLETED_STATUSES = ["SENT", "REJECTED"] as const;

const MAX_QUERY_LENGTH = 120;
/** Same ceiling as the issue list: a pasted page number must not become a huge skip. */
const MAX_PAGE = 10_000;
const DIGITS = /^\d+$/;

export type AccessRequestListState = {
  tab: AccessRequestTab;
  q: string;
  showSent: boolean;
  page: number;
};

export const DEFAULT_ACCESS_REQUEST_STATE: AccessRequestListState = {
  tab: "openai",
  q: "",
  showSent: false,
  page: 1,
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : "";
  }
  return typeof value === "string" ? value : "";
};

const parsePage = (value: unknown): number => {
  const raw = firstValue(value).trim();
  if (!DIGITS.test(raw)) return 1;
  const page = Number.parseInt(raw.slice(0, 9), 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
};

/**
 * Turns raw `searchParams` into the one shape the page and the toolbar agree on.
 * Invalid values degrade to the default view instead of reaching the service.
 */
export function parseAccessRequestListState(
  searchParams?: RawSearchParams,
): AccessRequestListState {
  const params = searchParams ?? {};
  const tab = firstValue(params.tab).trim().toLowerCase();

  return {
    tab: (ACCESS_REQUEST_TABS as readonly string[]).includes(tab)
      ? (tab as AccessRequestTab)
      : DEFAULT_ACCESS_REQUEST_STATE.tab,
    // Emails are stored lowercase; normalizing also keeps the URL canonical.
    q: normalizeEmail(firstValue(params.q)).slice(0, MAX_QUERY_LENGTH),
    showSent: firstValue(params.sent) === "1",
    page: parsePage(params.page),
  };
}

/**
 * Canonical queue URL. Defaults are omitted so the plain page stays
 * `/dashboard/access-requests`; every non-default value is carried forward.
 */
export function buildAccessRequestHref(
  state: AccessRequestListState,
  override: Partial<AccessRequestListState> = {},
): string {
  const merged = { ...state, ...override };
  const params = new URLSearchParams();

  if (merged.tab !== DEFAULT_ACCESS_REQUEST_STATE.tab) params.set("tab", merged.tab);
  if (merged.q) params.set("q", merged.q);
  if (merged.showSent) params.set("sent", "1");
  if (merged.page > 1) params.set("page", String(merged.page));

  const query = params.toString();
  return query ? `${ACCESS_REQUESTS_PATH}?${query}` : ACCESS_REQUESTS_PATH;
}

/** Statuses a queue query may return for the current sent-toggle state. */
export function accessQueueStatuses(showSent: boolean): N8nRequestStatus[] {
  return showSent
    ? [...ACCESS_QUEUE_ACTIVE_STATUSES, ...ACCESS_QUEUE_COMPLETED_STATUSES]
    : [...ACCESS_QUEUE_ACTIVE_STATUSES];
}
