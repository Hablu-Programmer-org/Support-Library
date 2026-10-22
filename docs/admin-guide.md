# Admin Guide � Hablu Support Library

## Uploaded image attachments

Issues and replies may carry uploaded image attachments (PNG/JPEG/GIF/WebP). They render under an "Attachments" heading and download through `/api/attachments/<id>`, which authorizes the session (ADMIN/MENTOR, or the uploader) before streaming. Uploads are never published and never appear in the public library projection. Existing attachments show authorized thumbnail previews on the issue edit form; select a preview to open the original, or use its checkbox to remove it. New image attachments can also be added there. Replies cannot be edited for attachments in this phase.

Every attachment picker also shows a browser-local preview immediately after image selection, before the create/edit/reply form is submitted. A preview card's `Remove` button removes that image from the submitted file list. The local preview does not upload or expose the file early.

y

This guide explains how admins review support issues, publish safe answers to the Student Library, remove published content, and handle re-review after staff changes.

The Support Library is a staff-first support knowledge base. Mentors and admins create and maintain support issues. Admins are responsible for the final publishing decision before students can read an issue in the Student Library.

## 1. What Admin Publishing Means

Publishing changes an issue from staff-only visibility to student-visible visibility.

Visibility states:

| State | Meaning |
| --- | --- |
| `INTERNAL` | Staff can see the issue. Students cannot see it. |
| `PUBLISHED` | Students can see the issue in the Student Library. |

Publishing does not anonymize content automatically. It only changes visibility after an admin confirms the content was reviewed.

Admins must review public-facing text before publishing because copied student personal information can still appear in titles, problem descriptions, issue attachments, replies, and link metadata.

## 2. Who Gets Admin Access

Access is controlled by the main Hablu Programmer LMS database. The Support Library keeps a local `staff-users` cache row, but LMS role and active status remain the source of truth.

LMS role mapping:

