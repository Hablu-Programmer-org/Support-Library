# Student Guide — Hablu Support Library

This guide explains how students use the Hablu Support Library, what they can read, what they can search, how to submit a support request, and what actions are not available to students.

The Support Library has two sides for a student: a library of published support issues and reviewed answers, and a short form to submit a new support request. It is not an in-app chat: you submit a request, the team answers you by email, and you cannot reply inside the app. Twice a day the team also opens a live support room on Zoom, which you can join from inside this app (section 12a).

## 1. What The Support Library Is

The Support Library helps students find answers that the Hablu Programmer support team has already reviewed and published, and lets them raise a new request when no existing answer fits.

You can use it to:

- Browse published support issues.
- Search for a known problem or keyword.
- Filter by status, tag, course, batch, and date.
- Read the problem statement and the support team's answer.
- Open attached video walkthrough links.
- Join the daily live support session on Zoom while the support room is open.
- Open `My Courses` to jump back to your courses in the Hablu Programmer LMS.
- Attach up to a few image attachments (PNG, JPEG, GIF or WebP) to a new request. Attachments are only visible to the support team, not published.
- Submit a new support request with a title, a description, and optional attachments/video links.

You cannot use it to reply, edit, archive, or publish anything. The support team answers new requests by email at the address on your LMS account.

## 2. Who Can Use It

Only Hablu Programmer LMS members can sign in.

You must use the same Google email that exists in the Hablu Programmer LMS. If your Google email is not found in the LMS, sign-in is denied.

Student access is called the `STUDENT` role inside this app. LMS roles such as `STUDENT`, `USER`, unknown roles, or missing roles are treated as `STUDENT`.

Your account must also be active in the LMS. If your LMS account is inactive, you cannot use the library.

## 3. Sign In With Google

Go to `/login` and click `Sign in with Google`.

After successful sign-in:

- Students are sent to `/dashboard` first.
- The app automatically redirects students from `/dashboard` to `/dashboard/issues`.
- This redirect is normal. Students do not have access to the staff dashboard.

Common sign-in messages:

| Message | Meaning |
| --- | --- |
| `Your email was not found in the Hablu Programmer LMS.` | The Google email is not linked to an LMS account. |
| `Your account has been deactivated.` | The LMS account is inactive. |
| `Google sign-in could not be completed. Please try again.` | Google OAuth failed or was interrupted. |

## 4. Home Page

Route: `/`

Before sign-in, the home page shows a sign-in path only. Guests do not see the library search box.

After sign-in, students can see:

- A search box for published answers.
- A `Browse issues` button.
- Feature cards explaining the support library.
- Top navigation and account controls.

The home-page search sends you to `/dashboard/issues?q=your-search-text`.

If the search box is empty or only spaces, it does nothing.

## 5. Student Support Library

Route: `/dashboard/issues`

This is the main student page.

The page title for students is `Student Support Library`.

Students see only published support issues. Internal, unpublished, deleted, or archived issues are hidden.

Each issue row can show:

- Issue title.
- Status badge.
- A short preview of the problem.
- Tags.

Students do not see:

- Student name.
- Student email.
- LMS user ID.
- Mentor filter.
- `New Issue` button.
- Delete/archive controls.

## 6. Search The Library

You can search from the home page or from the issue list page.

Search can match:

- Issue title.
- Problem/question text.
- Tags.
- Course slug.

Search does not match:

- Answer/reply body text.
- Student name.
- Student email.
- LMS user ID.
- Module slug.
- Content/lesson slug.

Important search details:

- Search is case-insensitive.
- Extra spaces are normalized.
- Search text shorter than 2 characters is ignored.
- If your keyword appears only inside the answer section, the issue may not appear in search results.

Example:

If an answer says `Use the public folder`, but the issue title/problem/tags do not contain `public folder`, searching `public folder` may not find that issue.

## 7. Use Advanced Filters

On `/dashboard/issues`, click the `Advanced filters` button beside the search box.

Students can filter by:

