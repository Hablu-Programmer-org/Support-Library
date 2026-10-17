# Mentor Guide — Hablu Support Library

This guide explains how mentors use the Hablu Support Library to record student support issues, write reviewed answers, organize issues, and prepare content for the Student Library.

The Support Library is a staff-first support knowledge base. Mentors create and maintain support issues. Admins publish reviewed issues to students.

## 1. What Mentors Can Do

Mentors can:

- Open the staff dashboard.
- Browse all active support issues.
- Search and filter support issues.
- Create support issues for students.
- Use LMS email lookup to fill student identity.
- Add an optional first answer while creating an issue.
- Add public responses to existing issues.
- Edit or delete their own replies.
- Change issue status.
- Edit issue details.
- Archive issues.
- Prepare public-safe content for admin review.

Mentors cannot:

- Publish an issue to the Student Library.
- Remove a published issue from the Student Library through the publish form.
- Edit or delete replies written by another mentor or admin.
- Manage staff roles.
- Create private/internal notes. Current replies are public responses.

## 2. Sign In And LMS Role Access

Route: `/login`

Mentors sign in with Google.

Access is controlled by the main Hablu Programmer LMS database. The Support Library keeps a local user row, but the LMS remains the source of truth for role and active status.

LMS role mapping:

| LMS Role | Support Library Role |
| --- | --- |
| `INSTRUCTOR` | `MENTOR` |
| `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `COORDINATOR`, `MODERATOR` | `ADMIN` |
| `STUDENT`, `MEMBER`, `USER`, unknown, missing | `STUDENT` |

Important access behavior:

- If the LMS account is inactive, access is blocked.
- If the LMS role is changed from staff to student, an existing session can lose mentor access.
- If sign-in fails because the email is missing from LMS, use the correct LMS-linked Google email.

## 3. Navigation And Account Menu

Mentors see these primary navigation links:

- `Dashboard` -> `/dashboard`
- `Issues` -> `/dashboard/issues`

Desktop topbar includes:

- Brand link.
- Dashboard and Issues navigation.
- Theme toggle.
- User menu with name, email, role.
- Sign out button.

Mobile topbar includes:

- Brand and navigation.
- Account menu button.

Mobile account sheet includes:

- Name.
- Email.
- Role.
- Theme toggle.
- Sign out button.

The mobile account sheet intentionally does not contain navigation links.

## 4. Dashboard Overview

Route: `/dashboard`

Mentors can access the dashboard. Students cannot; students are redirected to the Student Support Library.

Dashboard cards:

| Card | Meaning |
| --- | --- |
| `Support Issues` | Total active support issues. |
| `Unresolved` | Issues with `OPEN`, `PENDING`, or `FOLLOW_UP` status. |
| `Issues This Week` | Issues created in the last 7 days. |

Dashboard sections:

- `Recent Unresolved Issues`: up to 8 recently updated unresolved issues.
- `Popular Tags`: top tags linked to the issue list with tag filter applied.

Use the dashboard for quick monitoring. Use the Issues page for detailed searching and work.

## 5. Support Issues List

Route: `/dashboard/issues`

Mentors see the staff issue list titled `Support Issues`.

Each issue row can show:

- Issue title.
- Status badge.
- Problem preview.
- Student name.
- Student email.
- Tags.
- Archive/delete icon.

Mentors also see the `New Issue` button.

The list shows active issues only. Archived issues are soft-deleted and removed from active lists.

## 6. Search, Filters, Sort, And Pagination

Use the search box and advanced filters on `/dashboard/issues`.

Mentor filters:

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

## 7. Mentor Search vs Student Search

Mentor search is broader than student search.

Mentor search can include:

- Issue title.
- Problem/question.
- Student name.
- Student email.
- Course slug.
- Module slug.
- Content/lesson slug.
- Tags.
- Reply body text after replies exist.

Student search is narrower and does not search student PII or reply body text.

Do not copy student PII into public fields just to make search easier. Student name/email are staff-only context and must stay out of public title, problem description, and replies.

## 8. Create A Support Issue

Route: `/dashboard/issues/new`

Click `New Issue` from the issue list.

The create page has these main sections:

- Student Identity.
- Issue Details.
- Answer (Optional).
- Additional Details.

Quick tips shown in the UI:

- Enter student email first to auto-fill name from LMS.
- Title must be at least 5 characters.
- Add an answer to resolve the issue immediately.
- Use `Cmd+Enter` or `Ctrl+Enter` to submit quickly.

After successful creation, the app redirects to the new issue detail page.

## 9. Student Identity And LMS Autofill

Required fields:

- `Student Name`
- `Student Email`

Recommended workflow:

1. Enter the student's LMS email first.
2. Wait for LMS lookup.
3. If the LMS user is found, the name is auto-filled.
4. If no match is found, enter the name manually.

LMS lookup behavior:

- Lookup starts when the email has at least 5 characters.
- Lookup is delayed briefly while typing.
- It first checks exact normalized email.
- It then falls back to case-insensitive email match.
- If found, `Found in LMS` appears.
- If found and the name was not manually edited, the name field becomes disabled and submits through a hidden field.
- If not found, the form shows `No matching LMS user found. Enter the name manually.`

Manual name is allowed after an LMS lookup miss.

## 10. Issue Field Rules And Validation

Required issue fields:

| Field | Rule |
| --- | --- |
| Student name | 2-120 characters. |
| Student email | Valid email, max 160 characters, stored lowercased. |
| Issue title | 5-200 characters. |
| Problem description | 5-20,000 characters. |

Optional metadata:

| Field | Rule |
| --- | --- |
| Course slug | Lowercase slug, hyphen format, max 120. |
| Batch no | Integer from 1 to 9999. |
| Module slug | Lowercase slug, hyphen format, max 120. |
| Content/Lesson slug | Lowercase slug, hyphen format, max 120. |
| Tags | Max 10 tags, lowercase, unique, max 32 each. |
| Priority | Low, Normal, High, Urgent. |

Allowed tag characters:

```text
a-z, 0-9, +, #, ., -
```

Tags are normalized to lowercase and duplicates are removed.

## 11. Write A Good Issue Title And Problem Description

Good title:

- Short but specific.
- No student name, email, phone, ID, payment ID, or private information.
- Mentions the technical problem or support topic.

Good problem description:

- Describes what the student asked.
- Includes relevant error text if safe.
- Removes private details.
- Uses general language so the answer can help other students later.

Examples:

| Better | Avoid |
| --- | --- |
| `React image not rendering after deployment` | `Rahim cannot load his image` |
| `GitHub push rejected by remote origin` | `Student email rahim@example.com push issue` |
| `Payment screenshot link is invalid` | `Bkash transaction 01XXXXXXXXX issue` |

## 12. Initial Answer During Issue Creation

The create form includes `Answer (Optional)`.

You can add:

- Answer body.
- File links.
- Video links.
- Solve checkbox.

Behavior:

- If you add an answer and keep `Mark as solved when an answer is provided` checked, the issue is created as `SOLVED`.
- If you add an answer but uncheck the solve checkbox, the issue is created as `OPEN`.
- If you do not add an answer, the issue is created as `OPEN`.
- If you add only file/video links and no answer body, the app saves this fallback answer: `See the attached file or video links for the answer.`

Use the solve checkbox only when the answer is final enough that no follow-up is expected.

## 13. Initial Answer vs Later Public Response

Initial answer during creation and later public responses are not exactly the same.

| Behavior | Initial Answer | Later Public Response |
| --- | --- | --- |
| Body required | No, if links exist | Yes |
| Attachment-only answer | Allowed | Not allowed |
| File/video links | Allowed | Allowed |
| Can set issue solved immediately | Yes, with solve checkbox | No, update status separately |
| Creates a reply | Yes | Yes |

If you need to add a later response, write a body first, then optionally add links.

## 14. File And Video Link Formats

File links format:

```text
title|https://url|type|note
```

Video links format:

```text
title|https://url|timestamp|summary
```

Examples:

```text
Guide|https://example.com/fix.pdf|pdf|Step-by-step guide
Screenshot|https://example.com/fix.png|image|Annotated screenshot
Walkthrough|https://example.com/fix.mp4|01:20|Fix demonstration
```

Bare URLs are also accepted:

```text
https://example.com/fix.pdf
```

Link behavior and limits:

- One link per line.
- Missing protocol becomes `https://...`.
- Invalid/non-URL lines are ignored.
- Maximum 10 file links per reply.
- Maximum 10 video links per reply.
- Production expects HTTPS links.
- File title max 120 characters.
- File type max 40 characters.
- File note max 300 characters.
- Video title max 120 characters.
- Video timestamp max 12 characters and only digits/colon.
- Video summary max 500 characters.