| LMS Role | Support Library Role |
| --- | --- |
| `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `COORDINATOR`, `MODERATOR` | `ADMIN` |
| `INSTRUCTOR` | `MENTOR` |
| `STUDENT`, `MEMBER`, `USER`, unknown, missing | `STUDENT` |

Important access behavior:

- Google sign-in is denied if the email is not found in LMS.
- Inactive LMS accounts cannot use the app.
- Existing sessions refresh role and active status from LMS on authenticated requests.
- If an admin is demoted or deactivated in LMS, the existing session can lose admin access without waiting for a fresh login.

## 3. Admin Permissions

Admins can do everything mentors can do, plus publishing and reply override actions.

Admins can:

- Open the staff dashboard.
- Browse all active support issues.
- Create support issues.
- Edit issue details.
- Change issue status.
- Add public replies.
- Edit or delete any reply.
- Archive issues.
- Publish issues to the Student Library.
- Remove published issues from the Student Library.

Admins cannot:

- Manage staff roles inside the Support Library. Roles come from LMS.
- View archived issues through the normal active issue list after archive.
- View audit events or publication history in a current admin UI page.
- Rely on automatic PII redaction. Manual review is required.

## 4. Admin Routes And Navigation

Admins see these primary navigation links:

- `Dashboard` -> `/dashboard`
- `Issues` -> `/dashboard/issues`
- `Submit issue` -> `/dashboard/issues/new`
- `Live support` -> `/dashboard/support`
- `Support queue` -> `/dashboard/live-support`

Common admin routes:

| Route | Purpose |
| --- | --- |
| `/dashboard` | Staff overview: totals, `Waiting Now` (today's live-support joins), `Waiting today` (who is in the room and for which request), `Student requests awaiting a mentor` (student-submitted cases with no mentor, oldest first), recent unresolved issues and popular tags. Students are redirected to `/dashboard/issues`. |
| `/dashboard/issues` | Active issue list and filters. Students see the published library instead of the staff list. |
| `/dashboard/issues/new` | Create a support issue (staff form). A student sees the simplified self-service form and lands on their own request page (`/dashboard/issues/[id]?created=1`). |
| `/dashboard/issues/submitted` | Legacy confirmation route; redirects to `/dashboard/my-requests`. |
| `/dashboard/issues/[id]` | Review, reply, publish, unpublish, status update, archive. Students never reach unpublished issues. |
| `/dashboard/issues/[id]/edit` | Edit issue details. Staff only. |
| `/dashboard/support` | Staff live support room. Students are redirected to `/dashboard/my-requests` — they join from their own request page instead. |
| `/dashboard/my-requests` | A student's own requests, newest first; each row opens the request page (status, updates, live support panel). |
| `/dashboard/live-support` | Live support queue: today's student joins with the request each one brought. Staff only. |

Route access is enforced in server pages/actions. The proxy checks sign-in and active account status, while role permissions are enforced by page guards and server actions.

## 5. Find Issues For Review

Route: `/dashboard/issues`

Admins see the staff issue list titled `Support Issues`.

The list shows active issues only. Archived issues are soft-deleted and removed from normal active lists.

Each issue row can show:

- Issue title.
- Status badge.
- Problem preview.
- Student name.
- Student email.
- Tags.
- Archive/delete icon.

Important list limitation:

- The staff issue list does not clearly show publication state.
- Use the issue detail page to confirm whether an issue is currently published.

## 6. Search, Filters, Sort, And Pagination

Use the search box and advanced filters on `/dashboard/issues`.

Admin filters:

| Filter | Meaning |
| --- | --- |
| `Search` | Search issue fields and searchable reply text. |
| `Tag` | Show issues with a tag. |
| `Status` | Show issues by status. |
| `Course` | Show issues with a course slug. |
| `Batch` | Show issues with a batch number. |
| `Mentor` | Show issues assigned to an active mentor/admin. |
| `From date` | Issue created on or after this date. |
| `To date` | Issue created on or before this date. |
| `Sort by` | Change result order. |

Important filter details:

- Date filters use issue creation date, not update date or published date.
- Course and batch dropdowns are built from active issues that actually have those values.
- Mentor dropdown uses active local staff users with `MENTOR` or `ADMIN` role.
- `Reset` clears all filters.
- `ARCHIVED` exists as a status option, but normal archive is a soft delete via `deletedAt`; archived records do not appear in the active list.

Sort options:

| Sort | Meaning |
| --- | --- |
| `Newest first` | Most recently updated issues first. |
| `Oldest first` | Oldest updated issues first. |
| `Priority` | `URGENT`, `HIGH`, `NORMAL`, `LOW`, then most recently updated. |

Pagination:

- 20 issues per page.
- `Previous` and `Next` preserve filters.
- Empty result shows `No issues found.`

## 7. Open Issue Detail For Review

Route: `/dashboard/issues/[id]`

The issue detail page is the main publishing review screen.

Admins can see:

- Status badge.
- Priority label.
- `Student Library` badge if currently published.
- Issue title.
- Last updated time.
- Full problem description.
- Tags.
- Responses.
- Reply author names.
- Reply creation and edited markers.
- Video links and private image attachments.
- Course.
- Batch.
- Published date.
- Created date.
- Student snapshot with student name and email, or `General issue (no student)` when the identity was left empty.
- Manage issue panel.
- Publish or unpublish form.
- Archive danger zone.

If the `Student Library` badge is visible, the issue is currently published.

If the publish form shows `Publish to library`, the issue is currently internal.

If the publish form shows `Remove from library`, the issue is currently published.

## 8. Public Content Review Checklist

Before publishing, review every field students can read.

Student-visible issue fields:

- Issue title.
- Problem description.
- Issue-level video links (title, timestamp, hostname, summary).
- Status.
- Priority.
- Course slug.
- Batch number.
- Tags.
- Published date.
- Created date.
- Updated date.

Student-visible reply fields:

- Staff author display name.
- Reply creation time.
- `edited` marker.
- Reply body.
- Video link title.
- Video link timestamp.
- Video link hostname.
- Video link summary.

Do not publish until these fields are safe for all students who can access the Student Library.

## 9. Student PII Checklist

The app hides stored student identity fields from students, but it does not remove PII that staff typed into public text.

Before publishing, remove or generalize:

- Student name.
- Student email.
- Phone number.
- Discord/Facebook profile.
- Payment transaction ID.
- Private image attachment content.
- LMS user ID.
- Address or location.
- Passwords, tokens, OTPs, or recovery codes.
- Personal course progress details that identify one student.
- Any account-sensitive detail.

Check these public-facing areas:

- Issue title.
- Problem description.
- Issue video links.
- Reply body.
- Video link title.
- Video link summary.
- External link URL.

Good public wording:

- `Student cannot install package because npm dependency conflict occurs.`
- `React image path breaks after deployment.`

Bad public wording:

- `Rahim from batch 7 cannot pay with 01XXXXXXXXX.`
- `rahim@example.com sent this private image with payment ID...`

## 10. Video Link Review

The app stores video links and privately uploads image attachments. It does not accept PDF, ZIP, Office, or other generic file attachments.

Video link format:

```text
title|https://url|timestamp|summary
```

Important link behavior:

- A bare URL line is accepted and uses the hostname as the title.
- A missing URL scheme is prefixed with `https://`.
- Invalid link lines can be ignored and not saved.
- Up to 10 video links can be saved per issue or reply.
- Production requires HTTPS links by default.
- Optional environment configuration can restrict allowed link hosts.
- Links open in a new browser tab.