| Filter | What It Does |
| --- | --- |
| `Tag` | Shows issues with a matching tag. |
| `Status` | Shows issues by status, such as Open or Solved. |
| `Course` | Shows issues for a course slug. |
| `Batch` | Shows issues for a batch number. |
| `From date` | Shows issues created on or after the date. |
| `To date` | Shows issues created on or before the date. |
| `Sort by` | Changes result order. |

Students do not see the `Mentor` filter. That filter is staff-only.

The course and batch dropdowns are built from published issues that currently exist. If no published issue has a course or batch value, that value will not appear in the dropdown.

Click `Filter` to apply filters.

Click `Reset` to return to `/dashboard/issues` with no filters.

## 8. Sorting And Pagination

Students can sort by:

| Sort | Meaning |
| --- | --- |
| `Newest first` | Most recently updated issues first. |
| `Oldest first` | Oldest updated issues first. |
| `Priority` | Urgent/high priority issues first, then recent updates. |

`Newest first` uses the issue updated time, not the created time.

The list is paginated:

- Up to 20 issues are shown per page.
- The footer shows `Page X of Y · Total N`.
- `Previous` and `Next` links keep the current search/filter settings.

If no issue matches your filters, the page shows `No issues found.`

## 9. Open And Read An Issue

Route: `/dashboard/issues/[id]`

Click any issue from the list to open its detail page.

Students can open only published issues. If an issue is internal, unpublished, deleted, archived, or the link is invalid, you will see a 404 page.

The issue detail page can show:

- Status badge.
- Priority label.
- `Student Library` badge.
- Issue title.
- Last updated time.
- Full problem description.
- Video links, if the reporter added any.
- Tags.
- Answers and updates.
- Course.
- Batch.
- Published date.
- Created date.

If course or batch is missing, the page shows `Not specified`.

If a date is missing, the page shows `Not available`.

## 10. Read Answers And Updates

The answer section is called `Answers and updates` for students.

Replies are shown in chronological order, from oldest to newest.

Each reply can show:

- Staff author name, or `Staff` if the name is unavailable.
- Reply creation time.
- `edited` marker if the reply was edited.
- Reply text.
- Video links.

If no reply exists, the page shows:

- `No responses yet`
- `A support team response will appear here.`

Students cannot add replies or edit replies.

## 11. Video Links

Issues and answers can include external video links. A support request can carry its own video links, which appear under the problem description.

Video links can show:

- Title.
- Timestamp, if provided.
- Link host.
- Summary, if provided.

When you click a video link:

- It opens in a new browser tab.
- It opens as an external link.
- You should check the displayed host before trusting the link.

In production, links are expected to be HTTPS links.

## 12. Account Menu, Theme, And Sign Out

The topbar is always visible inside the dashboard area.

Students see:

- Hablu Support Library brand link.
- `Issues` navigation link.
- `Submit an issue` navigation link.
- `My requests` navigation link, which lists the requests you submitted and opens them.
- `My Courses` navigation link, which opens your courses in the Hablu Programmer LMS in a new tab. It appears only when the deployment has the LMS address configured.
- Theme toggle.
- Account identity.
- Sign out control.

Students do not see the staff `Dashboard` navigation link.

On narrow screens the navigation labels are hidden and each link shows its icon only. The link names are still announced to screen readers, so the links work the same way at every screen size.

On mobile:

- The account menu opens as a side sheet.
- The sheet shows your name, email, role label, theme toggle, and sign out button.
- Navigation links remain in the topbar, not inside the mobile account sheet.

Theme behavior:

- The default theme is dark.
- You can switch between dark and light mode.

Sign out sends you back to `/login`.

## 12a. Live Support

Live support is joined **from your own request**, not from a separate page.

Twice a day the support team opens a live support room on Zoom:

| Shift | Time (Bangladesh time) |
| --- | --- |
| `Morning shift` | 8:00 AM to 12:00 PM |
| `Night shift` | 7:30 PM to 12:00 AM |

The flow:

1. Submit a request (**Submit an issue**), or open one you already submitted from **My requests**.
2. You land on the request page. It shows the status, a six-digit reference (for example `000123`), what you wrote, your images and video links, and any update the team has written.
3. A **Live support** panel sits at the bottom of that page. During a support shift it has a `Join Zoom Meeting` button, plus the meeting ID and passcode in case you want to dial in from the Zoom app yourself.
4. Say the request reference when you join — the mentor sees the same reference in the waiting list. The reference is highlighted for you: double-click it, or tap the copy icon next to it, to copy it.