Students open these links in a new browser tab.

## 15. Additional Details And Metadata

Additional Details is collapsed by default on the new issue page.

Use it to add:

- Course slug.
- Batch number.
- Module slug.
- Content/Lesson slug.
- Tags.
- Priority.

Use consistent course and tag naming. These fields power filtering and staff search.

There is no mentor assignment field in the current UI. Issues created by a mentor default to that mentor as the issue mentor.

## 16. Issue Detail Page

Route: `/dashboard/issues/[id]`

The issue detail page shows:

- Status badge.
- Priority label.
- `Student Library` badge if currently published.
- Issue title.
- Updated time.
- Full problem description.
- Tags.
- Responses.
- Issue context.
- Student snapshot.
- Manage issue panel.
- Danger zone archive panel.

Mentors can read all active issues, including internal/unpublished ones.

## 17. Student Snapshot

The `Student snapshot` panel shows:

- Student name.
- Student email.

This information is for staff context only.

Do not copy student name, email, phone, ID, payment details, or private screenshots into fields that may be published:

- Issue title.
- Problem description.
- Public replies.
- Link titles/notes/summaries.

## 18. Status Workflow

Statuses:

| Status | Use When |
| --- | --- |
| `Open` | Issue is new or needs work. |
| `Solved` | Answer is complete and no follow-up is needed. |
| `Pending` | Waiting on student, staff, or external confirmation. |
| `Follow-up` | Needs additional check or later response. |
| `Archived` | Not set from status dropdown; archive action handles this. |