Video links can appear in two places, and both are reviewed:

- Issue-level `Video Links` — the reporter's evidence, shown under the problem description.
- Reply-level video links — part of a staff answer.

Admin review steps:

1. Confirm every expected link appears after saving.
2. Open important links to verify they work.
3. Review link titles, timestamps, summaries, and URLs for PII.
4. Remember that privately uploaded image attachments are staff-only and excluded from the public projection.

## 11. Publish To Student Library

Only admins can publish.

Publish workflow:

1. Open `/dashboard/issues/[id]`.
2. Review the issue title and problem description.
3. Review the issue-level video links and all replies and their link metadata.
4. Confirm no student personal information is present in public content.
5. In the publish form, check the confirmation checkbox.
6. Click `Publish to library`.
7. Confirm the page returns to the issue detail page.
8. Confirm the `Student Library` badge appears.

The confirmation text is:

```text
No student personal information in this issue.
```

## 11a. Publish While Solving

Marking an issue `SOLVED` can publish it in the same step, so a finished answer
does not need a second visit to the publish form.

1. Open `/dashboard/issues/[id]`.
2. Review the public content (title, problem, video links, replies) against the
   PII checklist.
3. Choose `SOLVED` in the status dropdown.
4. Check `No student personal information in this issue.`
5. Click `Save and publish`.

The write sets the status and the publication fields together. This path is
**admin-only**: a mentor choosing `SOLVED` changes the status but leaves the
issue internal for an admin to publish. If the issue is already published,
choosing `SOLVED` only updates the status and keeps its original publication
record.

Publishing sets:

- `visibility` to `PUBLISHED`.
- `publishedAt` to the publish time.
- `publishedBy` to the admin user.
- `updatedBy` to the admin user.
- Publication history event `PUBLISHED`.
- Audit event `ISSUE_PUBLISH`.

## 12. Stale Review Protection

The publish form includes the issue's current `updatedAt` value as a hidden review revision.

Publishing succeeds only if the issue still has that same `updatedAt` value when the server action runs.

If another staff member changes the issue or reply after the admin opened the page, publishing fails with:

```text
Issue changed since review. Refresh and review it again.
```

What to do:

1. Refresh the issue detail page.
2. Review the changed content again.
3. Check the PII confirmation again.
4. Click `Publish to library` again.

This protects against stale review, double-submit, and out-of-order staff changes.

## 13. Remove From Student Library

Only admins can remove a published issue from the Student Library through the publish form.

Unpublish workflow:

1. Open a published issue at `/dashboard/issues/[id]`.
2. Confirm the `Student Library` badge is visible.
3. In the manage panel, click `Remove from library`.
4. Confirm the issue returns to internal visibility.
5. Confirm the `Student Library` badge disappears.

Unpublishing sets:

- `visibility` to `INTERNAL`.
- `publishedAt` to `null`.
- `publishedBy` to `null`.
- `updatedBy` to the admin user.
- Publication history event `UNPUBLISHED`.
- Audit event `ISSUE_UNPUBLISH`.

