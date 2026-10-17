# Implementation Status

## Completed

- Foundation: Next.js, TypeScript, Tailwind, HeroUI
- Auth.js Google OAuth, staff allowlist, initial admin promotion
- MongoDB/Mongoose connection and product models
- Roles and route guards
- Students: service, actions, list/new/detail UI
- Cases: service, actions, quick add, list, detail, soft delete
- Replies with external file/video links
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
- Issue-level attachment links: `SupportIssue` now carries `fileLinks`/`videoLinks`
  (the reporter's evidence), editable by staff on the create/edit form, parsed with
  the same HTTPS-only link parser as replies, rendered under the problem description
  via `LinkList`, and included in the public projection so published issues show
  them. Students may add them when submitting. The student form surfaces an explicit
  error when typed text yields no valid link (no silent drop). The publish
  confirmation now covers attached links.
- `MAX_LINKS_PER_ITEM` is enforced: `linkLimit()` (`lib/validation/common.ts`) reads
  it per call and both `lib/parse-links.ts` and the link-array Zod schemas apply it.
  Valid range 1-50, hard ceiling 50, and a missing/invalid value falls back to 10.

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
- **Direct file upload** for issue attachments is not implemented yet — students and
  staff attach external HTTPS links (images/files/videos) instead. A real upload
  needs storage, size limits, virus scanning, and access control for student PII
  screenshots. See the "Deferred" section in the README.
- `MAX_LINKS_PER_ITEM` is now read and enforced by `lib/validation/common.ts`
  (`linkLimit()`) in both the link parser and the Zod schemas — the docs match the
  code. Range 1-50; hard ceiling 50; missing/invalid falls back to 10.

### Session log — uploaded screenshots (Cloudflare R2)
- Added image-only uploads (PNG/JPEG/GIF/WebP) via Server Actions + R2 (or `memory`).
- `UPLOAD_STORAGE` unset -> disabled in production, memory otherwise; `r2` requires R2 credentials.
- New `lib/uploads/*` core, `lib/services/attachments.ts`, `/api/attachments/[id]` route, `uploads[]` on issues/replies, indexes, audit actions, proxy exemption, rate-limit scopes, `uploadEnvSchema` wired into `validateEnv`.
- Actions parse `uploads`/`solutionUploads`, ingest before the write, compensate on replay/failure.
- UI: `AttachmentField` + `AttachmentList` (plain `<img>`), rendered in student/student? form, issue form (create only), reply composer, issue detail, reply items.
- Tests: 24 new upload unit tests; env tests extended; `e2e/attachments.spec.ts` happy path + denial.
- Gates: lint (clean), typecheck, test (124 passing), build all green.