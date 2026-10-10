# Dependency Upgrade Plan — Support Library

Status legend: `pending` · `in-progress` · `done` · `blocked`

Overall status: **in-progress (Step 6)**

## Goal

Bring `support-library` to a modern, internally-consistent dependency stack where every
version is peer-compatible, reproducible from a clean install, and verified by the full
test/build/browser gate — without changing product behaviour.

## Locked targets

| Area | Target |
|---|---|
| Node.js | supported 24.x patch, minimum `24.15.0` |
| Next.js | `16.4.0` |
| React | `19.3.0` (+ matching `@types/react`, `@types/react-dom`) |
| Styling | Tailwind `4.3.3` + `@tailwindcss/postcss` |
| UI | HeroUI `3.2.6` |
| Test tooling | Vitest `5.0.3`, Vite `8.3.4`, Playwright `1.64.0`, jsdom `30.1.2` |
| Validation | Zod `4.6.5` |
| Lint | ESLint `9.39.5` + `eslint-config-next` `16.4.0` |
| Typescript | `5.9.3` (unchanged — typescript-eslint range is `<6.1`) |
| Auth | `next-auth@5.0.0-beta.32` exact pin (no `^`) |
| Database | `mongodb` 6.x + `mongoose` 8.x (major DB upgrade out of scope) |

Versions are re-verified against the npm registry immediately before each install phase.

## Ground rules

- One coherent batch at a time; run the gate after every batch; never stack two risky
  phases in one change.
- No `--force` / `--legacy-peer-deps` workarounds that hide real conflicts.
- Remove unused packages instead of upgrading them or adding their peers.
- Do not redesign UI during migration — visual diffs must be migration fallout only.
- Full gate = `lint` → `typecheck` → `test` → delete `.next` → `build` → delete `.next` → `test:e2e`.
- Stale `.next` breaks `tsc --noEmit` (route types) — always delete `.next` before
  typecheck/build/e2e after any `next` run.
- On Windows, npm via PowerShell fails on execution policy — use `cmd /c "npm ..."`
  or `npm.cmd`. Node is managed by nvm-windows (symlink `C:\nvm4w\nodejs`).
- Bengali must not appear anywhere in this repo (UI, tests, docs, DB seeds) — the repo
  is English-only since the interface conversion.
- No commits unless explicitly requested.

## Why the order changed (ERESOLVE blocker)

The tree cannot be installed as-is: `@heroui/theme@2.4.26` (and every `@heroui/*` peer
chain) requires `tailwindcss >=4`, but the project pins `tailwindcss@3.4.19`. Also
`@hookform/resolvers@5.9.1` requires `zod ^3.25 || ^4` while root pins `zod 3.23.8`, and
`@vitejs/plugin-react@6` requires `vite ^8` while root pins `vite ^7`.

Because any `package.json` change triggers a full re-resolution, **no dependency change
can install until these conflicts are removed**. The clean fix (no forced flags) is to
do the Tailwind v4 move and remove the two unused packages first. Therefore Tailwind v4
(was Step 4) is now Step 2.

## Known risks

- `lib/db.ts` shares `mongoose.connection.getClient()` with the auth adapter →
  blocks `mongodb` 7 / `mongoose` 9 (stay on 6.x / 8.x).
- Playwright auth fixture forges a JWT cookie; real Google OAuth callback is NOT
  covered — needs a manual smoke test with a real account.
- Next 16: async `params`/`searchParams`, `middleware.ts` → `proxy.ts`,
  `serverComponentsExternalPackages` → `serverExternalPackages`, `next lint` removed.
- HeroUI v2→v3 is a component + theme migration (20 TSX files, custom cyan/slate
  theme, global `data-slot` CSS in `globals.css`).

---

## Step 1 — Node runtime + version policy

Status: **done**

- [x] Identify version manager: nvm-windows v1.29.380.
- [x] Move local runtime to Node **24.21.0** (latest 24.x LTS ≥ 24.15.0).
- [x] Add `.nvmrc` (`24.21.0`).
- [x] Add `engines.node: "^24.15.0"`.
- [ ] `@types/node` → `24.x` — **deferred to Step 2** (blocked by ERESOLVE until then).

Gate (on Node 24.21.0): lint ✓ · typecheck ✓ · **30 unit** ✓ · build ✓ (**10 routes**) ·
**29/29 e2e** ✓. This is also the recorded baseline (the only pre-existing working-tree
change was a cosmetic reordering of `scripts` in `package.json`).

## Step 2 — Unblock installs: Tailwind v4 + remove unused deps

Status: **done**

- [x] `tailwindcss` → `4.3.3`; add `@tailwindcss/postcss@4.3.3`; remove `autoprefixer`.
- [x] Create `hero.ts` exporting the `heroui()` plugin with the existing cyan/slate theme.
- [x] `app/globals.css`: CSS-first v4 entry (`@import "tailwindcss"`, `@plugin`,
      `@source`, `@custom-variant dark`, `@theme inline` font) — keep all existing
      layers/utilities/`data-slot` overrides.