Mentors can update status from the issue detail page.

The status dropdown excludes `Archived`. To archive, use the danger-zone archive action.

## 19. Add A Public Response

On the issue detail page, use `Write a public response`.

Required:

- Response body, 1-20,000 characters.

Optional:

- File links.
- Video links.

Click `Add file or video links` to open link fields.

Important:

- Responses are public-style content.
- Students can read responses only after an admin publishes the issue.
- Adding a response to a published issue removes it from the Student Library until admin review.
- Public responses should never include student PII.

## 20. Edit Or Delete Replies

Mentor reply permissions:

- Mentors can edit/delete their own replies.
- Mentors cannot edit/delete another mentor's or admin's replies.
- Admins can edit/delete any reply.

UI behavior:

- Edit/delete buttons show only when you can mutate that reply.
- Delete asks for confirmation: `Delete this reply? This cannot be undone.`
- Edit supports reply body only.

Important limitation:

- Existing file/video links cannot be edited through the reply edit UI.
- If a link is wrong, add a corrected follow-up reply or delete the reply and create a new one.

Side effects:

- Editing a reply marks it as `edited`.
- Editing/deleting a reply removes the issue from the Student Library until admin review.
- Deleted replies are soft-deleted and disappear from the timeline.

## 21. Edit Issue Details

Route: `/dashboard/issues/[id]/edit`

Mentors can edit:

- Student identity fields.
- Issue title.
- Problem description.
- Status.
- Priority.
- Course slug.
- Batch number.
- Module slug.
- Content/Lesson slug.
- Tags.

Important side effects:

- Any issue edit makes the issue `INTERNAL`.
- `publishedAt` is cleared.
- `publishedBy` is cleared.
- Publication history records `CONTENT_CHANGED`.
- Students cannot see it again until admin review and publish.

Even a small typo fix can temporarily remove a published issue from the Student Library.

## 22. Archive Issue

Mentors can archive an issue from:

- The issue list delete/archive icon.
- The issue detail danger zone.

List confirmation:

```text
Are you sure you want to delete this issue?
```

Detail confirmation:

```text
Archive this issue? It will disappear from active lists.
```

Archive is not a hard delete. It is a soft delete.

Archive does this:

- Sets `deletedAt`.
- Sets `deletedBy`.
- Makes visibility `INTERNAL`.
- Clears `publishedAt` and `publishedBy`.
- Records publication history as `ARCHIVED`.
- Records an audit event.
- Redirects to the issue list.
- Removes the issue from active staff lists.
- Removes the issue from the Student Library.

Archive only when no further staff action is needed.

## 23. Publishing Is Admin-Only

Mentors prepare content. Admins publish it.

Mentors cannot:

- See the publish form.
- Publish to Student Library.
- Remove from Student Library through the publish form.

Admins must confirm:

```text
I have reviewed this issue and confirmed no student personal information (name, email, phone, ID, etc.) is present in the title, problem description, or public replies.
```

If issue content changes after admin review, publish can fail until the admin refreshes and reviews again.

## 24. Student Privacy And PII Checklist

Before asking an admin to publish, check that public-facing fields contain no private student data.

Check these fields:

- Issue title.
- Problem description.
- Reply body.
- File link title.
- File link note.
- Video link title.
- Video link summary.

Remove or generalize:

- Student name.
- Email.
- Phone number.
- Discord/Facebook profile.
- Payment transaction ID.
- Private screenshot content.
- LMS ID.
- Address or location.
- Any account-sensitive detail.

Good public wording:

- `Student cannot install package because npm dependency conflict occurs.`
- `React image path breaks after deployment.`

Bad public wording:

- `Rahim from batch 7 cannot pay with 01XXXXXXXXX.`
- `rahim@example.com sent this screenshot with payment ID...`

## 25. What Removes An Issue From Student Library

An issue disappears from the Student Library when:

- A mentor/admin edits issue details.
- A mentor/admin adds a reply.
- A mentor/admin edits a reply.
- A mentor/admin deletes a reply.
- A mentor/admin archives the issue.
- An admin removes it from library.

Reason:

- The app changes visibility to `INTERNAL` until admin review.

