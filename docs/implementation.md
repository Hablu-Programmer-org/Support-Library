# Implementation Status

## Completed

- Foundation: Next.js, TypeScript, Tailwind, HeroUI
- Auth.js Google OAuth, staff allowlist, initial admin promotion
- MongoDB/Mongoose connection and product models
- Roles and route guards
- Students: service, actions, list/new/detail UI
- Cases: service, actions, quick add, list, detail, soft delete
- Replies with private image attachments and external video links
- Solution library with slug routes and internal/public visibility
- Case-solution linking through `case_solution_links`
- Global search for cases and solutions
- Admin staff role/active management
- Analytics dashboard and analytics page
- DB scripts: `db:indexes`, `db:seed`
- Public-output serializer guard for future public/student output
- Playwright public/unauth smoke tests
- Authenticated Playwright role matrix (ADMIN/MENTOR/STUDENT read + mutation guards)
- Authenticated Playwright CRUD flows (student -> case -> reply -> status, solution create)
- Isolated E2E database: dedicated `MONGODB_TEST_DB`, safety guard, per-collection teardown
- `clean:e2e-artifacts` script to purge E2E leftovers from the dev database
- Reply edit/delete: inline edit UI plus author-or-ADMIN guard in the service layer
- Reply-body search: `searchText` is rebuilt from case fields + every non-deleted reply (no stale/dropped slugs)
- **Scoped issue search.** Two denormalized fields, built from source on every
  write: `searchText` (staff: identity, attachment names, every reply) and
  `publicSearchText` (students: content + staff answers only, never identity,
  `caseRef` or filenames). Atlas Search with two indexes (`issues_public`,
  `issues_staff`) and a regex fallback (`SEARCH_ENGINE=auto|regex|atlas`),
  relevance as the default sort for a query, instant clear/delete in the search
  field, IME-safe typing, and `search:backfill` / `search:verify` /
  `search:indexes:*` runbooks. Details: `docs/search.md`.
- Cases list filters: course, batch, mentor, date range, preserving filters across pagination
- List context round-trip: a case opened from a filtered page carries `returnTo`
  (validated + rebuilt in `lib/issue-list-params.ts`), so `Back to results` and
  every redirecting action (reply, edit, publish, archive) return to the same
  filter and page; out-of-range/junk `page` values are normalized instead of
  failing the query
- Analytics: course and batch breakdowns, mentor activity table, weekly case count, ADMIN/MENTOR-only access
- Create-solution-from-case: prefilled draft from the case and its latest reply, INTERNAL by default
- `bench:search` benchmark script and the recorded findings below
- Student self-service issue submission: `STUDENT` can create an issue and nothing
  else (no reply/edit/status/publish). Identity is derived from the session + LMS
  lookup, cases are forced OPEN/INTERNAL with no mentor, and the submitter lands on
  `/dashboard/issues/submitted`. `canCreateIssue()` is separate from `canMutate()`
  so create rights never widen read access. STUDENT create is throttled tighter
  than staff (`issue.create.student`).
- Env fail-fast: the student-email encryption keyring is validated in every
  environment at startup (`lib/env.ts`), not just in production.
- `e2e/student-submit.spec.ts` and `e2e/student-gating.spec.ts` cover the student
  create path, staff pickup, and that students never receive staff controls.
- **Student Identity is optional for staff.** The create form is ordered
  `Issue Details → Answer (Optional) → Student Identity (optional) → Additional
  Details`, so the issue and its answer are the primary work. Staff may record a
  general issue or reusable solution without naming a learner; when identity is
  given, name and email are all-or-none. Clearing identity on edit unsets the
  encrypted email, lookup digest, LMS user id and name, and the detail page shows
  `General issue (no student)`.
- **Students get Additional Details** (course/batch/module/lesson slug, tags) and
  their identity is filled from the session + LMS in the background — the student
  form has no identity fields to fill in. Student submissions stay `OPEN` with
  `NORMAL` priority; the metadata is descriptive only and is never treated as
  enrollment or authorization truth.
- Issue-level video links: `SupportIssue` carries `videoLinks` as reporter evidence,
  editable by staff on the create/edit form, parsed with the HTTPS-only link parser,
  rendered under the problem description via `LinkList`, and included in the public
  projection. Students may add them when submitting; invalid typed values receive an
  explicit error rather than being silently dropped.
