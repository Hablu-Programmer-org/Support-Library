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
- Cases list filters: course, batch, mentor, date range, preserving filters across pagination
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
- **Live support in this app.** `/dashboard/support` is a session-gated page that
  renders the daily Zoom room (`lib/live-support.ts`, read from the environment on
  the server) and a client card (`components/live-support/live-support-card.tsx`)
  which enables Join only inside a support shift. The shift is resolved in
  `Asia/Dhaka` via `Intl.DateTimeFormat`; the LMS frontend used the device clock,
  which put a traveller in the wrong window. The join URL, meeting ID and passcode
  never reach an unsigned browser — the frontend ships the same values in its public
  bundle. `scripts/check-live-support-sync.ts` (`npm run check:live-support`) guards
  the schedule, the Bengali schedule wording and the room against the frontend copy.

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
- A student cannot see the issue they submitted (no list/detail access by design),
  only the confirmation page. Confirm this product behaviour.
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
- `lib/live-support.ts` (server-only) resolves the Zoom room from `LIVE_SUPPORT_PLATFORM|JOIN_URL|MEETING_ID|PASSCODE`, defaulting to the standing room; the page passes it to the client card only after `requireSession()`.
- Card avoids a hydration mismatch by starting at `phase = null` and resolving after mount. The closed state drops the `href` (a `pointer-events-none` link is still activated by Enter) and keeps `role="link"`.
- New unit tests: `__tests__/live-support.test.ts` (Dhaka boundaries 08:00/11:59/12:00/19:29/19:30/23:59/00:00, midnight-as-0, Bengali copy), `__tests__/links.test.ts` (origin normalization/rejection), `__tests__/env.test.ts` extended. New E2E: `e2e/live-support.spec.ts` (guest redirect, in-slot join via `page.clock`, out-of-slot disabled, meeting details), plus a student `My Courses` case in `e2e/shell.spec.ts`; mentor nav count 2 -> 3.
- `check:live-support` compares shift numbers, the schedule sentence's literal words and the four room values against the frontend; it resolves paths with `fileURLToPath` (the `new URL(...).pathname` form breaks on Windows) and exits non-zero when a check could not run, so it never reports a false match.
- New env: `NEXT_PUBLIC_LMS_URL`, `LIVE_SUPPORT_PLATFORM`, `LIVE_SUPPORT_JOIN_URL`, `LIVE_SUPPORT_MEETING_ID`, `LIVE_SUPPORT_PASSCODE` — added to `.env.example`, `compose.example.yml`, CI (compose env + production container smoke), `release.ps1`, `playwright.config.ts` (pinned so E2E is deterministic) and the deployment docs.
- Gates: lint clean; typecheck clean; 18 test files / 159 tests passing; production build clean (`/dashboard/support` dynamic); `check:live-support` green against the frontend checkout.
