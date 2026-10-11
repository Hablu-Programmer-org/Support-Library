# Student Guide — Hablu Support Library

This guide explains how students use the Hablu Support Library, what they can read, what they can search, and what actions are not available to students.

The Support Library is a read-only library of published support issues and reviewed answers. It is not a live chat system and it is not a student ticket submission portal.

## 1. What The Support Library Is

The Support Library helps students find answers that the Hablu Programmer support team has already reviewed and published.

You can use it to:

- Browse published support issues.
- Search for a known problem or keyword.
- Filter solutions by status, tag, course, batch, and date.
- Read the problem statement and the support team's answer.
- Open attached file links or video walkthrough links.

You cannot use it to create a new support request. If your problem is not already published in the library, contact the Hablu support team through the official support channel provided in your LMS/course community.

## 2. Who Can Use It

Only Hablu Programmer LMS members can sign in.

You must use the same Google email that exists in the Hablu Programmer LMS. If your Google email is not found in the LMS, sign-in is denied.

Student access is called the `VIEWER` role inside this app. LMS roles such as `STUDENT`, `USER`, unknown roles, or missing roles are treated as `VIEWER`.

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

- A search box for published solutions.
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

Some answers include external file or video links.

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

Students cannot:

- Open the staff dashboard.
- Create a new issue.
- Edit an issue.
- Archive or delete an issue.
- Publish or unpublish an issue.
- Change an issue status.
- Add a reply.
- Edit a reply.
- Delete a reply.
- Use the mentor filter.
- See internal/unpublished issues.
- See student personal information saved on support issues.

If you try to open a staff-only page, you may be redirected to `/unauthorized`.

## 14. Privacy: What Students Will Not See

The student library hides private student fields.

Students do not see:

- Student name from the original support issue.
- Student email from the original support issue.
- LMS user ID.
- Internal staff-only controls.
- Internal/unpublished issues.

Public issue data includes only the reviewed fields needed for the library, such as title, problem, status, priority, course, batch, tags, visibility, and dates.

Staff must review an issue before publishing it to the student library.

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
| I need to submit a new problem. | This app does not support student-created tickets. Use the official Hablu support channel. |

## 18. Quick Reference

| Action | Available To Students? | Where |
| --- | --- | --- |
| Sign in with Google | Yes | `/login` |
| Search published issues | Yes | `/` and `/dashboard/issues` |
| Browse published issues | Yes | `/dashboard/issues` |
| Filter by tag/status/course/batch/date | Yes | `/dashboard/issues` |
| Sort by newest/oldest/priority | Yes | `/dashboard/issues` |
| Read issue details | Yes, published only | `/dashboard/issues/[id]` |
| Open file/video links | Yes | Issue detail replies |
| Toggle theme | Yes | Topbar/account menu |
| Sign out | Yes | Topbar/account menu |
| Create issue | No | Staff only |
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
| VIEWER | The app role used for students/read-only users. |
| Status | The support state, such as Open, Solved, Pending, or Follow-up. |
| Priority | Staff-set importance, such as Low, Normal, High, or Urgent. |
| Tag | A keyword used to group or filter issues. |
| Course slug | A short course identifier used for filtering. |
| Batch | A course batch number used for filtering. |

## 20. Important Reminder

The Support Library is for reading published, reviewed support answers. It does not replace official support channels. If your problem is personal, private, payment-related, account-related, or not already published, contact Hablu Programmer support through the official channel provided for your course.
