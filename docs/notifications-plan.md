# Notifications System — Implementation Plan

> **Audience:** an AI coding agent (Claude Code) working in the `support-library` repo.
> **Owner:** Eshan (Hablu Programmer). **Written:** 2026-11-23 against `main` @ v1.0.6.
> **Status:** approved direction, not yet implemented.

Read this whole file before writing code. Work phase by phase, run the verification
commands at the end of every phase, and stop at each phase boundary to report.

---

## 0. Before you start (mandatory)

1. Read `AGENTS.md`. This repo runs **Next.js 16** — read the relevant guide in
   `node_modules/next/dist/docs/` before writing route handlers, server actions or
   client components. Do not rely on memory of older Next.js APIs.
2. This plan was written from a code read on 2026-11-23. **Re-verify every file path,
   function name and line reference below** before relying on it. If something has
   moved or changed, adapt and note it in your phase report — do not force the plan
   onto code that no longer matches.
3. Read these files fully before Phase 1:
   - `models/support-issue.ts`, `models/support-reply.ts`, `models/user.ts`,
     `models/access-email-outbox.ts`, `models/index.ts`
   - `lib/services/issues.ts` (`createIssue`, `updateIssue`, `changeIssueStatus`,
     `publishIssue`, `softDeleteIssue`)
   - `lib/services/replies.ts` (`addReply`, `addStudentReply`, `editReply`)
   - `lib/services/access-email-outbox.ts`, `lib/access-email-outbox-policy.ts`,
     `lib/services/n8n-email.ts`, `scripts/access-email-worker.ts`
   - `lib/services/audit.ts`, `lib/services/rate-limit.ts`, `lib/safe-action.ts`,
     `lib/csrf.ts`, `lib/issue-ownership.ts`, `lib/reply-state.ts`, `lib/roles.ts`
   - `components/shared/auto-refresh.tsx`, `app/api/issues/activity/route.ts`,
     `components/layout/topbar.tsx`, `components/layout/mobile-menu.tsx`,
     `lib/config/nav.ts`
   - `docs/workflow.md`, `docs/student-guide.md`, `docs/implementation.md`
4. Never break the existing access-email flow (n8n / OpenAI / rejection emails). Its
   tests must stay green untouched.

---

## 1. Why this exists (problem statement)

- **A broken promise in production copy.** `components/issues/student-request-view.tsx`
  tells students *"The support team has it now and will reply by email"*, and
  `docs/student-guide.md` repeats "the team answers you by email". **No code sends an
  email when staff reply.** `nodemailer` is only used by `lib/services/n8n-email.ts`
  for tool-access emails. Students wait for emails that never arrive.
- **Students can now reply** (`addStudentReplyAction` → `addStudentReply`, rendered by
  `StudentReplyComposer`), but staff have no signal beyond list refreshes, and the
  student guide still says students cannot reply.
- Staff discover new student issues only by watching `/dashboard`.

**Goal:** a reliable, private, low-noise notification system with an in-app inbox
(bell) for every signed-in user and transactional email for the few events where a
student must act or is waiting.

### Non-goals (do NOT build)

- No WebSockets / SSE / Socket.io, no Redis, no BullMQ, no new infrastructure.
- No browser push / service worker / FCM.
- No SMS / WhatsApp.
- No changes to how the LMS (`hp-v2`) works; this app only reads it.
- No rewrite of the access-email outbox.

---

## 2. Existing building blocks to reuse

