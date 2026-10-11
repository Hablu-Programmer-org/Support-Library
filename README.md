# Hablu Support Library

Staff-first support library for Hablu Programmer. Mentors can record student support issues, add answers, external file/video links, and close issues when solved.

The interface is English throughout, with Inter typography and English date formatting. Issue and reply content can still be written and searched in any language.

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
- `LMS_MONGODB_URI` (separate read-only hp-v2 credential in production)
- `MONGODB_DB`
- `LMS_MONGODB_DB` (hp-v2 database name; default `hp-v2`)
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL=http://localhost:12000`
- `AUTH_TRUST_HOST=true`

Run locally:

```powershell
cmd /c "npm run dev"
```

## Database Scripts

```powershell
cmd /c "npm run db:indexes"                         # dry-run index diff
cmd /c "npm run db:indexes -- --apply --create-only" # create missing indexes only
cmd /c "npm run db:seed"
cmd /c "npm run db:seed -- --demo"
```

Production roles remain authoritative in hp-v2; do not run demo seeds in production.

Cleanup and diagnostics:

```powershell
cmd /c "npm run clean:e2e-artifacts"          # dry run: reports what E2E left behind
cmd /c "npm run clean:e2e-artifacts -- --apply"
cmd /c "npm run bench:search"                 # search strategy benchmark
cmd /c "npm run bench:search -- --docs 20000"
```

`bench:search` seeds a throwaway collection in the test database and prints a
markdown comparison of the search strategies plus a scaling curve. It refuses to
run against the development database. Findings: `docs/implementation.md`.

## Verification

```powershell
cmd /c "npm run lint"
cmd /c "npm run typecheck"
cmd /c "npm test"
cmd /c "npm run build"
```

Optional browser smoke:

```powershell
cmd /c "npx playwright install chromium"
cmd /c "npm run test:e2e"
```

`test:e2e` requirements:

- A reachable MongoDB (it upserts test staff users).
- `.env.local` present — `AUTH_SECRET` and `MONGODB_URI` are read.
- Runs against a dedicated test database (`MONGODB_TEST_DB`) and starts its own
  dev server on port `12000` so it never touches the main frontend on `11000`.

## User Guides

- [Student Guide](docs/student-guide.md) — How students browse and search the Student Support Library.
- [Mentor Guide](docs/mentor-guide.md) — How mentors create and maintain support issues, write answers, and prepare content for publishing.
- [Admin Guide](docs/admin-guide.md) — How admins review, publish, unpublish, and manage reply overrides.

## Core Flows

- Google login for all Hablu Programmer LMS members (roles read from hp-v2)
- hp-v2 roles map to `ADMIN` / `MENTOR` / `VIEWER`; an unknown or inactive account is denied
- Issue forms take a student name + email, autocompleting the name from hp-v2 by email (write-only snapshot; hp-v2 is never written to)
- Mentor creates support issues with an optional first answer (text, file links, video links)
- If an answer is provided, it becomes the first reply and the issue can auto-close as SOLVED
- Mentor adds replies, external file links and video links
- VIEWER (students) can read published issues but never unpublished ones
- Issues list filters by course, batch, mentor and date range
- Dashboard shows real DB counts and recent unresolved issues for staff; VIEWER/students hitting `/dashboard` are redirected to the published library
- Chrome is a single fixed topbar with inline Dashboard/Issues navigation (Dashboard is staff-only in the nav); on mobile the account menu opens a glass sheet with identity, appearance and sign out (no nav links, keeping the nav link count stable)
- Public landing `/` shows a guest navbar (theme toggle + Sign in); guests see only the sign-in path (no nav links, search, or student CTA), while signed-in users get a library search box deep-linking to `/dashboard/issues?q=…` with role-aware CTAs; students browse published answers directly without the staff dashboard

## Design System

Support-library chrome uses a light "glass + gradient" language on top of the
shared Tailwind tokens (`app/globals.css`):

- **Brand gradient** cyan `#06b6d4` → violet `#8b5cf6` (`brand-text`, `brand-bg`).
- **Glass surfaces** (`.glass`): translucent white/slate with `backdrop-blur`, used on the topbar actions, account sheet, landing cards and the login/unauthorized cards.
- **Aurora backdrop** (`.aurora-blob`): slow drifting gradient blobs on public pages and the dashboard shell; disabled under `prefers-reduced-motion`.
- **Motion**: `framer-motion` for the mobile account sheet; also reduced-motion aware.

Theme-restricted pages keep their exact base `background-color` utilities
(`header` `white/80` → `slate-950/80`, landing `main` `slate-950`, cards
`slate-900`) — glass/gradient is layered via `background-image`, borders and
shadows so the computed colors asserted by `e2e/shell.spec.ts` stay intact.

## Deploy Notes

Production uses a standalone Next.js Docker image from GHCR behind the existing
VPS Traefik instance. The complete preparation, deployment, smoke-test, backup,
and rollback runbook is in `docs/vps-deployment.md`. Auth callback URL:

```text
https://support.hablu-programmer.com/api/auth/callback/google
```

DB-backed routes use Node.js runtime. `/api/health/live` checks the process and
`/api/health/ready` verifies both support and LMS database access. Direct uploads
are not implemented; the application stores validated external links only.

## Deferred

- Cloudflare R2 uploads
- Student self-service portal
- Public knowledge base
- AI-assisted search/answers
- Service-level integration tests
- Search engine upgrade (Atlas Search / Meilisearch / Typesense)
