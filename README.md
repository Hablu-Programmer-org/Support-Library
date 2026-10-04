# Hablu Support Library

Staff-first support library for Hablu Programmer. Mentors can record student support cases, add answers, internal notes, external file/video links, and convert repeated issues into reusable solution articles.

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
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL=http://localhost:3000`
- `AUTH_TRUST_HOST=true`
- `STAFF_EMAIL_ALLOWLIST`
- `INITIAL_ADMIN_EMAIL`

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

`db:seed` promotes `SEED_ADMIN_EMAIL` or `INITIAL_ADMIN_EMAIL` to `ADMIN` idempotently.

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

## Core Flows

- Google login with staff email allowlist
- Initial admin via `INITIAL_ADMIN_EMAIL`
- Admin promotes staff from `VIEWER` to `MENTOR` or `ADMIN`
- Mentor creates student records
- Mentor creates support cases
- Mentor adds replies, internal notes, external file links and video links
- Mentor creates reusable solution articles
- Cases link to solution articles via `case_solution_links`
- Global search covers cases and solutions
- Dashboard and analytics show real DB counts

## Vercel Deploy Notes

Set all env vars in Vercel project settings. Use MongoDB Atlas and allow Vercel outbound access. Auth callback URL:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

DB-backed routes use Node.js runtime. Direct uploads are not implemented; MVP stores external links only.

## Deferred

- Cloudflare R2 uploads
- Student self-service portal
- Public knowledge base
- AI-assisted search/answers
- Advanced E2E authenticated role matrix