| Need | Already in repo | How to use it |
|---|---|---|
| Atomic writes | `mongoose.connection.transaction(async (session) => …)` in `createIssue`, `addReply`, `addStudentReply`, `changeIssueStatus`, `updateIssue` | Create notifications **inside the same transaction**, passing `session` |
| Issue statuses | `CASE_STATUSES` in `lib/constants.ts`: `OPEN, SOLVED, PENDING, AWAITING_STUDENT, FOLLOW_UP, ARCHIVED` | `AWAITING_STUDENT` is the "need more info" signal — do not add a new status |
| Reply state | `awaitingStaff`, `lastStaffReplyAt`, `lastStudentReplyAt` on `SupportIssue` | Drives SLA and reminder jobs |
| Auto transitions | `addStudentReply`: `SOLVED → FOLLOW_UP`, `AWAITING_STUDENT → OPEN` | Notification type depends on the previous status |
| Email delivery | `access-email-outboxes` + `scripts/access-email-worker.ts` (lease, retry, backoff, heartbeat, Docker service `access-email-worker` in `compose.production.yml`) | Copy the **pattern** into a separate notification outbox; run it in the **same worker process** |
| SMTP transport | `transporter()` in `lib/services/n8n-email.ts` | Extract to a shared module (see §6.3) |
| Polling | `AutoRefresh` + `/api/*/activity` routes returning `{ revision, count }` only | Same contract for the bell |
| Audit | `recordAuditEvent(event, context, session)` | Audit read-all / preference changes only, not every notification |
| Rate limits | `consumeRateLimit(scope, userId)` with `RATE_LIMITS` map | Add scopes for the new endpoints/actions |
| CSRF | `withCsrfProtection`, `csrfTokenIsValid` | All new mutations |
| Ownership | `buildOwnIssueFilter(studentId)` | Never let a notification leak another student's issue |
| Indexes | `npm run db:indexes` (`scripts/sync-indexes.ts`) | Register new models/indexes there |

---

## 3. Key decisions (already made — follow them)

1. **One `notifications` collection** = the in-app inbox. One document per recipient
   per event.
2. **Notifications are written in the same DB transaction as the triggering change.**
   If the reply/status change rolls back, the notification rolls back. A failure to
   *create* a notification must not be swallowed silently inside a transaction — it
   should fail the transaction (it is a DB write like any other). Email delivery, in
   contrast, is asynchronous and must never block or fail the user action.
3. **Idempotency via `dedupeKey`** with a unique index `{ recipientId, dedupeKey }`.
   Replayed operations (same `createOperationId`) must not create duplicates — the
   existing replay path returns early before the transaction, so this mostly holds;
   the unique index is the hard guard. Treat duplicate-key errors on notification
   insert as "already notified" (use `insertMany(..., { ordered: false })` or
   per-document upsert with `$setOnInsert`; do not abort the business transaction on
   a notification duplicate).
4. **Email goes through a new outbox** `notification-email-outboxes`, not the access
   outbox. The access outbox has encrypted invitation payloads and 30-min TTL
   semantics that do not apply here. Reuse its *policy helpers* (backoff, lease,
   transient-code classification) by extracting shared pieces, without changing
   access-email behaviour.
5. **Emails never store or contain sensitive content.** No reply body, no student
   email in the outbox document, no attachments. The email contains: event headline,
   issue title (truncated to 80 chars), six-digit `caseRef`, and a link. The recipient
   address is resolved **at send time** from `UserModel.email` (`staff-users`), so the
   outbox never stores an address.
6. **Recipients are user ids, never emails.** A student is notifiable only if
   `issue.createdBy` resolves to a `UserModel` with `role: "STUDENT"` and
   `isActive: true`. Staff-created issues on behalf of a student (where `createdBy` is
   the staff member) produce **no student notification** — there is no linked account.
7. **Never notify the actor about their own action** (`recipientId !== actorId`).
8. **Polling, not push.** The bell polls a revision endpoint every 30 s while the tab is
   visible (reuse `AutoRefresh` behaviour: back-off on failure, pause when hidden,
   re-probe on focus).

---

## 4. Data model

### 4.1 `models/notification.ts` (collection `notifications`)

```ts
export const NOTIFICATION_TYPES = [
  // student-facing
  "STAFF_REPLIED",
  "NEEDS_STUDENT_INFO",        // status -> AWAITING_STUDENT
  "ISSUE_SOLVED",              // status -> SOLVED
  "ISSUE_PUBLISHED",
  "MENTOR_ASSIGNED",
  "ISSUE_ARCHIVED",
  "AWAITING_STUDENT_REMINDER", // scheduled
  "ACCESS_REQUEST_SENT",
  "ACCESS_REQUEST_REJECTED",
  // staff-facing
  "STUDENT_ISSUE_CREATED",
  "STUDENT_REPLIED",
  "STUDENT_REOPENED",          // student reply turned SOLVED -> FOLLOW_UP
  "LIVE_SUPPORT_WAITING",
  "SLA_BREACH",                // scheduled
  "ACCESS_REQUEST_CREATED",
  "ACCESS_EMAIL_FAILED",
] as const;
```

