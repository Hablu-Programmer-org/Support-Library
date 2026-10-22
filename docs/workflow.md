# Support Workflow

End-to-end journey for Hablu Programmer support: how a student gets help from the
LMS, how a request becomes a live support join, and what staff see on each screen.

This document is the detailed reference; the README carries a summary.

## 1. Scope

| App | Role in the flow |
| --- | --- |
| `hablu-programmer.com` (LMS frontend) | Entry point: Help Center modal, schedule/policy, link into this app |
| `support-library` (this app) | Search, submit, own-request view, live support join, staff queue |
| `hp-v2` (LMS database) | Source of truth for accounts and roles (read-only from here) |

A student reaches the live room **through a request**, and only through a request
they submitted. There is no room URL on the public site.

## 2. Flow at a glance

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

## 3. Student journey

1. **LMS Help Center.** The dashboard sidebar shows `Help Center` to students who
   qualify for support (premium, or `jfwd` batch ≤ 4 / `jfsd` batch ≤ 2). The modal
   explains the journey in Bengali and deliberately shows no schedule — the room's
   hours live on the request page, which is the only place that can compute them.
2. **Enter this app.** `সাপোর্ট লাইব্রেরিতে যান` opens `/dashboard/issues` **in a new
   tab** (`target="_blank"`, `rel="noopener noreferrer"`), so the LMS dashboard stays
   where it was. The first visit needs Google sign-in; roles come from
   `hp-v2.User`.
3. **Search first.** `/dashboard/issues` is the published library: search by
   keyword, filter by tag/status/course/batch/date. An existing answer is the
   fastest fix.
4. **Submit if new.** `Submit an issue` (`/dashboard/issues/new`):
   - title (≥ 5 chars) and problem (≥ 5 chars);
   - **required course** picked from the student's LMS enrolments, with the batch
     filled from the same enrolment (the server re-derives both);
   - optional evidence: up to 3 private images (PNG/JPEG/GIF/WebP, 5 MB each) and
     external HTTPS video links;
   - optional module/content/tags;
   - identity comes from the session, never the form;
   - rate limit 5 / 10 min, duplicate submit creates one issue.
5. **Own request page.** Submission redirects to
   `/dashboard/issues/{id}?created=1` with a success banner. The page shows the
   status, the six-digit reference (for example `000123`), what the student wrote,
   their images and video links, and the team's replies read-only. It never shows
   staff fields, mentor, audit or publication
   history.
6. **Live support panel.** `Join Zoom Meeting` appears only when the request is
   `OPEN`, `PENDING` or `FOLLOW_UP` **and** a shift is open in `Asia/Dhaka`
   (08:00–12:00 or 19:30–24:00). Meeting ID and passcode are rendered only in that
   state. A `SOLVED`/`ARCHIVED` request explains that it is closed and offers no
   join.
7. **Join.** The button submits a server action that re-checks ownership of the
   request, the shift, and the per-user budget (`live-support.join`, 10 / 10 min),
   records one join per request per shift per day, audits it, and only then
   redirects into the room.
8. **Come back.** `My requests` (`/dashboard/my-requests`) lists the student's own
   requests (newest first) with status and a `Live now` chip during a shift. The
   nav also keeps `Submit issue` and `My Courses` (back to the LMS).

> **Temporary shortcut (owner request — to be removed).** For students, the
> issues page also shows a **Join live support** button next to **Submit an
> issue**. It opens a popup that explains a request comes first and still offers
> a direct join. That join **skips the request requirement** but keeps CSRF, the
> server-resolved shift, the shared `live-support.join` budget (10 / 10 min) and
> an audit row (`LIVE_SUPPORT_QUICK_JOIN`); it creates **no queue row**, so the
> student does not appear in staff `Waiting today`. Remove
> `components/live-support/quick-live-support-button.tsx`,
> `joinLiveSupportQuickAction` and the audit pair once every student submits a
> request first. Search for `TEMPORARY quick join`.

## 4. Staff journey