- `MAX_LINKS_PER_ITEM` is enforced: `linkLimit()` (`lib/validation/common.ts`) reads
  it per call and both `lib/parse-links.ts` and the video-link Zod schema apply it.
  Valid range 1-50, hard ceiling 50, and a missing/invalid value falls back to 10.
- **Cross-app nav.** The topbar's `My Courses` item is an external link to the LMS
  frontend (students only) and renders only when `NEXT_PUBLIC_LMS_URL` is set, so an
  unconfigured deployment never ships a link that resolves against this app and 404s.
  External items are plain `<a target="_blank" rel="noopener noreferrer">`, are
  excluded from the active-href calculation, and carry `aria-label` so their
  accessible name survives the label text being hidden below `lg` — four student
  items do not fit next to the brand and account controls with labels shown.
- **Live support lives on the request.** Students submit a request and land on
  `/dashboard/issues/[id]`, their own read-only view (status, their problem, their
  images and video links, and the team's replies). A per-request panel posts to
  `joinLiveSupportAction`, which re-checks ownership, the shift, the rate limit and
  idempotency before it redirects to the room. `/dashboard/support` is staff-only
  (students are redirected to `/dashboard/my-requests`); the mentor side is the
  queue at `/dashboard/live-support`. `/dashboard/issues/submitted` is a legacy
  redirect. `lib/live-support-policy.ts` and `lib/issue-ownership.ts` are the two
  pure filters that pin ownership; `scripts/check-live-support-sync.ts`
  (`npm run check:live-support`) guards the schedule, the Bengali schedule wording,
  the join CTA wording ("Join Live support") and asserts the room credentials
  exist **only** here.
- **Request-less quick join (owner decision, 2026-11-01).** The issues page's
  header carries a student-only **Join Live support** button beside **Submit an
  issue**, wired to `joinLiveSupportQuickAction`. It re-checks CSRF, role, the
  server-resolved shift and the shared `live-support.join` budget, writes a
  `LIVE_SUPPORT_QUICK_JOIN` audit row, and returns the room URL only then (opened
  in a new tab by `ExternalActionForm`). It records **no** queue row, so those
  students are absent from `Waiting today` and have no reference; the request
  page stays the tracked path, and a unit + e2e spec pin both behaviours.

## Search Performance Findings

Measured with `npm run bench:search` (5k docs, isolated test DB, best-of-3 explain).
`wall ms` is dominated by network round trip (87ms baseline for a single `_id`
lookup), so the server-side columns and the scaling curve are what matter.

| strategy | semantics | keys examined | server ms |
| --- | --- | --- | --- |
| substring regex (current) | infix match anywhere | 5000 | 9.3 |
| anchored prefix regex | prefix match | 5000 | 7.0 |
| token exact match | whole token | 313 | 0.3 |
| MongoDB text index | full-text, ranked | 313 | 1.0 |

Scaling of the current strategy:

| total docs | keys examined | server ms |
| --- | --- | --- |
| 10000 | 10000 | 16 |
| 25000 | 25000 | 40 |
| 55000 | 55000 | 103 |

Findings:

- The current strategy examines **every** key in the collection. It is a full
  scan, and cost grows linearly: ~103ms server time at 55k cases.
- The B-tree index on `searchText` cannot serve a case-insensitive substring
  regex, so the index currently costs write overhead without buying anything.
- Token or text-index matching examines only matching keys: ~30x less work at
  5k docs, and that advantage grows with collection size.
- Anchoring the regex does not help; it still scans every key and it narrows
  semantics for no gain.

Decision: **not changed yet, because it alters user-visible search behaviour.**
Switching to token or text-index matching means partial words stop matching
("hydra" no longer finds "hydration"). The recommended path is an indexed
`searchTokens` array on `searchText` content, keeping substring search only as a
fallback for queries shorter than a few characters. At the current data volume
(~0 cases) the scan is harmless, so this is a scaling task, not an incident.

## Verification

Use after every change:

```powershell
cmd /c "npm run lint"
cmd /c "npm run typecheck"
cmd /c "npm test"
cmd /c "npm run build"
```

Run when E2E, auth, or DB-backed flows changed. Requires a reachable MongoDB,
`.env.local`, and Playwright chromium installed:

```powershell
cmd /c "npx playwright install chromium"
cmd /c "npm run test:e2e"
```

`npm run verify` runs the first four. `npm run verify:full` adds `test:e2e`.

## Remaining

- Service-level integration tests with test DB
- Apply the search strategy change (token array or text index) — see findings above
- UI polish and mobile navigation improvements
- Production deploy smoke test (target undecided: VPS vs Vercel)

## Open Product Decisions (student issue submission)

- An unrecognised/absent LMS role maps to `STUDENT` (it can submit a self-scoped
  ticket). Confirm this is the intended fail-safe.
- ~~A student cannot see the issue they submitted (no list/detail access by design),
  only the confirmation page.~~ **Resolved 2026-10-21:** a student now reads their
  own request at `/dashboard/issues/[id]` (owner-scoped by `createdBy`) and lists
  them at `/dashboard/my-requests`. Other students' unpublished requests stay 404.
- `studentName` remains in the denormalized `searchText` after publishing, so the
  public library search can match a name to a published issue. Email is already
  excluded. Addressing this changes publish/search semantics and is deferred.
- Data migration: environments with `staff-users` rows on the old `VIEWER` value
  need `npm run db:migrate-role-viewer-to-student -- --apply --confirm=<db>`.
- **Direct image upload** is implemented for PNG/JPEG/GIF/WebP attachments, with
  private storage, size/dimension limits and authorized proxy reads. External
  HTTPS video links remain available. PDF/ZIP/Office attachments are not supported.
- `MAX_LINKS_PER_ITEM` is now read and enforced by `lib/validation/common.ts`
  (`linkLimit()`) in both the video-link parser and Zod schema — the docs match the
  code. Range 1-50; hard ceiling 50; missing/invalid falls back to 10.

### Session log — uploaded image attachments (Cloudflare R2)
- Added image-only uploads (PNG/JPEG/GIF/WebP) via Server Actions + R2 (or `memory`).
- `UPLOAD_STORAGE` unset -> disabled in production, memory otherwise; `r2` requires R2 credentials.
- New `lib/uploads/*` core, `lib/services/attachments.ts`, `/api/attachments/[id]` route, `uploads[]` on issues/replies, indexes, audit actions, proxy exemption, rate-limit scopes, `uploadEnvSchema` wired into `validateEnv`.
- Actions parse `uploads`/`solutionUploads`, ingest before the write, compensate on replay/failure.
- UI: `AttachmentField` shows removable local blob previews immediately after image selection (removal also updates the submitted `FileList`), while `AttachmentList` renders stored images through the authorized proxy (plain `<img>`); used in the student form, issue form, reply composer, issue detail and reply items.
- Tests: 24 new upload unit tests; env tests extended; `e2e/attachments.spec.ts` happy path + denial.
- Gates: lint (clean), typecheck, test (124 passing), build all green.

### Session log — P2a: edit-mode add/remove attachments
- `updateIssue` now accepts `uploads` + `removeUploadIds`: merges kept + new uploads inside the transaction, audits ATTACHMENT_UPLOAD/ATTACHMENT_DELETE, deletes removed objects after commit, compensates on stale lock/failure, and enforces the per-item cap across kept + new.
- `updateIssueAction` ingests new files, validates remove ids as ObjectIds, maps upload errors to field errors.
- `IssueForm` edit mode: shows authorized thumbnail previews for existing image attachments with an open-original link and "Remove" checkbox, plus an AttachmentField for new ones; passes `uploads` from the edit page.
- Defense-in-depth: cap bypass fixed (was: only incoming batch counted).
- Gates: lint, typecheck, test (124), build all green.

### Session log — Cloudinary Console folder `hablu/support/attachments`
- New uploads now use the key `hablu/support/attachments/<YYYY>/<MM>/<uuid>.<ext>` (was `attachments/<YYYY>/<MM>/...`), so the Console tree sits beside the web app's `hablu/courses/thumbnails` instead of a flat root.
- `upload()` now sends Cloudinary's `folder` parameter (Console folder + public-id prefix in both fixed- and dynamic-folder accounts) with the public id reduced to the final segment, plus the `support-attachment` tag. `assertUploadResult` still compares the provider-returned id to the full key, so an account that ignores `folder` fails the upload instead of silently writing a wrong key.
- Backward compatibility: `ORIGINAL_KEY` / `STORED_KEY` accept both the new and the legacy `attachments/...` root, so keys already stored in issue/reply documents stay readable and deletable. No data migration; legacy assets are deliberately not renamed (their public id is part of the persisted key).
- Docs: RUNBOOK gained a "Where support attachments live in Cloudinary" section; the self-hosted deployment notes mention the folder and the authenticated-preview caveat.
- Tests: key-shape expectations updated in `uploads.test.ts`; `cloudinary.test.ts` gained folder/public-id/tag assertions, a legacy-key acceptance case, and a mismatch case where the provider drops the folder prefix.
- Gates: see session-close report.

### Session log — Cloudinary authenticated-image backend
- Added `lib/uploads/cloudinary.ts` using the official server SDK. Uploads are `image` + `authenticated`; upload metadata is verified before persisting a versioned key, downloads use SDK-signed URLs behind the app proxy, and deletes use the exact matching tuple with invalidation requested.
- `store.ts`: `cloudinary` mode added; the previous experimental no-card backend and its setup script/tests removed. R2 and memory remain available.
- `env.ts`: requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Cloudinary Free's 10 MiB file ceiling fails fast unless a larger paid-plan limit is explicitly acknowledged.
- Image resolution cap aligned with Cloudinary Free at 25 MP. PNG/JPEG/GIF/WebP magic-byte validation, the 8000 px side cap and all existing authorization/compensation rules remain.
- `.env.example`, SECURITY.md, RUNBOOK.md, deployment docs and tests updated.
- Gates: lint clean; typecheck clean; 16 test files / 138 tests passing; production build clean; attachment Playwright slice 7/7 passing; production dependency audit 0 vulnerabilities. Live provider smoke test awaits real Cloudinary credentials.

### Session log — cross-app nav + live support join page
- Nav model (`lib/config/nav.ts`) gained `external`. New items: `My Courses` (external, students only, built by `lib/links.ts` from `NEXT_PUBLIC_LMS_URL`) and `Live support` (`/dashboard/support`). Items are `NavItem | null` filtered to `NavItem`, so "no LMS configured" removes the item rather than breaking the link.
- `lib/links.ts` normalizes the origin (trailing slash dropped, sub-path kept) and returns `null` for anything that is not http(s). `lib/env.ts` validates `NEXT_PUBLIC_LMS_URL` and the `LIVE_SUPPORT_*` values in every environment (production additionally requires HTTPS outside loopback) via a shared `configurableUrlSchema`.
- Topbar renders external items as `<a target="_blank" rel="noopener noreferrer">`, keeps them out of `activeHrefFor`, and hides labels below `lg` with `aria-label` preserving the accessible name (mobile contract: 390 px shows icons only).
- `lib/config/live-support.ts` ports `SUPPORT_SHIFTS`, `toBnDigits`, `supportScheduleBn`, `supportHoursBn` from the frontend and adds `shiftMinutes`/`currentShift` computed in `Asia/Dhaka` with an injectable `Date`. `hourCycle: "h23"` avoids the "24:00" midnight encoding. The Bengali sentence is byte-identical to the frontend's.
- `lib/live-support.ts` (server-only) resolves the room from `LIVE_SUPPORT_PLATFORM|JOIN_URL|MEETING_ID|PASSCODE`; the page passes it to the client card only after `requireSession()`. (2026-11-01: the room moved to Google Meet and the source default was removed — the join URL is a credential, so production requires it and rotation is an env change.)
- Card avoids a hydration mismatch by starting at `phase = null` and resolving after mount. The closed state drops the `href` (a `pointer-events-none` link is still activated by Enter) and keeps `role="link"`.
- New unit tests: `__tests__/live-support.test.ts` (Dhaka boundaries 08:00/11:59/12:00/19:29/19:30/23:59/00:00, midnight-as-0, Bengali copy), `__tests__/links.test.ts` (origin normalization/rejection), `__tests__/env.test.ts` extended. New E2E: `e2e/live-support.spec.ts` (guest redirect, in-slot join via `page.clock`, out-of-slot disabled, meeting details), plus a student `My Courses` case in `e2e/shell.spec.ts`; mentor nav count 2 -> 3.
- `check:live-support` compares shift numbers, the schedule sentence's literal words, the join CTA wording and the four room values against the frontend; it resolves paths with `fileURLToPath` (the `new URL(...).pathname` form breaks on Windows) and exits non-zero when a check could not run, so it never reports a false match.
- New env: `NEXT_PUBLIC_LMS_URL`, `LIVE_SUPPORT_PLATFORM`, `LIVE_SUPPORT_JOIN_URL`, `LIVE_SUPPORT_MEETING_ID`, `LIVE_SUPPORT_PASSCODE` — added to `.env.example`, `compose.example.yml`, CI (compose env + production container smoke), `release.ps1`, `playwright.config.ts` (pinned so E2E is deterministic) and the deployment docs.
- Gates: lint clean; typecheck clean; 18 test files / 159 tests passing; production build clean (`/dashboard/support` dynamic); `check:live-support` green against the frontend checkout.

### Session log — join CTA renamed to "Join Live support" (2026-11-01)
- `lib/config/live-support.ts` now exports `LIVE_SUPPORT_CTA` (`join` / `pending` / `open`) and no longer exports the platform-derived `joinLabel`/`openLabel` helpers. The platform value stays an identifier only: `LIVE_SUPPORT_PLATFORM` still drives `meetingCodeLabel` ("Meeting code" vs "Meeting ID") and the boot-time URL/host validation in `lib/env.ts`.
- `components/live-support/live-support-panel.tsx` and `live-support-card.tsx` use the shared labels, drop the `aria-label` (the visible label is now the accessible name), and replace the platform-specific sign-in hint with "You may be asked to sign in before the room lets you in." The platform name no longer appears in the rendered panel.
- `scripts/check-live-support-sync.ts` gained `compareJoinLabel()`: the LMS help-center copy must say `Join Live support` (same wording as `LIVE_SUPPORT_CTA.join`) and must not contain `Join Google Meet` / `Open Google Meet`. The platform comparison was removed with the LMS `siteConfig.support.platform` field; the room-credential and `libraryUrl` checks are unchanged and the script still exits non-zero when a check could not run.
- Tests: `__tests__/live-support-config.test.ts` pins the three labels and asserts they never name a platform; the panel/card tests assert the label, the platform-independent wording (Zoom still gets "Meeting ID"/"Passcode") and that "Google Meet" is not rendered; `external-action-form.test.tsx` fixtures use the new wording; `e2e/live-support.spec.ts` looks for `Join Live support` and asserts the student request page contains no "Google Meet".
- Docs: `README.md`, `docs/workflow.md`, `docs/student-guide.md`, `docs/mentor-guide.md`, `docs/self-hosted-deployment.md` updated; `.env.example`, compose, CI and the release script keep the `Google Meet` env value, which is the platform identifier.
- Gates: lint clean; typecheck clean; 32 test files / 247 tests passing; production build clean; `check:live-support` green against the frontend checkout. Targeted Playwright not run in this session (needs the seeded database and auth state).

### Session log — new support schedule + issue-first guidance (2026-11-01)
- **Schedule moved (owner announcement):** `SUPPORT_SHIFTS` in `lib/config/live-support.ts` is now morning `09:00–13:00` (`540–780`) and night `18:30–22:00` (`1110–1320`), from the retired `08:00–12:00` / `19:30–24:00`. The generated Bengali sentence is "সকাল ৯ টা থেকে দুপুর ১ টা এবং সন্ধ্যা ৬:৩০ থেকে রাত ১০ টা" and `supportHoursBn()` reports "৭ ঘণ্টা ৩০ মিনিট" — no hand-written copy had to change, and no migration is needed because join rows store the shift **name**, not the window.
- **LMS copy:** `frontend/src/lib/config/support.ts` (frontend `main`) carries the same numbers so `check:live-support` stays green. The LMS help-center modal was deliberately left as-is (owner decision): hours are shown only where the room is joined.
- **Guidance copy:** the announcement's rules now appear where a student acts — `app/dashboard/issues/new/page.tsx` ("Before you submit": evidence/screenshot, live support needs the request first, requests are accepted 24/7, check the request page for updates), the student description on `app/dashboard/issues/page.tsx`, and a 24/7 line in `components/live-support/live-support-panel.tsx`.
- **Request-less quick join kept** (owner decision this session) even though the announcement requires a request first. Its hint no longer claims "No request is needed" — it nudges students to submit an issue so a mentor can follow the case; the component and action doc comments record the policy tension so the gap stays visible.
- **Tests:** `__tests__/live-support.test.ts` re-pinned the Dhaka boundaries (`08:59 / 09:00 / 12:59 / 13:00 / 18:29 / 18:30 / 21:59 / 22:00`), the `SUPPORT_SHIFTS` values, the Bengali sentence and the daily total.
- **Docs:** `README.md`, `docs/workflow.md`, `docs/student-guide.md` updated.
- Gates: lint clean; typecheck clean; 35 test files / 273 tests passing; production build clean; `check:live-support` green against the frontend checkout. Targeted Playwright not run in this session (needs the seeded database and auth state).

### Session log — problem-first issue page + one-line problem titles (2026-11-02)
- **Title contract:** new issues must name the problem in one line, max 80 characters (`ISSUE_TITLE_CREATE_MAX`); a newline or 81st character is rejected server-side by `createSupportIssueInputSchema` (`safeExtend` of the shared schema). Updates keep the legacy 5–200 limit so older rows stay editable — no migration. `parseIssueForm(formData, "create" | "update")` selects the schema; student creation uses the create schema directly.
- **Hierarchy:** `The problem` and its body lead the page; the first reply is `Solution` when `status === "SOLVED"`, otherwise `Answer`. Only later replies are `Responses` (muted, `text-sm`). No `Responses` heading appears when there is exactly one reply; zero replies keep `Responses` + `No answer yet. The team replies by email too.` so the existing e2e heading assertion still passes.
- **Shared pieces:** `components/shared/section-label.tsx` (11px uppercase eyebrow that stays an `h2`), `components/shared/problem-title-hint.tsx` (hint + live counter, amber at the warn threshold, danger at the cap), and `lib/format-date.ts` (`formatSupportDate`: Dhaka `en-GB`, `2 Nov 2026, 12:41`). Reply bylines now use it instead of `toLocaleString("en-US")`, so seconds and the US format are gone.
- **Student request page:** `Problem` body raised from `text-sm` to `text-base`; first reply is `Solution`/`Answer`, later ones `Updates`; reuses `ReplyItem` with `canEdit={false}`; footer shortened to "Replies here are read-only."
- **Composer:** heading is now `text-sm` "Write a response" with the helper "The fix first, then the steps."; it stays expanded (Playwright's `formFor(page, "Add response")` depends on it). Delete control is muted until hover/focus.
- **Lists:** issue titles use `line-clamp-2 wrap-break-word`; DOM text is unchanged, so `getByRole("heading", { name: title })` still matches the full title.
- **Tests:** 2 new validation tests (80 accepted / 81 rejected / newline rejected; the edit schema still accepts 200).
- **Docs:** `docs/student-guide.md`, `docs/mentor-guide.md`, `docs/admin-guide.md` updated for the new section names and title rule.
- Gates: lint clean; typecheck clean; 35 test files / 275 tests passing; production build clean. Targeted Playwright not run in this session (needs the seeded database and auth state).

### Session log — scoped search overhaul (2026-11-07)
- **Why:** keyword search was title/question-only for staff, silently ignored reply bodies on the public list, and the input could keep an old query after the user deleted it. The earlier `bench:search` run showed the substring regex cannot use a B-tree index, so the plan was Atlas Search with a regex fallback.
- **Text model:** `lib/search.ts` now builds two fields from source. `searchText` (staff) adds student name, mentor-visible fields, attachment filenames and every reply; `publicSearchText` (student) adds **staff reply bodies only** and excludes student identity, `caseRef`, e-mail and filenames. Legacy replies without `isStaffReply` fall back to the author's role. `lib/search-index-build.ts` is the pure builder shared by the live path and scripts (no `server-only`, so scripts can import it).
- **Write paths:** `createIssue`, `updateIssue` and all four reply paths call `rebuildIssueSearchFields` after the write; it recomputes rather than appends. `updateIssue` no longer hand-builds `searchText`, and reply refresh no longer drops slugs. Backfill-like writes use `timestamps: false` so `updatedAt` stays honest.
- **Query paths:** `lib/services/issues.ts` grew `buildIssueFilter` (exported for tests), an Atlas path (`lib/search-atlas.ts`), a regex fallback, a per-process five-minute Atlas disable window, a configurable `SEARCH_MAX_TIME_MS` and `SearchTimeoutError`. Two indexes live in `search/indexes/`: `issues_public` maps no staff-only field at all.
- **UX:** `issue-search-field.tsx` is echo-safe (tracks in-flight values), clears immediately, debounces typing 200 ms, guards IME composition, shows a one-character hint and owns an explicit "Clear search" button. `issue-filter-panel.tsx` keeps fields mounted while collapsed, adds removable chips and the relevance option. The page defaults to relevance when `q` exists, survives a search timeout, and offers tag suggestions on no results.
- **Ops:** `scripts/backfill-search-text.ts` (dry-run/apply/verify, `--confirm`), `scripts/search-indexes.ts` (print/verify/apply via the Atlas Admin API, `--wait`), npm scripts `search:backfill`, `search:verify`, `search:indexes:{print,verify,apply}`, and new `.env.example` keys (`SEARCH_ENGINE`, index names, wildcard/limit, Admin API). `issues.search` is an optional rate-limit scope that the default page does not consume.
- **Tests:** new `__tests__/search-atlas.test.ts` and `__tests__/search-index-build.test.ts`; `search.test.ts` covers public/staff text, PII exclusion and role fallback; `issue-list-params.test.ts` covers the relevance default and `returnTo` round-trip. New gated `e2e/search.spec.ts` covers reply-body matching, case-insensitivity, Bengali, instant clear, relevance default and student PII isolation.
- **Not run (needs approval / credentials):** Atlas index creation and the live backfill. The app user has `readWriteAnyDatabase` only (`$listSearchIndexes` returns `[]`). Run `search:backfill`, `search:indexes:apply` and `search:indexes:verify` against production only after ops approval; roll back with `SEARCH_ENGINE=regex`.
- Gates: typecheck clean; lint clean; 67 test files / 510 tests passing; production build clean. Playwright not run in this session (no app on port 12000). Repo revision: `support-library@2d2c203` (implementation uncommitted).

### Session log — search gap remediation (2026-11-07)
- **Batch searchable:** `batchText()` (`Batch 12`) now feeds both scopes in `lib/search.ts`; `search-index-build.ts`, the service select, the backfill selects and `seed.ts` (now via shared `buildSearchFieldUpdate`) all carry `batchNo`. The dead `mentorName` field (never on `SupportIssue`) was removed from the search source type; mentor stays a dedicated filter.
- **Relevance on the regex engine:** `relevanceRankStage` (title×4, question×2, indexed text×1) ranks `sort=relevance` before pagination on the Mongo path, so "Best match" is meaningful without Atlas. `parseIssueListFilters` drops one-character queries, so `?q=a` no longer lists everything under a "results for a" label. `IssueSearchField` echo tracking prunes by age (10 s) instead of FIFO; the filter panel no longer auto-expands on a keyword alone.
- **Second pass (investigation follow-up):** Atlas tag filter now lowercases (`search-atlas.ts`), matching stored tags and the Mongo filter; public legacy branches also match numeric `batchNo` (`12` / `batch 12`) and `videoLinks.title/summary` for pre-backfill rows; runbook now says deployments run `SEARCH_ENGINE=regex` until `search:indexes:verify` passes (`.env.example` warns the same); multi-word phrase-vs-token divergence is documented as an accepted regex/Atlas difference; `bench:search` documents why Atlas `$search` is not a benchmark strategy. MIN-query length now comes from the single `SEARCH_MIN_QUERY_LENGTH`.
- **Tests:** new `__tests__/issue-search-filter.test.ts` (scope isolation, legacy branches, batch/video branches, phrase pin); gated `__tests__/search-write-path.integration.test.ts` (`SEARCH_WRITE_PATH_TEST=1`) proves the live write path indexes a staff reply body and drops it on delete. No Atlas integration test yet (needs indexes + non-local DB); Playwright and the live backfill/index apply remain approval-pending.
- Gates: typecheck clean; lint clean; 70 test files / 536 tests passing (1 skipped, gated); production build clean.

### Session log — filter panel resync (2026-11-07)
- **Bug:** advanced filter fields were uncontrolled (`defaultValue`), so client-side navigations (chip removal, tag suggestion, Reset, back/forward) left selects/inputs showing mount-time values while chips (from props) were correct; and the chips lived inside the collapsed panel, so a client-added advanced filter's chips were invisible until the user opened it.
- **Fix:** advanced fields + sort are now controlled drafts that adopt the URL's advanced defaults on navigation. `q` is excluded from the draft sync, so typing a search (which navigates on `q` and flips the sort default) keeps unsubmitted field edits; the sort adopts the URL separately. The panel auto-opens when a navigation adds the first advanced filter, and never force-closes a user-opened panel.
- **Tests:** new `__tests__/issue-filter-panel.test.tsx` (5 tests: external removal adopted, auto-open + chip visible, keyword alone stays closed, edits survive q-only navigation, sort adopted).
- Gates: typecheck clean; lint clean; 71 test files / 541 tests passing (1 skipped, gated); production build clean. Still pending: Atlas integration test, Playwright run, live backfill/index apply (approval).

### Session log — search coverage & test gaps (2026-11-07)
- **Video URL/timestamp now searchable:** `SearchableVideoLink` gained `url`/`timestamp` and `linkText` folds them into both scopes, so a YouTube ID in the URL finds the link. Safe for the public scope because `videoLinks` (with URLs) is already in `PUBLIC_ISSUE_FIELDS`; only attachment filenames stay staff-only. Existing rows pick this up on the next rebuild/backfill.
- **Timeout contract tested:** `isSearchTimeoutError` exported; `__tests__/search-timeout.test.ts` pins that only Mongo code 50 becomes the recoverable `SearchTimeoutError` and real errors propagate.
- **Index payloads pinned:** `__tests__/search-index-definitions.test.ts` reads the committed Atlas JSONs and fails if the public index ever maps a staff-only field, if Bengali analysis drops, or if the keyword `raw` sub-field disappears.
- Gates: typecheck clean; lint clean; 73 test files / 548 tests passing (1 skipped, gated); production build clean.

### Session log — timeout notice component (2026-11-07)
- The search-timeout recovery notice was inline JSX in the list page (untestable without booting the whole page). Extracted to `components/issues/search-timeout-notice.tsx` with an `href` prop; the page passes the clear-search URL as before. `__tests__/search-timeout-notice.test.tsx` pins the copy and the action href, alongside the existing `isSearchTimeoutError` mapping test.
- Gates: typecheck clean; lint clean; 74 test files / 549 tests passing (1 skipped, gated); production build clean. Script flag handling stays manual (entrypoints execute `main()` on import, so they are not unit-testable); Playwright, Atlas integration test and the live backfill/index apply remain approval-pending.

### Session log — DB-backed verification run (2026-11-07)
- **Read-only ops against production (`support_library`, no writes):** `search:backfill` dry-run scanned 263 issues — 257 staff texts and all 263 public texts would change, 263 public texts currently missing; `search:verify` reports 520 mismatches as expected pre-backfill; `search:indexes:verify` confirms both Atlas indexes are absent. Live drift numbers confirm the deploy window is real.
- **Gated integration executed** against the `support_library_e2e` Atlas database (never production; `MONGODB_DB` overridden): create → staff reply → `listIssues` finds the token → reply delete removes it. The test needed a `@/lib/request-context` mock (services read `next/headers`, which only exists in a request scope) — now included in the test file.
- **Playwright `e2e/search.spec.ts` executed:** 11/11 passing (plus 4 auth/lms setup), against the pinned `SEARCH_ENGINE=regex` webServer.
- Gates: typecheck clean; lint clean; 74 test files / 549 tests passing (+1 integration passing when gated on); production build clean. **Not run:** Atlas integration test (needs indexes), the live backfill `--apply`, `search:indexes:apply` (Admin API + approval).

### Session log — script flags + final test gaps (2026-11-07)
- `parseBackfillFlags` / `parseSearchIndexFlags` exported from the two new ops scripts; both scripts now run `main()` only when executed directly (`process.argv[1]` guard), so flag parsing is unit-testable without side effects. `__tests__/search-script-flags.test.ts` (6 tests) pins dry-run default, `--apply`+`--confirm`, `--verify` separation, `--wait`/`--timeout`, and `--yes` write confirmation. Both entrypoints re-verified (`search:backfill` dry-run + `search:indexes:print` identical to before).
- `searchUpdatedAt` model comment corrected: write bookkeeping only; verification recomputes and compares text, it never reads the timestamp.
- Gates: typecheck clean; lint clean; 75 test files / 555 tests passing (1 skipped, gated); production build clean. Remaining: Atlas integration test (needs indexes), live backfill `--apply`, `search:indexes:apply` (Admin API + approval).

### Session log — legacy URL branch + staff window note (2026-11-07)
- **Public legacy $or** now also matches `videoLinks.url` and `videoLinks.timestamp`, so a pre-backfill public row is findable by YouTube ID / in-video time before the backfill runs — matching the indexed-text coverage from the previous session. `__tests__/issue-search-filter.test.ts` pins the new branches.
- **Runbook step 1** now states the staff window explicitly: staff has no legacy branches, so pre-backfill staff rows only match whatever their old `searchText` held; batch / video URLs / reply links become searchable after the backfill.
- Gates: typecheck clean; lint clean; 73 test files / 548 tests passing (1 skipped, gated); production build clean.
