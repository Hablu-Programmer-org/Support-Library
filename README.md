# Hablu Support Library

Staff-first support library for Hablu Programmer. Mentors can record student support issues, add answers, private image attachments or external video links, and close issues when solved. Students can submit their own requests with optional attachments/video links, read published answers, follow their own request, and join the daily live support room from it.

The interface is English throughout, with Inter typography and English date formatting. Issue and reply content can still be written and searched in any language.

**Built by [Hablu Programmer](https://hablu-programmer.com)**. The MIT license does not require UI attribution; see [BRANDING.md](BRANDING.md) for separate trademark guidance.

## Architecture Overview

```
┌─────────────────────┐     Read-only      ┌──────────────────┐
│  Support Library    │ ─────────────────► │  LMS Database    │
│  (support_library)  │   MongoDB queries  │  (hp-v2 / custom)│
└─────────────────────┘                    └──────────────────┘
        │
        ▼
┌─────────────────────┐
│  Local Cache        │
│  (staff-users)      │
└─────────────────────┘
```

- **LMS Database**: Source of truth for all user accounts (staff + students)
- **Support Library**: Caches staff users locally, looks up students on-demand
- **No writes to LMS**: Support Library never modifies the LMS database

### Key Components

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| **Framework**  | Next.js 16 App Router + React 19            |
| **Language**   | TypeScript (strict)                         |
| **Auth**       | Auth.js v5 (Google OAuth only)              |
| **Database**   | MongoDB + Mongoose (replica set required)   |
| **Styling**    | Tailwind CSS 4 + CSS Variables              |
| **Testing**    | Vitest (unit) + Playwright (E2E)            |
| **Validation** | Zod schemas                                 |
| **Container**  | Docker multi-stage (non-root, read-only FS) |

### Security Features

- **CSRF protection** on all Server Actions (session-bound expiring HMAC tokens, timing-safe validation)
- **Role-based access**: ADMIN / MENTOR / STUDENT (mapped from LMS roles)
- **Student email protection**: AES-256-GCM for staff recovery plus separately keyed HMAC-SHA-256 for exact lookup; plaintext is excluded from storage and full-text search
- **Rate limiting**: Per-scope fixed-window (10-30 req/min)
- **Audit logging**: issue/reply mutations and selected denied events, with available request context
- **Security headers**: CSP, HSTS, X-Frame-Options, etc.
- **Container hardening**: Non-root, read-only FS, dropped capabilities

## Workflow

A student reaches live support **through a request**, and only through a request:
the LMS help center starts the journey, this app does the work.

Full detail — student and staff journeys, live support rules, edge cases and a
file map: **[docs/workflow.md](docs/workflow.md)**.

```text
hablu-programmer.com                        support.hablu-programmer.com
────────────────────                        ─────────────────────────────
Help Center (dashboard sidebar)
  "সাপোর্ট কীভাবে পাবেন"        ──────────►  /dashboard/issues
  [ সাপোর্ট লাইব্রেরিতে যান ]                 search published answers
                                              │  found → read the answer, done
                                              │  new   → Submit issue
                                              ▼
                                     /dashboard/issues/new
                                       title · problem · images · video links
                                              ▼  submit
                                     /dashboard/issues/{id}?created=1
                                       status · reference · own files · team replies
                                       Live support panel → [ Join Zoom Meeting ]
                                              ▼  join (server action)
                                     live-support-joins row ──► staff queue
```

### Student

1. In the LMS, open **Help Center** in the dashboard sidebar (shown to premium
   students and selected batches). The modal explains the journey in Bengali and
   states no schedule — the room's hours are only shown on the request page.
2. Press **"সাপোর্ট লাইব্রেরিতে যান"**; it opens `/dashboard/issues` in this app
   (first visit: Google sign-in).
3. **Search before asking** — the library searches published titles, problems,
   tags and course slugs. An existing answer is the fastest fix.
4. Nothing matches → **Submit an issue**. Identity comes from the session (never
   the form); optional evidence is up to 3 private images (PNG/JPEG/GIF/WebP,
   5 MB each) and external HTTPS video links.
5. Submission lands on the student's **own request page**
   (`/dashboard/issues/{id}?created=1`) with a success banner: status, the short
   reference (`000123`), everything they submitted, the team's replies
   (read-only) — and the **Live support** panel.
6. The panel offers **Join Zoom Meeting** only while the request is `OPEN`,
   `PENDING` or `FOLLOW_UP` **and** a support shift is open (08:00–12:00 or
   19:30–24:00, Asia/Dhaka, resolved on the server). Meeting ID and passcode are
   rendered only in that state.
7. Joining runs a server action that re-checks ownership, the shift and the
   per-user budget, records one join per request per shift per day, audits it,
   and only then redirects into the room.
8. **My requests** lists the student's own requests so the page is reachable
   again; `Solved`/`Archived` requests show the panel closed and offer no join.

### Staff

| Where | What |
| --- | --- |
| `/dashboard` | `Waiting Now` (today's joins), `Waiting today` (who is in the room and which request they brought), `Student requests awaiting a mentor` (student submissions with no mentor, oldest first), recent unresolved issues, popular tags |
| `/dashboard/issues` | Staff list with filters; an **unresolved** issue joined today carries a `Waiting in live support` chip |
| `/dashboard/issues/{id}` | Full case: replies, status, archive, publish/unpublish (admin only), `Reference`, and `Live support` (last join) |
| `/dashboard/support` | Staff join for the room; staff need no request and never appear in the queue |
| `/dashboard/live-support` | Today's queue, newest first, with a 30-second auto-refresh and a manual `Refresh` button |

**How staff notice a waiting student:** `Waiting Now` / `Waiting today` on the
dashboard, the `Waiting in live support` chip in the issue list, or the queue page
itself. A row is created when the student presses **Join**, not when the request
is submitted, and the chip only stays while the request is still unresolved.

### Rules and edge cases

| Situation | Result |
| --- | --- |
| Outside a support shift | Join disabled; meeting ID / passcode absent from the response |
| Request `SOLVED` / `ARCHIVED` | No join; the student is asked to submit a new request |
| Another student's unpublished request | `404` (ownership is `createdBy` from the session) |
| Another student's published issue | Read-only library view |
| Double submit within one shift | One join row (unique `{issueId, dayKey, shift}`) |
| Second visit in the other shift | A separate row with the correct shift and time |
| Duplicate issue submission | One issue (operation id + unique index) |
| Soft-deleted request | Queue row stays marked `(removed)`; gone from the student's list |
| Empty queue during a shift | Nobody has pressed Join yet |
| Legacy `/dashboard/issues/submitted` | Redirects to `My requests` |

### Cross-app notes

- Roles come from `hp-v2.User` on sign-in and on every refresh; this app signs in
  with Google only, so an LMS password account needs a Google sign-in here.
- The room credentials (join URL, meeting ID, passcode) exist **only** in this
  app, resolved server-side. The LMS bundle carries none of them.
- The shift is decided on the server in `Asia/Dhaka`; the LMS keeps the canonical
  schedule copy (`frontend/src/lib/config/support.ts`) that
  `npm run check:live-support` compares against this app.
- Joins live in `live-support-joins` with a 180-day TTL; `support-issues` keeps
  `lastLiveSupportAt`, written without touching `updatedAt` so staff revisions
  stay valid.

## Documentation

| Document                                                 | Description                                                |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [Support Workflow](docs/workflow.md)                     | End-to-end student and staff journey, live support rules    |
| [Self-Hosted Deployment](docs/self-hosted-deployment.md) | Deploy to Docker Compose, Vercel, Railway, Render, Coolify |
| [LMS Integration](docs/lms-integration.md)               | Schema requirements, role mapping, custom adapters         |
| [VPS Deployment](docs/vps-deployment.md)                 | Production runbook for VPS + Traefik                       |
| [Branding Guidelines](BRANDING.md)                       | MIT attribution and separate trademark guidance            |
| [Contributing](CONTRIBUTING.md)                          | Development setup, code standards, PR process              |
| [Security Policy](SECURITY.md)                           | Vulnerability reporting, supported versions                |
| [Code of Conduct](CODE_OF_CONDUCT.md)                    | Community standards and enforcement                        |

## Stack

- Next.js 16 App Router and React 19
- TypeScript strict
- Auth.js v5 with Google OAuth only
- MongoDB + Mongoose
- Tailwind CSS 4
- Vitest and Playwright

## Setup

```powershell
cmd /c "npm ci"
copy .env.example .env.local
```

Fill `.env.local`:

- `MONGODB_URI`
- `LMS_MONGODB_URI` (separate read-only LMS credential in production)
- `MONGODB_DB`
- `LMS_MONGODB_DB` (LMS database name; default `hp-v2`)
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL=http://localhost:12000`
- `AUTH_TRUST_HOST=true`
- `STUDENT_EMAIL_KEY_VERSION` (for example `v1`)
- `STUDENT_EMAIL_ENCRYPTION_KEYS` (`vN:<32-byte-base64>` keyring)
- `STUDENT_EMAIL_LOOKUP_KEYS` (independent `vN:<32-byte-base64>` keyring)

Run locally:

```powershell
cmd /c "npm run dev"
```

## Database Scripts

```powershell
cmd /c "npm run db:indexes"                         # dry-run index diff
cmd /c "npm run db:indexes -- --apply --create-only" # create missing indexes only
cmd /c "npm run db:indexes -- --verify"              # fail if required indexes are missing
cmd /c "npm run db:seed"
cmd /c "npm run db:seed -- --demo"
cmd /c "npm run db:hash-student-emails"              # dry-run email encryption migration
cmd /c "npm run db:hash-student-emails -- --apply --confirm=<db>" # apply after backup
```

Production roles remain authoritative in LMS; do not run demo seeds in production.
Production-like migration applies also require `--backup-acknowledged`. Roll back by
restoring the encrypted pre-migration `mongodump`; the script never exports plaintext.

Cleanup and diagnostics:

```powershell
cmd /c "npm run clean:e2e-artifacts"          # dry run: reports what E2E left behind
cmd /c "npm run clean:e2e-artifacts -- --apply"
cmd /c "npm run bench:search"                 # search strategy benchmark
cmd /c "npm run bench:search -- --docs 20000"
cmd /c "npm run check:live-support"           # live support drift guard vs the LMS frontend
```

`bench:search` seeds a throwaway collection in the test database and prints a markdown comparison of the search strategies plus a scaling curve. It refuses to run against the development database. Findings: `docs/implementation.md`.

`check:live-support` compares this app's live support schedule and its Bengali schedule wording against the LMS frontend's own copy (`frontend/src/lib/config/support.ts`), and inverts the room check: the Zoom join URL, meeting ID and passcode must exist **only** here (resolved server-side), must never reappear in the LMS `support` config, and the LMS must keep a `support.libraryUrl` pointing students at this app. The three repos are separate git repositories, so no CI can see across them — run it from a full local checkout (frontend next to `support-library`) before a release. It exits non-zero on drift *and* when it could not read both copies, so a green result can be trusted.

## Verification

```powershell
cmd /c "npm run lint"
cmd /c "npm run typecheck"
cmd /c "npm test"
cmd /c "npm run build"
```

Run all checks at once:

```powershell
cmd /c "npm run verify"
```

Optional browser smoke:

```powershell
cmd /c "npx playwright install chromium"
cmd /c "npm run test:e2e"
```

`test:e2e` requirements:

- A reachable MongoDB (it upserts test staff users).
- `.env.local` present — `AUTH_SECRET` and `MONGODB_URI` are read.
- Runs against a dedicated test database (`MONGODB_TEST_DB`) and starts its own dev server on port `12000` so it never touches the main frontend on `11000`.

## User Guides

- [Student Guide](docs/student-guide.md) — How students browse and search the Student Support Library.
- [Mentor Guide](docs/mentor-guide.md) — How mentors create and maintain support issues, write answers, and prepare content for publishing.
- [Admin Guide](docs/admin-guide.md) — How admins review, publish, unpublish, and manage reply overrides.

## Core Flows

- Google login for all Hablu Programmer LMS members (roles read from hp-v2)
- hp-v2 roles map to `ADMIN` / `MENTOR` / `STUDENT`; an unknown or inactive account is denied
- Issue forms take a student name + email, autocompleting the name from hp-v2 by email (write-only snapshot; hp-v2 is never written to)
- Issues carry optional private image attachments and issue-level video links as reporter evidence
- Mentor creates support issues with an optional first answer (text, image attachments, video links)
- If an answer is provided, it becomes the first reply and the issue can auto-close as SOLVED
- Mentor adds replies with private image attachments and external video links
- STUDENT (students) can submit a new issue with optional attachments/video links — identity comes from the session, never the form — read published issues, and read their **own** request (owner-scoped, anything its visibility), but never another student's unpublished one, and can never reply
- STUDENT submissions land as OPEN/INTERNAL with no mentor, and the student is sent to their own request page (status, team replies, live support panel) instead of the internal case view; publish requires the admin to confirm no PII in the title, description, video links, or replies
- Live support is joined from the student's own request page; the queue records who joined, for which request, per shift (`/dashboard/live-support`)
- Issues list filters by course, batch, mentor and date range (staff only)
- Dashboard shows real DB counts plus `Waiting Now`, `Waiting today` and `Student requests awaiting a mentor` (student submissions have no mentor) for staff; STUDENT/students hitting `/dashboard` are redirected to the published library
- Chrome is a single fixed topbar with inline navigation: staff see Dashboard/Issues/Live support/Support queue, students see Issues/Submit issue/My requests (Dashboard is staff-only in the nav, and only the most specific nav match is highlighted); on mobile the account menu opens a glass sheet with identity, appearance and sign out (no nav links, keeping the nav link count stable)
- Public landing `/` shows a guest navbar (theme toggle + Sign in); guests see only the sign-in path (no nav links, search, or student CTA), while signed-in users get a library search box deep-linking to `/dashboard/issues?q=…` with role-aware CTAs; staff get "Open dashboard", students get "Submit a support request", and students browse published answers directly without the staff dashboard

## Design System

Support-library chrome uses a light "glass + gradient" language on top of the shared Tailwind tokens (`app/globals.css`):

- **Brand gradient** cyan `#06b6d4` → violet `#8b5cf6` (`brand-text`, `brand-bg`).
- **Glass surfaces** (`.glass`): translucent white/slate with `backdrop-blur`, used on the topbar actions, account sheet, landing cards and the login/unauthorized cards.
- **Aurora backdrop** (`.aurora-blob`): slow drifting gradient blobs on public pages and the dashboard shell; disabled under `prefers-reduced-motion`.
- **Issue surfaces** use a flat document style: reading content (problem, replies, attachments, links) has no card or shadow, only section headings and `divide-y` rows; interactive surfaces (forms, reply composer, filter panel, aside, danger zone) use a single `Panel` (`rounded-lg border`, no shadow). Icon badge squares and the `Required` pill are removed from section headings. See `components/shared/panel.tsx`, `components/shared/section-heading.tsx`.

Theme-restricted pages keep their exact base `background-color` utilities (`header` `white/80` → `slate-950/80`, landing `main` `slate-950`, cards `slate-900`) — glass/gradient is layered via `background-image`, borders and shadows so the computed colors asserted by `e2e/shell.spec.ts` stay intact.

## Deploy Notes

Production uses standalone Next.js runtime and operations images from GHCR, both selected by immutable digest. `CI` runs indexes against an isolated database, a clean standalone build assertion, production E2E, Compose validation, and a container smoke test. `Publish GHCR image` publishes only a commit with successful CI; `Deploy production` downloads that publish run's metadata artifact and requires approval through the protected `production` environment. There is no manual CI bypass. See [VPS Deployment](docs/vps-deployment.md) for the exact release path and [Self-Hosted Deployment](docs/self-hosted-deployment.md) for generic hosting.

Dependabot opens reviewable npm, Actions, and Docker update pull requests. Updates are not auto-merged.

Auth callback URL:

```text
https://support.your-domain.com/api/auth/callback/google
```

DB-backed routes use Node.js runtime. `/api/health/live` checks the process and `/api/health/ready` verifies both support and LMS database access. Image uploads (PNG/JPEG/GIF/WebP) are implemented via Server Actions into a private store (Cloudinary authenticated assets, Cloudflare R2, or in-process memory); external links are still supported.

## Deferred

- Public knowledge base
- AI-assisted search/answers
- Service-level integration tests
- Search engine upgrade (Atlas Search / Meilisearch / Typesense)

## License

MIT License — See [LICENSE](LICENSE) for details

Copyright (c) 2026 Hablu Programmer!
