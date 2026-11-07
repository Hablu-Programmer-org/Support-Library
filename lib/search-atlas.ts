import { ObjectId } from "mongodb";

import {
  SEARCH_MIN_QUERY_LENGTH,
  buildSearchTokens,
  normalizeSearchQuery,
} from "@/lib/search";

/**
 * Atlas Search index names (match `search/indexes/*.json`).
 *
 * Two indexes, not one: the public index simply has no mapping for
 * `searchText`/`studentName`/`caseRef`/attachment fields, so a bug in the query
 * builder cannot leak staff-only content to a student. Hardcoded on purpose —
 * there is no environment override, so deployed code and committed index
 * payloads can never disagree about names.
 */
export const ATLAS_PUBLIC_INDEX = "issues_public";
export const ATLAS_STAFF_INDEX = "issues_staff";

/**
 * Longest query that also runs the infix wildcard clause. A short query is the
 * common case; a very long one is served by the token/autocomplete clauses only.
 */
export const ATLAS_WILDCARD_MAX_LENGTH = 24;

export type AtlasSearchScope = "public" | "staff";

export type AtlasSearchFilters = {
  status?: string | null;
  courseSlug?: string | null;
  batchNo?: number | null;
  tag?: string | null;
  mentorId?: string | null;
  from?: Date | null;
  to?: Date | null;
};

/** Structured filter shape shared by the page and the service. */
export type AtlasSearchInput = {
  query: string;
  scope: AtlasSearchScope;
  filters?: AtlasSearchFilters;
};

/** Atlas `wildcard` treats `*` and `?` as operators. */
export const escapeWildcard = (value: string) => value.replace(/([*?\\])/g, "\\$1");

const tokenQuery = (query: string) => buildSearchTokens(query).join(" ");

export function buildAtlasSearchStage({ query, scope, filters = {} }: AtlasSearchInput) {
  const normalized = normalizeSearchQuery(query);
  const text = tokenQuery(normalized);
  const searchTextField = scope === "public" ? "publicSearchText" : "searchText";

  const should: Record<string, unknown>[] = [
    {
      text: {
        query: text,
        path: "title",
        score: { boost: { value: 4 } },
        fuzzy: { maxEdits: 1, prefixLength: 2 },
      },
    },
    {
      autocomplete: {
        query: normalized,
        path: "title.autocomplete",
        score: { boost: { value: 3 } },
      },
    },
    {
      text: {
        query: text,
        path: ["question", "tags"],
        score: { boost: { value: 2 } },
      },
    },
    { text: { query: text, path: searchTextField } },
  ];

  // Infix parity with the regex engine (`hydra` -> `hydration`). Bounded by
  // length because a wildcard on a keyword field scans the term dictionary.
  if (normalized.length >= SEARCH_MIN_QUERY_LENGTH && normalized.length <= ATLAS_WILDCARD_MAX_LENGTH) {
    should.push({
      wildcard: {
        query: `*${escapeWildcard(normalized)}*`,
        path: `${searchTextField}.raw`,
        allowAnalyzedField: false,
      },
    });
  }

  const filter: Record<string, unknown>[] = [];
  if (scope === "public") {
    filter.push({ equals: { path: "visibility", value: "PUBLISHED" } });
  }
  if (filters.status) filter.push({ equals: { path: "status", value: filters.status } });
  if (filters.courseSlug) {
    filter.push({ equals: { path: "courseSlug", value: filters.courseSlug } });
  }
  if (typeof filters.batchNo === "number") {
    filter.push({ equals: { path: "batchNo", value: filters.batchNo } });
  }
  if (filters.tag) {
    // Tags are stored lowercase (`buildIssueFilter` lowercases the Mongo filter
    // the same way); an uppercase Atlas `equals` would silently match nothing.
    filter.push({ in: { path: "tags", value: [filters.tag.toLowerCase()] } });
  }
  if (filters.mentorId && ObjectId.isValid(filters.mentorId)) {
    filter.push({ equals: { path: "mentorId", value: new ObjectId(filters.mentorId) } });
  }
  if (filters.from || filters.to) {
    filter.push({
      range: {
        path: "createdAt",
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  return {
    $search: {
      index: scope === "public" ? ATLAS_PUBLIC_INDEX : ATLAS_STAFF_INDEX,
      compound: {
        should,
        minimumShouldMatch: 1,
        ...(filter.length ? { filter } : {}),
        // `deletedAt` is a date on archived rows and null/absent otherwise, so a
        // date range excludes exactly the deleted ones. The caller still applies
        // the authoritative `$match` filter after `$search`.
        mustNot: [
          {
            range: {
              path: "deletedAt",
              gte: new Date(0),
              lte: new Date("9999-12-31T23:59:59.000Z"),
            },
          },
        ],
      },
    },
  };
}

/**
 * The engine is derived from the database URI alone — there is intentionally
 * no `SEARCH_ENGINE` override, so the deployed engine choice cannot drift from
 * the committed runbook after a stale `.env.local` edit. Local/CI databases
 * (loopback) stay on the regex engine; any remote (Atlas) database uses
 * Atlas Search, with the automatic regex fallback when Atlas errors.
 */
export function resolveSearchEngine(uri = process.env.MONGODB_URI ?? "") {
  return /(?:^|[/@])(localhost|127\.0\.0\.1|\[::1\])/i.test(uri) ? "regex" as const : "atlas" as const;
}

const EMAIL_QUERY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Atlas only indexes free text.
 *
 * An e-mail address and a staff six-digit case reference are matched by
 * dedicated fields (`studentEmailLookup`, `caseRef`), not by the search text;
 * sending them to `$search` would return nothing. They always take the Mongo
 * path.
 */
export function isAtlasEligibleQuery(query: string, publicOnly: boolean) {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) return false;
  if (EMAIL_QUERY.test(normalized)) return false;
  if (!publicOnly && /^\d{6}$/.test(normalized)) return false;
  return true;
}