Unpublishing applies to every published issue, including one that was published
automatically by marking it `SOLVED`.

Students can no longer open the issue after unpublish. A student opening the old detail URL gets a 404 page.

## 14. What Forces Re-review

An issue leaves the Student Library when public-facing content changes.

| Action | Student Library Effect | Reason |
| --- | --- | --- |
| Edit issue details | Becomes `INTERNAL` | Title/problem/metadata may have changed. |
| Add reply | Becomes `INTERNAL` | New public response needs review. |
| Edit reply | Becomes `INTERNAL` | Public response text changed. |
| Delete reply | Becomes `INTERNAL` | Public answer set changed. |
| Archive issue | Soft-deleted and internal | No longer active or student-visible. |
| Admin removes from library | Becomes `INTERNAL` | Manual unpublish. |
| Change status (not `SOLVED`) | Stays as-is | Status update does not force unpublish. |
| Admin marks `SOLVED` with the PII confirmation | Becomes `PUBLISHED` | Solving can publish in the same step. |

Even a small typo fix in issue details or replies removes the issue from the Student Library until admin review and publish.

## 15. Status Changes

Admins can update status from the issue detail page.

Statuses:

| Status | Meaning |
| --- | --- |
| `OPEN` | Needs work or answer. |
| `PENDING` | Waiting on follow-up or confirmation. |
| `FOLLOW_UP` | Needs additional staff action. |
| `SOLVED` | Answer is considered final. |
| `ARCHIVED` | Enum exists, but normal archive uses the archive action. |

Status dropdown behavior:

- Choosing a value saves it immediately; there is no update button. An `Updating status…` hint shows while the write is in flight.
- `ARCHIVED` is not selectable in the normal status dropdown.
- To archive, use the archive action.
- Status-only changes do not clear `publishedAt` or `publishedBy`.
- Status-only changes do not add a publication history event.
- Choosing `SOLVED` on an unpublished issue (admin only) reveals the short PII
  confirmation and a `Save and publish` button; submitting publishes the issue
  in the same write. Mentors solving an issue do not publish it.

## 16. Admin Reply Override

Replies are public responses. There are no private/internal notes in the current flow.

Admin reply permissions:

- Admins can edit any reply.
- Admins can delete any reply.
- Mentors can edit/delete only their own replies.
- Students cannot add, edit, or delete replies.

Reply edit limitation:

- The current edit form changes only the reply body.
- Video links and attachments cannot be edited through the reply edit form.
- To change a video link on an existing reply, delete the reply and add a corrected reply, or add a follow-up reply.

Any successful reply add, edit, or delete makes the issue `INTERNAL` until admin review.

## 17. Create Issue As Admin

Route: `/dashboard/issues/new`

Admins can create issues the same way mentors can.

Create form sections, in order:

- Issue Details.
- Answer (Optional).
- Student Identity (optional).
- Additional Details.

Student identity is optional: leave both name and email empty for a general issue,
or provide both together. An all-or-none rule prevents a half-recorded learner.

Student identity behavior:

- Entering an LMS email starts lookup after a short delay.
- Lookup is staff-only and read-only.
- If an LMS user is found, the student name is auto-filled.
- The lookup stores the LMS user id with the issue.
- Lookup does not write back to LMS.
- Lookup does not require the matched LMS user to have student role.
- If lookup fails, is rate-limited, or finds no match, manual name entry is allowed.

Optional first answer behavior:

- If an answer is provided during create, it becomes the first public reply.
- If `Mark as solved when an answer is provided` is checked, the issue is created as `SOLVED`.
- If the checkbox is unchecked, the issue stays `OPEN` even with an answer.
- If no answer is provided, the issue is created as `OPEN`.

New issues are internal by default. Admin review and publish are still required before students can read them.

## 18. Edit Issue As Admin

Route: `/dashboard/issues/[id]/edit`

Admins can edit:

- Student name (optional).
- Student email (optional).
- LMS user ID through LMS lookup/manual form state.
- Issue title.
- Problem description.
- Status.
- Priority.
- Course slug.
- Batch number.
- Module slug.
- Content/lesson slug.
- Tags.