Fields:

| Field | Type | Notes |
|---|---|---|
| `recipientId` | ObjectId ref `user`, required | |
| `type` | enum `NOTIFICATION_TYPES`, required | |
| `issueId` | ObjectId ref `support-issue`, default null | |
| `requestId` | ObjectId ref `n8n-access-request`, default null | |
| `replyId` | ObjectId ref `support-reply`, default null | |
| `actorId` | ObjectId ref `user`, default null | null for system jobs |
| `caseRef` | String `/^\d{6}$/`, default null | snapshot for display |
| `title` | String, max 200, required | snapshot of issue title / request label; **never** reply body |
| `href` | String, required | app-relative path only, must start with `/dashboard/` |
| `readAt` | Date, default null | |
| `emailStatus` | enum `NONE, PENDING, SENT, SKIPPED, FAILED`, default `NONE` | |
| `dedupeKey` | String, required, max 200 | |
| timestamps | `createdAt`, `updatedAt` | |

Indexes:

- `{ recipientId: 1, dedupeKey: 1 }` unique — name `notifications-recipient-dedupe-unique`
- `{ recipientId: 1, readAt: 1, createdAt: -1 }` — inbox + unread count
- `{ recipientId: 1, issueId: 1, readAt: 1 }` — mark an issue's notifications read
- TTL: `{ readAt: 1 }` with `expireAfterSeconds: 90 days`, partial filter
  `{ readAt: { $type: "date" } }` (unread notifications never expire)
- Hard cap: also add TTL-like cleanup for unread older than 180 days in the worker
  (Mongo allows one TTL index per field; do the second cleanup in code).

Export from `models/index.ts`. Register indexes with `scripts/sync-indexes.ts`.

### 4.2 `models/notification-email-outbox.ts` (collection `notification-email-outboxes`)

| Field | Notes |
|---|---|
| `recipientId` | ObjectId, required |
| `issueId` / `requestId` | grouping key for coalescing (at least one set) |
| `notificationIds` | ObjectId[] — the notifications this email covers |
| `kind` | `STUDENT_ISSUE_UPDATE`, `STUDENT_REMINDER`, `STAFF_DIGEST` (Phase 3) |
| `status` | `QUEUED, SENDING, SENT, SKIPPED, RETRY, FAILED` |
| `attempts`, `nextAttemptAt`, `leaseId` (select:false), `leaseExpiresAt` | same semantics as access outbox |
| `messageId` | deterministic `<notify-{jobId}@hablu-programmer.com>` |
| `skipReason` | `ALL_READ`, `OPTED_OUT`, `NO_ADDRESS`, `INACTIVE`, `ISSUE_GONE` |
| `lastErrorCode`, `sentAt`, `failedAt`, `purgeAt` | |

Indexes: delivery queue `{ status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 }`;
coalescing `{ recipientId: 1, issueId: 1, status: 1 }`; TTL on `purgeAt`.

### 4.3 `SupportIssue` additions

- `statusChangedAt: Date | null` — set in `changeIssueStatus`, in the student-reply
  auto-transition in `addStudentReply`, and on create. Used by the reminder job.
  Write it without disturbing the optimistic-revision contract: it is set in the
  same `$set` that already bumps `updatedAt`, so no extra revision change. Existing
  rows stay `null` and are simply ignored by the reminder job (no backfill needed).

### 4.4 User notification preferences

Add to `models/user.ts`:

```ts
notificationPrefs: {
  emailIssueUpdates: { type: Boolean, default: true }, // students
  emailStaffDigest:  { type: Boolean, default: false }, // staff, Phase 3
}
```

Critical in-app notifications cannot be turned off. Email opt-out does **not** apply
to `NEEDS_STUDENT_INFO` (the student is blocked) — confirm with owner (see §12).

