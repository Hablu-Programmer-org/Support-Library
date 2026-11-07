# Issue search

How the support library turns a keyword into results, and the operational
steps that keep it fast and safe.

## What a search covers

Search is a **case-insensitive substring match** over a denormalized text field,
not a title-only filter.

| Scope | Field | Contents |
| --- | --- | --- |
| Staff (`ADMIN`/`MENTOR`) | `searchText` | title, question, course/module/content slugs, batch (`Batch 12`), tags, issue video-link titles/summaries/URLs/timestamps, issue attachment filenames, every non-deleted reply body, reply video links and reply attachment filenames, student name |
| Student (published only) | `publicSearchText` | title, question, slugs, batch (`Batch 12` — `batchNo` is already in the public projection), tags, issue video links (title/summary/URL/timestamp — URLs are in the public projection already), **staff reply bodies only**, staff reply video links |

`caseRef` and the student e-mail are **not** in either free-text field. They are
exact-match lookups (`caseRef` equality, `studentEmailLookup` HMAC), so a
six-digit query never matches unrelated reply text. `PUBLIC_ISSUE_FIELDS` is a
second line of defence: the public projection never returns identity fields.

Both fields are rebuilt from source documents on every write
(`createIssue`, `updateIssue`, every reply add/edit/delete). They are never
appended, so an edit can only produce the current text and a removed reply can
only disappear. Legacy replies without `isStaffReply` fall back to the author's
role, the same rule the reply queue uses.

Hard limits: 2 characters minimum, 200 characters maximum, 8 query tokens,
100,000 characters per denormalized field.

## Engines

`SEARCH_ENGINE` selects the engine:

| Value | Behaviour |
| --- | --- |
| `auto` (default) | regex on localhost/loopback URIs, Atlas Search everywhere else |
| `regex` | plain Mongo `$regex` substring match — CI, local, Playwright |
| `atlas` | Atlas Search (falls back to regex only when Atlas itself errors) |

When a query is present the list defaults to `sort=relevance`; an explicit sort
from the URL always wins. Without a query the staff default stays
"answer needed first" and the student default stays "newest first"
(`resolveDefaultIssueSort`). Relevance is ranked by Atlas `$searchScore` when
available and, on the regex engine, by a title/question-weighted rank
(title ×4, question ×2, indexed text ×1), so "Best match" has a meaning on
both engines.

**Known divergence (accepted):** Atlas tokenizes a multi-word query with
`minimumShouldMatch: 1`, so word order does not matter; the regex engine
matches the whole normalized phrase as a substring. The regex engine is the
local/CI/regression fallback, so the stricter phrase behaviour is what the
E2E suite pins.

### Atlas Search

Two indexes are committed under `search/indexes/`:

- `issues_public` maps `publicSearchText` and **has no mapping for**
  `searchText`, `studentName`, `caseRef`, e-mail or attachment fields. A query
  builder bug therefore cannot leak staff-only content to a student.
- `issues_staff` maps `searchText` (and the structured filters).

Both use `lucene.bengali`, `dynamic: false` and a keyword sub-field (`raw`) for
infix wildcard parity with the regex engine. The wildcard clause only runs for
queries up to `SEARCH_WILDCARD_MAX_LENGTH`.