Edit page behavior:

- The answer section is not shown on edit.
- Editing issue details makes the issue `INTERNAL`.
- `publishedAt` is cleared.
- `publishedBy` is cleared.
- Publication history records `CONTENT_CHANGED`.

After saving an edit, review the issue detail page again and publish only if public content is safe.

## 19. Archive Issue

Admins can archive from:

- The issue list archive/delete icon.
- The issue detail danger zone.

Issue list confirmation:

```text
Are you sure you want to delete this issue?
```

Issue detail confirmation:

```text
Archive this issue? It will disappear from active lists.
```

Archive is not a hard delete. It is a soft delete.

Archive does this:

- Sets `deletedAt`.
- Sets `deletedBy`.
- Sets `visibility` to `INTERNAL`.
- Clears `publishedAt`.
- Clears `publishedBy`.
- Records publication history as `ARCHIVED`.
- Records audit event `ISSUE_ARCHIVE`.
- Redirects to the issue list.
- Removes the issue from active staff lists.
- Removes the issue from the Student Library.

Archive only when no further staff action is needed.

## 20. What Students See

Students are `STUDENT` users.

Students see only published issues, and can submit a new issue from **Submit an issue** in the topbar. A student submission is always created as OPEN and internal, with no mentor assigned, and the student lands on a confirmation page rather than the case view.

Student issue list can show:

- Issue title.
- Status badge.
- Problem preview.
- Tags.

Student issue detail can show:

- Status badge.
- Priority label.
- `Student Library` badge.
- Issue title.
- Last updated time.
- Full problem description.
- Issue-level video links.
- Tags.
- Answers and updates.
- Reply video links.
- Course.
- Batch.
- Published date.
- Created date.

Students can search published issues by:

- Issue title.
- Problem/question text.
- Tags.
- Course slug.

Student search does not search reply body text.

## 21. What Students Never See

The public issue query selects only public fields and blanks stored student identity fields.

Students do not see:

- Internal/unpublished issues.
- Soft-archived issues.
- Student name stored in the issue identity fields.
- Student email stored in the issue identity fields.
- LMS user ID.
- Mentor filter.
- `New Issue` button.
- Edit controls.
- Reply composer.
- Publish/unpublish controls.
- Archive/delete controls.
- Staff dashboard.
- Internal audit events.
- Publication history.

Students opening an internal, unpublished, archived, deleted, invalid, or inaccessible issue URL see a 404 page.

## 22. Rate Limits And Duplicate Submit Protection

Actions are rate-limited per account.

Approximate limits per 60 seconds:

| Action | Limit |
| --- | --- |
| LMS lookup | 30 |
| Issue create | 10 |
| Issue update | 30 |
| Issue status update | 30 |
| Issue archive | 10 |
| Issue publish | 20 |
| Issue unpublish | 20 |
| Reply add | 30 |
| Reply edit | 30 |
| Reply delete | 30 |

If an action fails after repeated fast attempts, wait and retry.

Duplicate submit protection:

- Issue create and reply add use operation IDs.
- Replaying the same operation with the same payload returns the existing result.
- Reusing the same operation ID with different data is rejected.
- Pending buttons disable while action is processing.
- Publish does not use operation IDs; it uses the `updatedAt` review revision guard.

## 23. Audit And Publication History

Audited actions include:

- Issue publish.
- Issue unpublish.
- Issue archive.
- Reply create.
- Reply edit.
- Reply delete.
- Some denied operations.

Publication history events on the issue can include:

- `PUBLISHED`.
- `UNPUBLISHED`.
- `CONTENT_CHANGED`.
- `PUBLIC_REPLY_CHANGED`.
- `ARCHIVED`.

Current UI limitation:

- Audit events are stored in the `audit-events` collection.
- Publication history is stored on the support issue document.
- There is no current admin page that displays audit events or publication history.
- Use these records for backend traceability, not as a visible admin workflow today.

## 24. Troubleshooting