---

## 5. Event catalog (what, who, when, where to hook)

Columns: **In-app** always unless stated. **Email** = enqueues an outbox job.

### 5.1 Student-facing

| # | Type | Trigger & condition | Recipient | Email | Hook |
|---|---|---|---|---|---|
| S1 | `STAFF_REPLIED` | New reply with `isStaffReply: true` on a non-deleted, non-archived issue | `issue.createdBy` if STUDENT & active & ≠ author | **Yes** | `addReply` (inside transaction, after `REPLY_CREATE` audit) |
| S2 | `NEEDS_STUDENT_INFO` | Status changes **to** `AWAITING_STUDENT` from anything else | owner student | **Yes** | `changeIssueStatus`; also `updateIssue` if it changes status |
| S3 | `ISSUE_SOLVED` | Status changes **to** `SOLVED` from anything else | owner student | **Yes** | same as S2; also `createIssue` with `solveIssue` only if `createdBy` is a student (normally not) |
| S4 | `ISSUE_PUBLISHED` | Visibility becomes `PUBLISHED` (via `publishIssue` or publish-with-solve) | owner student | No | `publishIssue`, `changeIssueStatus` (`publish` branch) |
| S5 | `MENTOR_ASSIGNED` | `mentorId` goes from `null` to a value | owner student | No | `updateIssue` — read previous `mentorId` inside the transaction before updating |
| S6 | `ISSUE_ARCHIVED` | Issue soft-deleted/archived | owner student | No | `softDeleteIssue` |
| S7 | `AWAITING_STUDENT_REMINDER` | Scheduled: status `AWAITING_STUDENT`, `statusChangedAt` ≥ 48 h ago, no student reply since | owner student | **Yes** (once per `statusChangedAt`) | worker job (§7) |
| S8 | `ACCESS_REQUEST_SENT` | n8n/OpenAI request moves to `SENT` | `request.studentId` | No (already emailed by access outbox) | where status becomes `SENT` in `lib/services/n8n-requests.ts` / access outbox finalize |
| S9 | `ACCESS_REQUEST_REJECTED` | Request moves to `REJECTED` | `request.studentId` | No (already emailed) | `rejectN8nRequest` |

Merge rule: when one staff action produces S1 **and** S2/S3 (reply then status change
within 2 minutes on the same issue), the in-app notifications stay separate but the
**email is coalesced** into one (§6.2).

### 5.2 Staff-facing

| # | Type | Trigger & condition | Recipients | Email | Hook |
|---|---|---|---|---|---|
| T1 | `STUDENT_ISSUE_CREATED` | `createIssue` with `actorRole === "STUDENT"` | all active `MENTOR` + `ADMIN` | No | `createIssue` |
| T2 | `STUDENT_REPLIED` | `addStudentReply` where previous status ≠ `SOLVED` | `issue.mentorId` if set & active; else all active staff | No | `addStudentReply` |
| T3 | `STUDENT_REOPENED` | `addStudentReply` where previous status was `SOLVED` (→ `FOLLOW_UP`) | as T2 | No | `addStudentReply` (use T3 **instead of** T2) |
| T4 | `LIVE_SUPPORT_WAITING` | `recordLiveSupportJoin` returns `created: true` (request-backed join only; quick join creates no queue row → no notification) | `issue.mentorId` if set, else all active staff | No | `joinLiveSupportAction` after successful record (not inside a transaction there — insert after the upsert, dedupe key covers retries) |
| T5 | `SLA_BREACH` | Scheduled: `awaitingStaff: true`, not deleted, status not `SOLVED/ARCHIVED`, waiting since `max(createdAt, lastStudentReplyAt)` ≥ 12 h | all active `ADMIN` (+ assigned mentor) | No | worker job (§7) |
| T6 | `ACCESS_REQUEST_CREATED` | `createN8nRequests` by a student | all active `ADMIN` | No | `createN8nRequests` |
| T7 | `ACCESS_EMAIL_FAILED` | Access outbox job reaches terminal `FAILED` | all active `ADMIN` | No | `markTerminalFailure` in `access-email-outbox.ts` — **additive only**, wrapped so a notification error never changes access-email outcome |

