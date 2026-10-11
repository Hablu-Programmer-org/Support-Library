# Hablu Support Library

Staff-first support library for Hablu Programmer. Mentors can record student support cases, add answers, external file/video links, and close cases when solved.

The interface is English throughout, with Inter typography and English date formatting. Case and reply content can still be written and searched in any language.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Auth.js v5 with Google OAuth only
- MongoDB + Mongoose
- HeroUI v2 + Tailwind CSS
- Vitest and Playwright

## Setup

```powershell
cmd /c "npm install --legacy-peer-deps"
copy .env.example .env.local
```

Fill `.env.local`:

- `MONGODB_URI`
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
cmd /c "npm run db:indexes"
cmd /c "npm run db:seed"
cmd /c "npm run db:seed -- --demo"
```

`db:seed` promotes `SEED_ADMIN_EMAIL` to `ADMIN` idempotently.

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

## Core Flows

- Google login for all Hablu Programmer LMS members (roles read from hp-v2)
- hp-v2 roles map to `ADMIN` / `MENTOR` / `VIEWER`; an unknown or inactive account is denied
- Case forms take a student name + email, autocompleting the name from hp-v2 by email (write-only snapshot; hp-v2 is never written to)
- Mentor creates support cases with optional solution (text, file links, video links)
- If solution provided, it becomes the first reply and case can auto-close as SOLVED
- Mentor adds replies, external file links and video links
- VIEWER (students) can read published cases but never unpublished ones
- Cases list filters by course, batch, mentor and date range
- Dashboard shows real DB counts and recent unresolved cases for staff; VIEWER/students hitting `/dashboard` are redirected to the published library
- Chrome is a single fixed topbar with inline Dashboard/Issues navigation (Dashboard is staff-only in the nav)
- Public landing `/` shows a guest navbar (theme toggle + Sign in); guests see only the sign-in path (no nav links, search, or student CTA), while signed-in users get a library search box deep-linking to `/dashboard/issues?q=…` with role-aware CTAs; students browse published solutions directly without the staff dashboard

## Deploy Notes

Deployment target is **undecided (VPS vs Vercel)**. Until it is picked, keep
configuration provider-agnostic.

If Vercel is chosen: set all env vars in project settings, use MongoDB Atlas, and
allow Vercel outbound access. Auth callback URL:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

DB-backed routes use Node.js runtime. Direct uploads are not implemented; MVP
stores external links only.

## Deferred

- Cloudflare R2 uploads
- Student self-service portal
- Public knowledge base
- AI-assisted search/answers
- Service-level integration tests
- Search engine upgrade (Atlas Search / Meilisearch / Typesense)