| Screen | What it gives staff |
| --- | --- |
| `/dashboard` | `Waiting Now` (today's joins), `Waiting today` (student, reference, request link, status, shift, time), `Student requests awaiting a mentor` (student submissions with no mentor, oldest first), recent unresolved issues, popular tags |
| `/dashboard/issues` | Staff list with filters; the search box updates the list as you type; an **unresolved** issue joined today carries a `Waiting in live support` chip (a solved case keeps its join row but is no longer "waiting"); staff can search by the six-digit reference; `New Issue` creates a case on a student's behalf |
| `/dashboard/issues/{id}` | Full case: problem, attachments, replies (compose/edit/delete), status, archive, publish/unpublish (admin only, PII review required; an admin marking `SOLVED` with the short confirmation publishes in the same step), `Reference` and `Live support` (last join time) |
| `/dashboard/support` | Staff join for the room; no request required, staff never appear in the queue |
| `/dashboard/live-support` | Today's queue, newest first, with a 30-second auto-refresh while the tab is visible and a manual `Refresh` button |

**How a waiting student becomes visible:** a queue row is created when the student
presses **Join**, not when the request is submitted. It then appears on the
dashboard card/section, as a chip in the issue list, and on the queue page.

## 5. Live support rules

| Rule | Detail |
| --- | --- |
| Shift | Morning 08:00–12:00, night 19:30–24:00, resolved on the server in `Asia/Dhaka` |
| Eligibility | Only `OPEN`, `PENDING`, `FOLLOW_UP` requests owned by the student |
| Idempotency | Unique `{issueId, dayKey, shift}`: a double submit keeps one row, a second visit in the other shift is a new row |
| Queue scope | Today only (`dayKey` in Asia/Dhaka), newest first, bounded to 200 rows |
| Reference | Six digits, allocated in order by an atomic counter inside the create transaction (`000001`, `000002`, …) — unique, digits-only, searchable |
| Retention | Join rows expire after 180 days |
| Privacy | The queue shows student name/email, reference, request title, status, shift and time — never a passcode, IP or token |
| Availability display | Meeting ID/passcode are absent from the response while the room is closed |

## 6. Data and security notes

- **Ownership** is always `createdBy = session user`, resolved by
  `lib/issue-ownership.ts`. A non-owner gets `404` for an unpublished case.
- **Eligibility** is always the shared filter in `lib/live-support-policy.ts`, used
  by the join action so the read path and the write path cannot drift.
- **Room credentials** exist only in this app (`LIVE_SUPPORT_*`), resolved on the
  server; the LMS bundle carries none of them.
- **Replies** are read-only for students; the public projection strips author ids
  and reply attachments.
- **Audit**: joins (success and denial) write `ISSUE_LIVE_SUPPORT_JOIN`; the
  temporary request-less quick join writes `LIVE_SUPPORT_QUICK_JOIN`; issue,
  reply and publication changes are audited as before.
- **Indexes**: `student_own_requests`, `student_own_issues`, `awaiting_mentor`,
  `live-support-joins-issue-day-shift-unique`, `live-support-joins-day-joined`
  (plus the TTL). The deploy pipeline runs `db:indexes --apply --create-only` then
  `--verify`; without it the unique guard is missing.

## 7. Edge cases

| Situation | Result |
| --- | --- |
| Outside a support shift | Join disabled; meeting details absent |
| Request-less quick join | Popup explains the request-first path; the join skips the request requirement but still needs a shift and is audited |
| Request solved or archived | No join; submit a new request |
| Another student's unpublished request | `404` |
| Another student's published issue | Read-only library view |
| Double submit within one shift | One join row |
| Second visit in the other shift | A separate row with the correct shift/time |
| Duplicate issue submission | One issue (operation id + unique index) |
| Soft-deleted request | Queue row marked `(removed)`; gone from the student's list |
| Empty queue during a shift | Nobody has pressed Join yet |
| Legacy `/dashboard/issues/submitted` | Redirects to `My requests` |
| LMS password account | Must sign in with Google here (this app is Google-only) |

## 8. Cross-app configuration

| Setting | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPPORT_LIBRARY_URL` | LMS frontend | Base URL for the Help Center CTA (defaults to `https://support.hablu-programmer.com`) |
| `NEXT_PUBLIC_LMS_URL` | this app | `My Courses` link back to the LMS (omitted when unset) |
| `LIVE_SUPPORT_PLATFORM` / `_JOIN_URL` / `_MEETING_ID` / `_PASSCODE` | this app | The room |
| `npm run check:live-support` | this app | Fails when the schedule copy drifts or when any room credential reappears in the LMS config |

## 9. Where to change things

| Concern | File |
| --- | --- |
| Student join panel | `components/live-support/live-support-panel.tsx` |
| Staff join page | `app/dashboard/support/page.tsx` + `components/live-support/live-support-card.tsx` |
| Queue page / refresh | `app/dashboard/live-support/page.tsx`, `components/live-support/{join-queue,queue-refresh}.tsx` |
| Own request view | `components/issues/student-request-view.tsx` + owner branch in `app/dashboard/issues/[id]/page.tsx` |
| Eligibility / ownership filters | `lib/live-support-policy.ts`, `lib/issue-ownership.ts` |
| Join write path | `actions/live-support.ts`, `lib/services/live-support-joins.ts` |
| Schedule | `lib/config/live-support.ts` (and the LMS copy, guarded) |

## 10. Open items

1. The LMS premium/batch rule only hides the Help Center button; this app does not
   enforce it (feature-inventory 12.18).
2. An eligible student can share the room URL; per-shift room rotation or Zoom
   Registration API would be needed to prevent that.
3. Two attachment Playwright specs fail on the Cloudinary path (pre-existing).
4. This app signs in with Google only; LMS password accounts need a second sign-in.