### 5.3 Explicitly NOT notified

- Reply edits and reply deletes (`editReply`, `softDeleteReply`) — noise.
- Staff internal metadata edits (tags, priority, slugs).
- Unpublish (`unpublishIssue`) — silent to the student.
- Quick live-support join (`joinLiveSupportQuickAction`).
- Anything on a soft-deleted issue, except S6 itself.

### 5.4 `dedupeKey` formulas

| Type | dedupeKey |
|---|---|
| S1, T2, T3 | `{TYPE}:{replyId}` |
| S2, S3 | `{TYPE}:{issueId}:{statusChangedAt ISO}` |
| S4 | `ISSUE_PUBLISHED:{issueId}:{publishedAt ISO}` |
| S5 | `MENTOR_ASSIGNED:{issueId}:{mentorId}` |
| S6 | `ISSUE_ARCHIVED:{issueId}` |
| S7 | `AWAITING_STUDENT_REMINDER:{issueId}:{statusChangedAt ISO}` |
| S8, S9, T6 | `{TYPE}:{requestId}` |
| T1 | `STUDENT_ISSUE_CREATED:{issueId}` |
| T4 | `LIVE_SUPPORT_WAITING:{issueId}:{dayKey}:{shift}` |
| T5 | `SLA_BREACH:{issueId}:{waitingSince ISO}` |
| T7 | `ACCESS_EMAIL_FAILED:{outboxJobId}` |

### 5.5 Display copy (in-app)

Keep copy in one file, `lib/notification-copy.ts`, as a pure function
`notificationCopy(type, { title, caseRef })` → `{ headline, body }`. English first,
matching the current UI; leave a single place to add Bengali later. Examples:

- S1: "New reply on #000123" / "{title}"
- S2: "The team needs more info on #000123"
- S3: "#000123 was marked solved — reply if it's still not working"
- T1: "New student issue #000123"
- T3: "Student reopened #000123"
- T5: "#000123 has waited over 12 h for staff"

---

## 6. Delivery

### 6.1 Service API — `lib/services/notifications.ts` (`server-only`)

```ts
notify(inputs: NotifyInput[], session?: ClientSession): Promise<void>
resolveIssueStudentRecipient(issue, session): Promise<ObjectId | null>
resolveStaffRecipients(opts: { mentorId?: ObjectId | null; adminsOnly?: boolean }, session): Promise<ObjectId[]>
listNotifications(userId, { cursor, limit = 20, unreadOnly }): Promise<…>
getNotificationActivitySnapshot(userId): Promise<{ revision: string; unread: number }>
markRead(userId, ids: string[]): Promise<number>
markIssueRead(userId, issueId): Promise<number>
markAllRead(userId): Promise<number>
```

`notify()` responsibilities, in order:
1. Drop inputs where `recipientId === actorId`.
2. Validate `href` starts with `/dashboard/` (pure helper, unit-tested).
3. Insert notifications ignoring duplicate-key errors on `dedupeKey`.
4. For types whose catalog row says Email = Yes, enqueue/extend an outbox job (§6.2).
5. Never read or copy reply bodies or student emails.

Keep pure decision logic (who gets what, whether to email, dedupe key, copy, quiet
hours) in a separate **pure** module `lib/notification-policy.ts` so it can be unit
tested without a DB — same split the repo uses for `live-support-policy.ts` and
`access-email-outbox-policy.ts`.

### 6.2 Email coalescing and timing

When an emailable notification is created for recipient R on issue I:

1. Look for an outbox job with `{ recipientId: R, issueId: I, status: "QUEUED" }`.
   - If found: `$addToSet` the notification id. Do not move `nextAttemptAt` earlier.
   - If not: create one with `nextAttemptAt = sendAfter(now)`.
2. `sendAfter(now) = max(now + 2 min, quietHoursEnd(now))` where quiet hours are
   **23:00–08:00 Asia/Dhaka** (reuse the Dhaka day helpers used by live support).
   The 2-minute debounce lets "reply + mark solved" land as one email.