Rules that matter:

- **You need an open request to join.** If you have none, there is nothing to join from; submit one first.
- Only requests that are `Open`, `Pending` or `Follow-up` can be taken to the room. Once a request is `Solved` or `Archived`, the panel says so and offers no join button — submit a new request if the problem comes back.
- The shift and the open/closed decision follow Bangladesh time on the server, not the clock of your device.
- Each request appears in the mentor's waiting list once per shift, so a double click cannot queue you twice. Coming back in the other shift adds a separate entry.
- The page is not tied to a course, batch, or payment status — every signed-in student can use it.
- Try the course documentation and videos first. The team helps much faster when you share what you already tried.

The LMS frontend's help center also links here, to `/dashboard/issues`, with the same reminder to search first.

## 13. What Students Cannot Do

Students can submit a new support request and read published issues. Everything else is staff-only.

Students cannot:

- Open the staff dashboard.
- Edit an issue.
- Archive or delete an issue.
- Publish or unpublish an issue.
- Change an issue status.
- Add, edit or delete a reply. Replies are read-only for students, on your own request page and on published issues.
- Choose which student an issue is filed for.
- Use the mentor filter.
- See internal/unpublished issues that are not yours. You can read the requests **you** submitted, published issues, and nothing else.
- See student personal information saved on support issues.

If you try to open a staff-only page, you may be redirected to `/unauthorized`.

## 13a. Submitting a Support Request

Open **Submit an issue** in the topbar, or press **Submit an issue** on the issues list.

The form asks for two things:

- A title: a short summary of the problem, at least 5 characters.
- Problem details: what you were doing, what you expected, and what happened instead. Include the steps to reproduce the problem if you can.

You can also add optional evidence:

- **Attachments** — images only. Select PNG, JPEG, GIF or WebP files, review their local previews, and remove any unwanted selection before submitting. These are uploaded privately, visible only to the support team, and not published in the Student Library. On your request page, click an attached image to preview it in a dialog without leaving the page.
- **Video links** — one per line, in the form `Title|https://link` (optionally `Title|https://link|01:30` and a summary).

Upload a video to an HTTPS video service first, then paste its link. If you type something that is not a usable link, the form asks you to fix it instead of silently dropping it. PDF, ZIP and Office attachments are not supported.

**Additional Details** is open by default and lets you point the team at the exact place the problem happens:

- Course slug.
- Batch number.
- Module slug.
- Lesson slug.
- Tags.

Fill these in only if you know them; leaving them empty is fine. Your request always starts as `Open` with normal priority, so you do not choose a status or priority.

Your request is filed under the email address on your Hablu Programmer LMS account, so you do not need to enter your name or email. Your identity is taken from your signed-in account automatically.

After you submit, you land on **your request page**. It shows the status (`Open`), the request reference, everything you wrote, your images and video links, and a **Live support** panel you can use while the room is open. Updates the team writes appear on the same page; they also answer by email. You cannot add replies there, and other students cannot read your request unless the team publishes it to the Student Library.

If you submit the same request twice, only one request is created.

## 14. Privacy: What Students Will Not See

The student library hides private student fields.

Students do not see:

- Student name from the original support issue.
- Student email from the original support issue.
- LMS user ID.
- Internal staff-only controls.
- Internal/unpublished issues.

Public issue data includes only the reviewed fields needed for the library, such as title, problem, video links, status, priority, course, batch, tags, visibility, and dates. Private image attachments are excluded.

Staff must review an issue before publishing it to the student library. The publish confirmation covers the title, problem description, video links, and public replies.

## 15. Why A Link May Show 404

A previously working issue link may show 404 if:

- Staff unpublished the issue.
- Staff edited the issue and it needs admin review again.
- Staff added, edited, or deleted a public reply and it needs admin review again.
- Staff archived the issue.
- The issue was deleted.
- The link is incorrect or invalid.

This is expected privacy behavior. The issue will become visible again only if an admin republishes it.

## 16. Loading, Error, And Unauthorized States