This protects students from seeing unreviewed or PII-containing changes.

## 26. Rate Limits, Duplicate Submit Protection, And Audit

Actions are rate-limited per account.

Approximate limits per 60 seconds:

| Action | Limit |
| --- | --- |
| LMS lookup | 30 |
| Issue create | 10 |
| Issue update | 30 |
| Issue status update | 30 |
| Issue archive | 10 |
| Reply add | 30 |
| Reply edit | 30 |
| Reply delete | 30 |

If you perform actions too quickly and something fails, wait and retry.

Duplicate submit protection:

- Issue create and reply add use operation IDs.
- Replaying the same operation with the same payload returns the existing result.
- Reusing the same operation ID with different data is rejected.
- Pending buttons disable while action is processing.

Audited actions include:

- Issue archive.
- Reply create.
- Reply edit.
- Reply delete.
- Admin publish/unpublish.
- Some denied operations.

## 27. Mobile Usage

Mentors can use the app on mobile.

Mobile behavior:

- Topbar remains fixed.
- Dashboard/Issues navigation remains in the topbar.
- Account menu opens as a sheet.
- Account sheet shows identity, role, theme toggle, and sign out.
- Pressing `Escape` closes the account sheet on keyboard-capable devices.
- Issue detail is designed to avoid horizontal overflow on phones.

## 28. Troubleshooting

| Problem | What It Means | What To Do |
| --- | --- | --- |
| I cannot sign in. | Google email may not match LMS. | Use LMS-linked Google email. |
| I lost mentor access. | LMS role/status may have changed. | Ask admin/owner to verify LMS role and active status. |
| `/dashboard/issues/new` redirects to unauthorized. | Current session is not `MENTOR` or `ADMIN`. | Re-login or verify LMS role. |
| Student name did not auto-fill. | LMS email lookup missed or rate limit/error happened. | Enter the name manually. |
| My issue disappeared from Student Library after edit. | Editing makes issue internal. | Ask admin to review and publish again. |
| My reply edit/delete button is missing. | You are not the reply author, or you are not admin. | Add your own follow-up response if needed. |
| Link did not save. | Link was invalid, non-HTTPS in production, or over limit. | Use valid HTTPS links, one per line. |
| Archived issue is gone from list. | Archive soft-deletes active issue. | This is expected. |
| `Archived` filter shows nothing. | Archived issues are excluded by active-list query. | Archive is a separate soft-delete state. |
| Repeated action fails. | Rate limit may be hit. | Wait and retry. |

## 29. Mentor Quick Reference

| Task | Mentor Can Do? | Where |
| --- | --- | --- |
| View dashboard | Yes | `/dashboard` |
| View all active issues | Yes | `/dashboard/issues` |
| Create issue | Yes | `/dashboard/issues/new` |
| Use LMS email lookup | Yes | Issue form |
| Add first answer during create | Yes | Issue form |
| Add public response | Yes | Issue detail |
| Edit own reply | Yes | Issue detail |
| Delete own reply | Yes | Issue detail |
| Edit another staff reply | No | Admin only |
| Delete another staff reply | No | Admin only |
| Change status | Yes | Issue detail |
| Edit issue details | Yes | `/dashboard/issues/[id]/edit` |
| Archive issue | Yes | Issue list/detail |
| Publish issue | No | Admin only |
| Unpublish issue | No | Admin only |
| Manage staff roles | No | Not available to mentors |

## 30. Glossary

| Term | Meaning |
| --- | --- |
| Support Issue | A recorded student support problem. |
| Reply / Public Response | A staff answer attached to an issue. |
| Student Library | Student-facing published issue library. |
| Internal | Staff-only visibility. |
| Published | Visible in Student Library. |
| Archive | Soft-delete from active lists and Student Library. |
| Mentor | Staff role that can create/edit/archive issues and manage own replies. |
| Admin | Staff role that can also publish/unpublish and override reply ownership. |
| Student | Learner role. Can submit a new issue and read published issues; cannot edit, reply, archive or publish. |
| LMS Lookup | Read-only email lookup against Hablu Programmer LMS user database. |
| PII | Personally identifiable information such as name, email, phone, account ID, or payment details. |

## 31. Mentor SOP Checklist

Before creating or updating an issue:

- [ ] Use the student's LMS email when available.
- [ ] Keep title general and searchable.
- [ ] Remove student PII from public-facing text.
- [ ] Add course/batch/tags if useful for filtering.
- [ ] Add an answer if the fix is known.
- [ ] Mark solved only when the answer is final.
- [ ] Use valid HTTPS file/video links.
- [ ] Ask admin to publish only after public content is safe.

Before archiving:

- [ ] Confirm no further staff action is needed.
- [ ] Confirm losing the active-list record is intended.
- [ ] Remember archived issues disappear from Student Library.