3. At send time the worker:
   - re-loads the notifications; if **all** have `readAt` → mark job `SKIPPED/ALL_READ`;
   - re-checks user active + `notificationPrefs.emailIssueUpdates` (except
     `NEEDS_STUDENT_INFO`, see §12) → `SKIPPED/OPTED_OUT`;
   - re-checks the issue is not deleted → `SKIPPED/ISSUE_GONE`;
   - resolves `UserModel.email` → missing → `SKIPPED/NO_ADDRESS`;
   - builds one email listing the unread events (headline lines only), sends, then sets
     each covered notification's `emailStatus`.
4. Retry/backoff/lease identical in spirit to `access-email-outbox-policy.ts`
   (5 attempts, 1m/5m/15m/1h/6h). Terminal failure → `FAILED`, notification
   `emailStatus: FAILED`. Do not create T7 for these (T7 is access emails only);
   instead log a structured event.

Email template (`lib/services/notification-email.ts`):
- Subject: `[Hablu Support] {headline}` (e.g. `[Hablu Support] New reply on #000123`).
- Body: greeting with first name, bullet list of headlines, issue title, one button
  "Open your request" → `${NEXT_PUBLIC_APP_URL}/dashboard/issues/{id}`, footer with
  how to turn off email updates.
- Escape all interpolated values (reuse `escapeHtml` from `n8n-email.ts` — move it to a
  shared helper). Plain-text alternative required.
- Headers: deterministic `Message-ID`; `List-Unsubscribe` pointing to the preferences page.

### 6.3 SMTP transport extraction

Move `transporter()` / `closeAccessEmailTransport()` into `lib/services/smtp.ts`,
re-export from `n8n-email.ts` under the old names so nothing else changes. Existing
`access-email-transport.test.ts` must pass unchanged.

### 6.4 Worker