Loading:

- The topbar stays visible.
- The page content shows a loading skeleton.

404:

- Shows `404`.
- Shows `This page could not be found.`
- Shows `The link may be incorrect, or the record may have been archived.`
- `Go to Dashboard` sends students back to the student library.

Unauthorized:

- Shows `Access Denied`.
- Shows `You do not have permission to view this page.`
- `Back to Dashboard` sends students back to the student library.

Unexpected error:

- Shows `Something Went Wrong`.
- Shows a generic message.
- The raw internal error is not shown to students.
- `Try Again` reloads the current section.

## 17. Common Problems And Fixes

| Problem | What To Do |
| --- | --- |
| I cannot sign in. | Make sure you are using the Google email linked to your Hablu Programmer LMS account. |
| It says my email was not found. | Your Google email is not registered in the LMS. Contact support through the official LMS/community channel. |
| `/dashboard` sends me to the issue library. | This is normal for students. Staff users see the dashboard. |
| I cannot see a known issue. | It may be unpublished, archived, edited, or not yet reviewed for the student library. |
| Search does not find an answer. | Search does not search answer/reply body text; try words from the title, problem, tag, or course slug. |
| A link opens a new tab. | Video links are external resources and are opened separately. |
| I need to submit a new problem. | Use **Submit an issue** to send a request; the team replies by email. |
| My video link is rejected. | Links must be HTTPS URLs. Upload the video to a supported service first, then paste the link. |
| The live support join button is disabled. | Either support is closed (come back 8:00 AM-12:00 PM or 7:30 PM-12:00 AM, Bangladesh time) or all of your requests are solved/archived — submit a new request. |
| The live support panel offers no join button. | Either support is closed (come back 8:00 AM-12:00 PM or 7:30 PM-12:00 AM, Bangladesh time) or the request is `Solved`/`Archived` — submit a new request. |
| I cannot find my request again. | Open **My requests** in the topbar; each row opens the request and its live support panel. |

## 18. Quick Reference

| Action | Available To Students? | Where |
| --- | --- | --- |
| Sign in with Google | Yes | `/login` |
| Search published issues | Yes | `/` and `/dashboard/issues` |
| Browse published issues | Yes | `/dashboard/issues` |
| Filter by tag/status/course/batch/date | Yes | `/dashboard/issues` |
| Sort by newest/oldest/priority | Yes | `/dashboard/issues` |
| Read issue details | Yes, published only | `/dashboard/issues/[id]` |
| Open video links | Yes | Issue details and replies |
| Toggle theme | Yes | Topbar/account menu |
| Sign out | Yes | Topbar/account menu |
| Submit a support request | Yes | `/dashboard/issues/new` |
| My requests | Yes | `/dashboard/my-requests` |
| Read one of your requests and the team's updates | Yes, your own only | `/dashboard/issues/[id]` |
| Join live support | Yes, from an unresolved request, during a support shift | The request page |
| Open `My Courses` in the LMS | Yes | Topbar, opens a new tab |
| Create an issue on behalf of a student | No | Staff only |
| Reply to issue | No | Staff only |
| Edit issue | No | Staff only |
| Publish issue | No | Admin only |
| Archive issue | No | Staff only |
| View student PII | No | Hidden from students |

## 19. Glossary

| Term | Meaning |
| --- | --- |
| Student Support Library | The student-facing list of published support issues. |
| Issue | A support problem recorded by the support team. |
| Answer/update | A staff reply attached to an issue. |
| Published issue | An issue reviewed and made visible to students. |
| Internal issue | An issue visible only to staff. |
| STUDENT | The app role used for students. Can submit a new request and read published issues. |
| Status | The support state, such as Open, Solved, Pending, or Follow-up. |
| Priority | Staff-set importance, such as Low, Normal, High, or Urgent. |
| Tag | A keyword used to group or filter issues. |
| Course slug | A short course identifier used for filtering. |
| Batch | A course batch number used for filtering. |

## 20. Important Reminder

The Support Library is for reading published, reviewed support answers. It does not replace official support channels. If your problem is personal, private, payment-related, account-related, or not already published, contact Hablu Programmer support through the official channel provided for your course.