Atlas failures disable Atlas for five minutes **per process** and fall back to
the regex engine; a Mongo max-time error (`code 50`) becomes
`SearchTimeoutError`, which the page renders as a recoverable notice with a
"Clear search" action instead of an error page.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEARCH_ENGINE` | `auto` | `auto` / `regex` / `atlas` |
| `SEARCH_INDEX_PUBLIC` | `issues_public` | public Atlas index name |
| `SEARCH_INDEX_STAFF` | `issues_staff` | staff Atlas index name |
| `SEARCH_WILDCARD_MAX_LENGTH` | `24` | longest query that also runs the infix wildcard |
| `SEARCH_MAX_TIME_MS` | `5000` | server-side budget per search query |
| `ATLAS_PUBLIC_KEY` / `ATLAS_PRIVATE_KEY` | — | Admin API only, for `search:indexes:apply` |
| `ATLAS_PROJECT_ID` / `ATLAS_CLUSTER_NAME` | — | Admin API only |

The running application's database user does **not** need Atlas admin rights;
it only reads `$listSearchIndexes`. Keep the Admin API credentials out of the
app environment.

## Runbook

### 1. Deploy the code

The regex path works before any index or backfill exists for issue-level
fields: the public filter keeps legacy per-field branches (title, question,
tags, slugs, video-link title/summary/URL/timestamp, numeric `batchNo`), so
pre-backfill documents remain searchable for those. Staff reply *bodies* (and
reply video links) only enter the public text when the backfill runs — there is
no cross-collection branch, so run step 2 in the same deploy window. The staff
filter has no legacy branches (it always matched `searchText`); pre-backfill
staff rows are searchable for whatever their old `searchText` contained, and
the newer fields (batch, video URLs, reply links) become searchable only
after the backfill rebuilds that text.

### 2. Backfill the denormalized fields

```bash
npm run search:backfill                 # dry run, reports drift
npm run search:backfill -- --apply --confirm=<MONGODB_DB>
npm run search:verify                   # independent recompute; exits 1 on drift
```

The backfill uses the same pure builder as the live write path and writes with
`timestamps: false`, so `updatedAt` (queue order, optimistic revision) does not
look like hundreds of staff edits. Re-running `search:verify` must report zero
mismatches.

### 3. Create the Atlas indexes

```bash
npm run search:indexes:print            # inspect the payloads
npm run search:indexes:apply -- --confirm=<MONGODB_DB>   # needs Admin API keys
npm run search:indexes:verify -- --wait # read-only, polls until queryable
```

`search:indexes:apply` requires `--yes` (the npm script adds it) and the target
database name, so a wrong environment is visible before anything is created.
Index creation is a control-plane action: it must be run by someone with the
Atlas keys / ops approval, never on a whim against the shared cluster.

### 4. Switch the engine (optional)

Deployments run **`SEARCH_ENGINE=regex` until the indexes are verified**. `auto`
resolves to Atlas Search on a non-local database, so leaving it on an Atlas
cluster with no indexes would fail the first search per process (Atlas then
disables itself for five minutes). Set `SEARCH_ENGINE=atlas` only after
`search:indexes:verify` reports both indexes queryable and `search:verify`
reports zero drift. `SEARCH_ENGINE=regex` is the rollback.

## UI behaviour

- Typing is debounced by 200 ms; deleting or clearing is immediate (`0 ms`).
- A server echo never overwrites the input. Every value requested from the
  router is tracked, so back/forward and Reset still replace the draft.
- Bengali/IME composition never triggers a navigation mid-word; Enter flushes
  the pending value, Escape clears it.
- One character shows a hint and keeps the current results.
- A native `type="search"` clear button is not used; an explicit accessible
  "Clear search" button owns the behaviour.
- Empty results offer "Clear search" and tag suggestions.
- The filter panel keeps its fields mounted while collapsed, so submitting the
  search never drops a hidden course/batch/mentor/date filter.

## Tests

| Layer | File | Covers |
| --- | --- | --- |
| Unit | `__tests__/search.test.ts` | normalization, query caps, public/staff text, PII exclusion, role fallback, batch |
| Unit | `__tests__/search-atlas.test.ts` | index/field isolation, wildcard escaping and bounds, engine resolution |
| Unit | `__tests__/search-index-build.test.ts` | shared builder determinism, rebuild-not-append, batch |
| Unit | `__tests__/search-relevance-sort.test.ts` | regex-engine relevance weights and scope isolation |
| Unit | `__tests__/issue-search-filter.test.ts` | scope isolation, legacy public branches, batch/video-link branches, tag lowercase, phrase pin |
| Unit | `__tests__/issue-list-params.test.ts` | relevance default, one-character query drop, explicit sort precedence, `returnTo` round-trip |
| Component | `__tests__/issue-search-field.test.tsx` | debounce vs instant delete/clear, echo safety, external adoption, IME guard, Enter flush |
| Component | `__tests__/issue-filter-panel.test.tsx` | advanced fields adopt URL on client navigation, panel auto-opens on added filter, keyword alone keeps it closed, edits survive q-only changes |
| Unit | `__tests__/search-timeout.test.ts` | only Mongo code 50 maps to `SearchTimeoutError`; real errors propagate |
| Component | `__tests__/search-timeout-notice.test.tsx` | timeout recovery notice text + clear-search action href |
| Unit | `__tests__/search-index-definitions.test.ts` | committed Atlas payloads: Bengali analysis, raw wildcard fields, no staff field in the public index |
| Integration (gated) | `__tests__/search-write-path.integration.test.ts` | live write path: reply body indexed on add, dropped on delete (`SEARCH_WRITE_PATH_TEST=1`; run against an `*_e2e` database, not production) |
| E2E | `e2e/search.spec.ts` | reply-body match, case-insensitivity, Bengali, instant clear, backspace delete, relevance default, student PII isolation (run; 11/11 passing) |

| Unit | `__tests__/search-script-flags.test.ts` | ops-script flag parsing: dry-run default, `--confirm`/`--yes` write guards, timeout |

The Atlas query builder is unit-tested; there is **no Atlas integration test**
yet — it needs the indexes and a non-local database. Until one exists,
`search:indexes:verify` is the operational check that the indexes are
queryable, and Playwright pins `SEARCH_ENGINE=regex` so the specs never
depend on a stale `.env.local`.

## Open product decisions

- Whether students should ever search their own reply text (today only staff
  replies enter `publicSearchText`).
- Whether attachment filenames belong in staff search (they are excluded from
  public search unconditionally).
- Analytics retention for search terms (no search-term logging is performed).
- Staff search scope for archived/deleted rows.