Extend `scripts/access-email-worker.ts` (keep the file name and Docker service so
deploys don't change):
- `processOne()` tries access jobs first, then a notification job.
- Every 5 minutes (track last run in memory, plus a DB-level guard via dedupe keys so
  two workers can't double-notify), run scheduled jobs (§7) and the 180-day unread
  cleanup.
- Keep heartbeat semantics. Add `--check` coverage for the new collection.
- Log JSON events with `service: "access-email-worker", stream: "notifications"`.
  Never log email addresses or titles.

---

## 7. Scheduled jobs (in the worker)

Both jobs are idempotent purely through `dedupeKey`; running them twice is safe.

**S7 — Awaiting-student reminder**
```
SupportIssue.find({
  deletedAt: null,
  status: "AWAITING_STUDENT",
  statusChangedAt: { $lte: now - 48h, $gte: now - 14d },
}).limit(200)
```
Skip if `lastStudentReplyAt > statusChangedAt`. Recipient via
`resolveIssueStudentRecipient`. Email = Yes. At most one reminder per
`statusChangedAt` (dedupe key guarantees it). Add an index if `explain()` shows a
collection scan: `{ status: 1, statusChangedAt: 1 }` partial on `deletedAt: null`.

**T5 — SLA breach**
```
SupportIssue.find({
  deletedAt: null,
  awaitingStaff: true,
  status: { $nin: ["SOLVED", "ARCHIVED"] },
}).sort({ awaitingStaff: -1, createdAt: 1, _id: 1 }).limit(200)
```
(backed by the existing `issues-answer-needed-first` index). Compute
`waitingSince = max(createdAt, lastStudentReplyAt)`; notify if ≥ 12 h.
Threshold lives in `lib/notification-policy.ts` as `SLA_BREACH_HOURS = 12`.

---

## 8. HTTP surface and UI

### 8.1 Routes and actions

| Path | Kind | Auth | Rate-limit scope |
|---|---|---|---|
| `GET /api/notifications/activity` | route handler | any active signed-in user | `notifications.activity` 120/min |
| `GET /dashboard/notifications` | page | any active signed-in user | — |
| `markNotificationsReadAction(ids)` | server action + CSRF | owner only (`recipientId = session user`) | `notifications.mutate` 60/min |
| `markAllNotificationsReadAction()` | server action + CSRF | owner | `notifications.mutate` |
| `markIssueNotificationsReadAction(issueId)` | server action + CSRF | owner | `notifications.mutate` |
| `updateNotificationPrefsAction(prefs)` | server action + CSRF | owner | `notifications.prefs` 10/10min |

The activity route follows `app/api/issues/activity/route.ts` exactly: `runtime =
"nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: private, no-store`, returns
only `{ revision, unread }` — **no titles, no content**. Revision =
`{latest notification createdAt or readAt}:{unread}` for that user.

Every query in `notifications.ts` must filter by `recipientId = session user id`.
There is no admin view of other users' notifications.

### 8.2 Components

- `components/notifications/notification-bell.tsx` (client) — icon button in the
  topbar between theme toggle and `UserMenu`, unread badge (cap display at `9+`),
  `aria-label="Notifications, {n} unread"`, links to `/dashboard/notifications`.
  Polls the activity endpoint using the same approach as `AutoRefresh` (pause when
  hidden, back-off, re-probe on focus). It must **not** pull framer-motion into the
  topbar chunk — `__tests__/topbar-bundle.test.ts` must stay green.
- Mobile: add a "Notifications" row with the badge to `MobileMenu`.
- `/dashboard/notifications` page — list (newest first, cursor pagination 20/page),
  unread rows visually distinct, "Mark all as read", empty state, loading skeleton,
  error state. Clicking a row marks it read and navigates to `href`.
- `components/notifications/mark-issue-read.tsx` (client) — mounted on the student
  request view and the staff issue detail page; on mount calls
  `markIssueNotificationsReadAction` once (no mutation during server render).
- Preferences: a small "Email me about updates to my issues" toggle on the
  notifications page (students). Staff digest toggle in Phase 3.
- Add `Notifications` to `lib/config/nav.ts` only if it fits the existing nav
  rules; otherwise the bell is enough.

Follow existing UI conventions (Tailwind classes in `nav-styles.ts`, HeroUI
primitives, light/dark pairs, 44 px touch targets on mobile, visible focus rings).

---

## 9. Copy and docs to update (same PR as Phase 1)

- `components/issues/student-request-view.tsx`: replace "will reply by email" with
  copy that is true: replies appear on this page, you'll get a notification and an
  email when the team replies, and you can reply here.
- `docs/student-guide.md`: remove "you cannot reply inside the app" / "team answers by
  email" statements; add a Notifications section and the email preference.
- `docs/mentor-guide.md`, `docs/admin-guide.md`: bell, what staff get notified about,
  SLA threshold.
- `docs/workflow.md`: add the notification step to the flow diagram and staff table.
- `docs/implementation.md`: add a "Notifications" entry under Completed per phase.
- `docs/RUNBOOK.md`: worker now also sends notification email; how to inspect
  `notification-email-outboxes`; how to re-run a failed job.
- `.env.example`: document any new variable (prefer constants over env unless the
  owner needs to tune it; `NOTIFICATION_SLA_HOURS` optional).

---

## 10. Testing (required, per phase)

**Unit (vitest, `__tests__/`)** — pure modules first:
- `notification-policy.test.ts`: recipient rules (self-exclusion, staff-created issue
  → no student, inactive user → none, unassigned → all staff), type selection on
  student reply (T2 vs T3), status-transition detection (S2/S3 only on change),
  dedupe key formulas, quiet-hours `sendAfter` incl. 22:59/23:00/07:59/08:00 Dhaka
  edges, SLA threshold maths, `href` validation.
- `notification-copy.test.ts`: every type renders; no body/email fields accepted.
- `notification-email.test.ts`: HTML escaping, plain-text part, no reply body, link
  uses `NEXT_PUBLIC_APP_URL`, subject format.
- `notification-activity-route.test.ts`: 401/403/429/503 paths, payload has only
  `revision` + `unread`, `no-store` header (mirror `issue-activity-route.test.ts`).
- `notification-bell.test.tsx`: badge, `9+`, aria-label, hidden-tab pause.
- Existing `topbar-bundle.test.ts`, `access-email-*.test.ts` stay green.

**Integration (test DB, `MONGODB_TEST_DB`)**:
- Staff reply → exactly one `STAFF_REPLIED` for the owning student, one outbox job.
- Reply + `SOLVED` within 2 min → two notifications, **one** outbox job.
- Replayed `createOperationId` → no duplicate notification.
- Transaction rollback (force an error after notify) → no notification persisted.
- Worker: all-read → `SKIPPED/ALL_READ`; opted-out → skipped; send success sets
  `emailStatus: SENT` on all covered notifications. Use a fake transport.
- Reminder and SLA jobs run twice → one notification each.

**E2E (Playwright, `e2e/notifications.spec.ts`)** using existing fixtures in
`e2e/fixtures/`:
- Student submits → mentor sees bell count increase → mentor replies → student sees
  bell badge → opening the request clears it.
- Student cannot read another user's notifications (direct action call with another
  id → 0 updated / 404).
- Mobile menu shows the Notifications row with count.

---

## 11. Phases and acceptance criteria

### Phase 1 — Core inbox + the broken promise (ship first)
Scope: §4.1, §4.3, §4.4 (`emailIssueUpdates` only), §6 fully, §8 (bell, page,
mark-read, student email toggle), events **S1, S2, S3, T1, T2, T3**, §9 copy/docs.

Done when:
- [ ] A staff reply produces an in-app notification and (after ≤ 2 min, outside quiet
      hours) one email to the owning student; reading it in-app first skips the email.
- [ ] Students see new staff replies/status changes via the bell within ~30 s.
- [ ] Staff see new student issues and replies via the bell.
- [ ] No notification ever references another student's issue to a student.
- [ ] Student-facing copy no longer promises anything the system doesn't do.
- [ ] `npm run verify` green; new unit + integration tests added; `npm run db:indexes`
      creates the new indexes; `test:e2e` green for notification specs.

### Phase 2 — Reliability signals
Scope: §7 jobs (**S7, T5**), **T4**, `statusChangedAt` usage, 180-day cleanup, runbook.

Done when: reminder sends at most once per waiting period; SLA alerts reach admins;
running the worker twice never duplicates; worker heartbeat/health unchanged.

### Phase 3 — Completeness
Scope: **S4, S5, S6, S8, S9, T6, T7**, staff email digest (daily 09:00 Dhaka summary
to staff who opt in: new issues, waiting > SLA, reopened), preference UI for staff.

Done when: every row in §5 is implemented or explicitly deferred with a note in
`docs/implementation.md`.

**Stop after each phase**, report: files changed, migrations/index changes, test
results, anything in the plan that didn't match the code, and open questions.

---

## 12. Open decisions for the owner (ask, don't guess)

1. Should `NEEDS_STUDENT_INFO` email ignore the student's email opt-out? (Plan
   assumes **yes**, it is a blocking request.)
2. Email language: English only, or English + a Bengali line? (Plan assumes English
   with a short Bengali line under the headline; confirm wording.)
3. SLA threshold: 12 h? Count overnight quiet hours or not?
4. T1 for every new student issue to every mentor — fine at current volume? (Alternative:
   only admins + digest.)
5. Should quick live-support joins notify staff? (Plan: no, they are intentionally
   unqueued.)
6. Auto-close of `SOLVED` issues with no student reply after N days — out of scope
   here; confirm whether wanted later.

---

## 13. Guardrails checklist (review before each commit)

- [ ] No reply body, student email or attachment name in any notification, outbox
      document, email, log line or activity response.
- [ ] Every notification query filters by the session user's id.
- [ ] Notification inserts happen inside the triggering transaction with `session`.
- [ ] Duplicate-key on notification insert never aborts the business action.
- [ ] Email failures never surface as user-facing action errors.
- [ ] Access-email behaviour and tests unchanged.
- [ ] New mutations have CSRF + rate limit; new routes have `no-store`.
- [ ] Topbar bundle test still passes (no heavy deps in the bell).
- [ ] Docs and student-facing copy updated in the same change.
- [ ] `npm run verify` (lint, typecheck, test, build) green; `test:e2e` for touched flows.