- [x] `postcss.config.mjs` → `@tailwindcss/postcss`.
- [x] Remove `tailwind.config.ts` (theme moved to `hero.ts` + CSS).
- [x] Remove unused `@hookform/resolvers` and `@vitejs/plugin-react`.
- [x] `@types/node` → `^24.19.1` (the deferred Step 1 item).
- [x] Install cleanly (no forced flags).
- [x] Keep `HeroUIProvider` bypassed in `app/providers.tsx` for Step 2: rendering the
      provider during Next 14 static prerender fails with `Element type is invalid`, while
      HeroUI components render successfully without the global provider. Revisit this in
      Step 6 during the HeroUI v3 migration.
- [x] Remove server-rendered HeroUI component usage from static/server pages that blocked
      prerender (`/_not-found`, `/unauthorized`, dashboard case list/detail shells).
- [x] Update e2e color assertions for Tailwind 4 OKLCH/OKLAB browser serialization.

Gate: lint ✓ · typecheck ✓ · 30 unit ✓ · build ✓ (10 routes) · e2e ✓ (29/29).
Known residual: Next dev logs non-fatal `Element type is invalid` errors when remaining
HeroUI v2 client widgets render during e2e; tests pass. Treat this as Step 6 HeroUI v3
migration fallout, not a Step 2 blocker.

## Step 3 — Remaining small bumps + missing peers

Status: **done**

- [x] Add missing `@testing-library/dom@10.4.2`.
- [x] `dotenv` → `18.0.7`, `postcss` → `8.5.29`, `mongoose` → `8.24.5`.
- [x] `next-auth` → exact `"5.0.0-beta.32"` (drop `^`).
- [x] Re-check remaining peer errors (`picomatch`, React Spectrum types); resolve with
      correct versions, never overrides/forced flags.

Gate: lint ✓ · typecheck ✓ · 30 unit ✓ · build ✓ (10 routes) · e2e ✓ (29/29).

## Step 4 — Test tooling

Status: **done**

- [x] `vitest` → `5.0.3` (checkpoint: Vitest 5 supports Vite 7 and 8).
- [x] `vite` → `8.3.4`; `jsdom` → `30.1.2`; `@testing-library/jest-dom` → `7.0.1`.
- [x] `@playwright/test` → `1.64.0` + matching Chromium.
- [x] Review `vitest.config.ts` / `vitest.setup.ts`; update `.gitignore` if needed.

Gate: lint ✓ · typecheck ✓ · 30 unit ✓ · build ✓ (10 routes) · e2e ✓ (29/29).

## Step 5 — Next 16 + React 19 + ESLint 9

Status: **in-progress**

- [ ] `next` → `16.4.0`, `react`/`react-dom` → `19.3.0`, matching React types.
- [ ] `eslint` → `9.39.5`, `eslint-config-next` → `16.4.0`, flat config.
- [ ] Await async `searchParams` (`app/dashboard/cases/page.tsx`) and `params`
      (`app/dashboard/cases/[id]/page.tsx`); scan for other request APIs.
- [ ] `next.config.mjs`: `experimental.serverComponentsExternalPackages` →
      `serverExternalPackages`.
- [ ] `middleware.ts` → proxy migration preserving public paths, protected routes,
      `callbackUrl`, inactive-account handling.
- [ ] Replace `next lint` with the ESLint CLI; ignore `.next`, `e2e`, reports.
- [ ] React 19 review: form actions, controlled inputs, refs/types, hydration.
- [ ] Confirm default Turbopack production build.

Gate: full gate + dev smoke + production-mode protected-route/form smoke + real Google
sign-in/out manual check.

## Step 6 — HeroUI v2 → v3

Status: **pending**

- [ ] `@heroui/react` → `3.2.6`; add required React Aria peers.
- [ ] Migrate all ~20 TSX files importing HeroUI.
- [ ] Replace removed/changed APIs; port theme to the v3 styling approach (cyan/slate).
- [ ] Rewrite global `data-slot` CSS for the v3 DOM.
- [ ] Remove `@heroui/system`, `@heroui/theme`; remove `framer-motion` if unused.
- [ ] Verify FormData `name`s, required validation, keyboard nav, button vs link semantics.

Gate: full gate + visual comparison.

## Step 7 — Zod 3 → 4

Status: **pending**

- [ ] `zod` → `4.6.5`; migrate `lib/validation/*` and consumers.
- [ ] Preserve `.strict()`, defaults, preprocess/coercion.
- [ ] Re-test validation edge cases (optionals, filters, HTTPS links, answer variants).

Gate: validation tests + full gate.

## Step 8 — Clean install + final acceptance

Status: **pending**

- [ ] Plain `npm ci` succeeds from a clean `node_modules`; lockfile consistent.
- [ ] No missing/invalid peers, no engine violations, no forced flags.
- [ ] Full gate + manual checks (permissions, internal notes, case+answer, search/filter,
      dark/light/mobile, real Google login/logout).
- [ ] Update `README.md` and this file; write root session notes.

---

## Execution order (summary)

`Step 1 Node ✓ → Step 2 Tailwind v4 + cleanup → Step 3 small bumps → Step 4 test tooling → Step 5 Next/React/ESLint → Step 6 HeroUI v3 → Step 7 Zod 4 → Step 8 final`

## Checkpoint policy

After every step, report: what changed, which checks passed, any blockers, what comes
next. Nothing is marked `done` until its gate is green.