| Problem | What It Means | What To Do |
| --- | --- | --- |
| I cannot publish. | Current session is not `ADMIN`, account is inactive, or role changed in LMS. | Verify LMS role and active status, then sign in again if needed. |
| Publish form is missing. | You are not admin, or the issue is not available as a staff issue. | Verify role and issue URL. |
| Publish says issue changed since review. | Content changed after the page was loaded, or publish was retried with a stale revision. | Refresh, review again, check confirmation, and publish again. |
| Student Library badge disappeared after an edit. | Issue details or replies changed and the issue became `INTERNAL`. | Review content and publish again. |
| Student cannot open a published-looking issue. | It may have been unpublished, archived, deleted, or changed after publication. | Open staff detail page and check badge/form state. |
| Link did not save. | Invalid link line may have been ignored, host may be blocked, or link may violate HTTPS policy. | Re-add a valid HTTPS link and verify it appears before publishing. |
| Archived issue disappeared. | Archive soft-deletes it from active lists. | This is expected. |
| `ARCHIVED` filter shows nothing. | Archived issues are excluded by active-list query. | Treat archive as soft-delete, not normal status filtering. |
| Reply edit cannot change links. | Reply edit form currently edits body only. | Add a follow-up reply or delete/recreate the reply if appropriate. |
| Repeated action fails. | Rate limit may be hit. | Wait and retry. |

## 25. Admin Quick Reference

| Task | Admin Can Do? | Where |
| --- | --- | --- |
| View dashboard | Yes | `/dashboard` |
| View active issues | Yes | `/dashboard/issues` |
| Create issue | Yes | `/dashboard/issues/new` |
| Use LMS email lookup | Yes | Issue form |
| Add first answer during create | Yes | Issue form |
| Add public response | Yes | Issue detail |
| Edit own reply | Yes | Issue detail |
| Delete own reply | Yes | Issue detail |
| Edit another staff reply | Yes | Issue detail |
| Delete another staff reply | Yes | Issue detail |
| Change status | Yes | Issue detail |
| Edit issue details | Yes | `/dashboard/issues/[id]/edit` |
| Archive issue | Yes | Issue list/detail |
| Publish issue | Yes | Issue detail |
| Unpublish issue | Yes | Issue detail |
| View audit UI | No | Not currently available |
| Manage staff roles | No | LMS controls roles |

## 26. Glossary

| Term | Meaning |
| --- | --- |
| Support Issue | A recorded student support problem. |
| Reply / Public Response | A staff answer attached to an issue. |
| Student Library | Student-facing published issue library. |
| Internal | Staff-only visibility. |
| Published | Visible in Student Library. |
| Archive | Soft-delete from active lists and Student Library. |
| Admin | Staff role that can publish/unpublish and override reply ownership. |
| Mentor | Staff role that can create/edit/archive issues and manage own replies. |
| Student | Learner role. Can submit a new issue and read published issues; cannot edit, reply, archive or publish. |
| LMS Lookup | Read-only email lookup against Hablu Programmer LMS user database. |
| PII | Personally identifiable information such as name, email, phone, account ID, or payment details. |
| Stale Review | A publish attempt based on an older issue revision after content changed. |

## 27. Admin SOP Checklist

Before publishing:

- [ ] Open the issue detail page.
- [ ] Confirm the issue title is general and safe.
- [ ] Confirm the problem description contains no PII.
- [ ] Review the issue-level video links (title, timestamp, summary, hostname, URL).
- [ ] Review every reply body.
- [ ] Review every video link title, timestamp, summary, hostname, and URL.
- [ ] Confirm expected links actually saved and open correctly.
- [ ] Confirm no passwords, tokens, OTPs, payment IDs, phone numbers, names, emails, or private image attachments are visible.
- [ ] Confirm status is appropriate for students.
- [ ] Check the PII confirmation box.
- [ ] Click `Publish to library`.
- [ ] Confirm the `Student Library` badge appears.

Before unpublishing:

- [ ] Confirm the issue should no longer be visible to students.
- [ ] Click `Remove from library`.
- [ ] Confirm the `Student Library` badge disappears.

Before archiving:

- [ ] Confirm no further staff action is needed.
- [ ] Confirm removing it from active staff lists is intended.
- [ ] Remember archived issues disappear from the Student Library.
