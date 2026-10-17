# Student Guide — Hablu Support Library

This guide explains how students use the Hablu Support Library, what they can read, what they can search, how to submit a support request, and what actions are not available to students.

The Support Library has two sides for a student: a library of published support issues and reviewed answers, and a short form to submit a new support request. It is not a live chat system: you submit a request, the team answers you by email, and you cannot reply inside the app.

## 1. What The Support Library Is

The Support Library helps students find answers that the Hablu Programmer support team has already reviewed and published, and lets them raise a new request when no existing answer fits.

You can use it to:

- Browse published support issues.
- Search for a known problem or keyword.
- Filter by status, tag, course, batch, and date.
- Read the problem statement and the support team's answer.
- Open attached file links or video walkthrough links.
- Submit a new support request with a title, a description, and optional file/video links.

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
- Attached file links and video links, if the reporter added any.
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
- File links.
- Video links.

If no reply exists, the page shows:

- `No responses yet`
- `A support team response will appear here.`

Students cannot add replies or edit replies.

## 11. File Links And Video Links

Issues and answers can include external file or video links. A support request can also carry its own attachment links, which appear under the problem description.

File links can show:

- Title.
- File type, if provided.
- Link host.
- Note, if provided.

Video links can show:

- Title.
- Timestamp, if provided.
- Link host.
- Summary, if provided.

When you click a file or video link:

- It opens in a new browser tab.
- It opens as an external link.
- You should check the displayed host before trusting the link.

In production, links are expected to be HTTPS links.

## 12. Account Menu, Theme, And Sign Out

The topbar is always visible inside the dashboard area.

Students see:

- Hablu Support Library brand link.
- `Issues` navigation link.
- Theme toggle.
- Account identity.
- Sign out control.

Students do not see the staff `Dashboard` navigation link.

On mobile:

- The account menu opens as a side sheet.
- The sheet shows your name, email, role label, theme toggle, and sign out button.
- Navigation links remain in the topbar, not inside the mobile account sheet.

Theme behavior:

- The default theme is dark.
- You can switch between dark and light mode.

Sign out sends you back to `/login`.

## 13. What Students Cannot Do

Students can submit a new support request and read published issues. Everything else is staff-only.

Students cannot:

- Open the staff dashboard.
- Edit an issue.
- Archive or delete an issue.
- Publish or unpublish an issue.
- Change an issue status.
- Add a reply.
- Edit a reply.
- Delete a reply.
- Choose which student an issue is filed for.
- Use the mentor filter.
- See internal/unpublished issues.
- See student personal information saved on support issues.

If you try to open a staff-only page, you may be redirected to `/unauthorized`.

## 13a. Submitting a Support Request

Open **Submit an issue** in the topbar, or press **Submit an issue** on the issues list.

The form asks for two things:

- A title: a short summary of the problem, at least 5 characters.
- Problem details: what you were doing, what you expected, and what happened instead. Include the steps to reproduce the problem if you can.

You can also add optional attachment links (the app stores links, never uploaded files):

- **Image / file links** — one per line, in the form `Title|https://link` (optionally `Title|https://link|image` or `|pdf` and a short note).
- **Video links** — one per line, in the form `Title|https://link` (optionally `Title|https://link|01:30` and a summary).

Upload the image, file, or video somewhere public first (for example Google Drive or YouTube), then paste the link. Links must be HTTPS links. If you type something that is not a usable link, the form asks you to fix it instead of silently dropping it.

Your request is filed under the email address on your Hablu Programmer LMS account, so you do not need to enter your name or email.

After you submit, a confirmation page appears and the request goes to the support team. You cannot add replies to it and you cannot see it in the library until the team reviews and publishes it; if they do not publish it, they answer you by email instead.

If you submit the same request twice, only one request is created.

## 14. Privacy: What Students Will Not See

The student library hides private student fields.

Students do not see:

- Student name from the original support issue.
- Student email from the original support issue.
- LMS user ID.
- Internal staff-only controls.
- Internal/unpublished issues.

Public issue data includes only the reviewed fields needed for the library, such as title, problem, attached file/video links, status, priority, course, batch, tags, visibility, and dates.

Staff must review an issue before publishing it to the student library. The publish confirmation covers the title, problem description, attached file/video links, and public replies.

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
| A link opens a new tab. | File and video links are external resources and are opened separately. |
| I need to submit a new problem. | Use **Submit an issue** to send a request; the team replies by email. |
| My attachment link is rejected. | Links must be HTTPS URLs. Upload the file somewhere public first, then paste the link. |

## 18. Quick Reference

| Action | Available To Students? | Where |
| --- | --- | --- |
| Sign in with Google | Yes | `/login` |
| Search published issues | Yes | `/` and `/dashboard/issues` |
| Browse published issues | Yes | `/dashboard/issues` |
| Filter by tag/status/course/batch/date | Yes | `/dashboard/issues` |
| Sort by newest/oldest/priority | Yes | `/dashboard/issues` |
| Read issue details | Yes, published only | `/dashboard/issues/[id]` |
| Open file/video links | Yes | Issue attachments and detail replies |
| Toggle theme | Yes | Topbar/account menu |
| Sign out | Yes | Topbar/account menu |
| Submit a support request | Yes | `/dashboard/issues/new` |
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
