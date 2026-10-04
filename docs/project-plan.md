# Hablu Support Library - Project Plan

## Purpose

Hablu Programmer already has a live support center where students join support sessions and bring programming problems. Every day the team creates valuable answers, examples, files, and explanations, but those solutions are not stored in a structured way.

Hablu Support Library will store support interactions so the team can search previous problems, reuse good solutions, understand repeated student blockers, and eventually expose selected solutions to students.

## Confirmed Requirements

- Store student identity using whatever is available: student ID, name, email, phone, or LMS user reference.
- Store the student's question or problem.
- Store the answer in multiple forms: text, file, screenshot, code sample, and video link.
- Support daily support-center usage by mentors or support agents.
- Make previous problems and answers searchable.
- Keep reusable solutions separate from individual student cases.

## Product Shape

The system should have two connected parts.

### 1. Support Case

A support case is a specific student's specific problem.

Example:

```text
Student: HP-12345 - Rahim
Course: Full Stack Web Development
Batch: 8
Problem: React useEffect keeps calling API again and again
Status: Solved
Solved by: Mentor A
```

Support cases preserve the real support history, including follow-ups, files, and mentor notes.

### 2. Solution Article

A solution article is a reusable answer created from one or more support cases.

Example:

```text
Title: React useEffect infinite loop কেন হয় এবং কীভাবে ঠিক করবেন
Tags: React, useEffect, API, infinite-loop
Summary: Dependency array-তে unstable object/function দিলে বারবার render হয়।
```

One solution article can be linked to many support cases.

## MVP Workflow

The first version should focus on support-team speed, not student self-service.

```text
Student joins support
    -> Mentor searches by student ID/name/email
    -> Mentor creates a quick support case
    -> Mentor adds problem title and details
    -> Mentor searches previous solutions
    -> Mentor links an existing solution or writes a new answer
    -> Mentor adds files/video links if needed
    -> Mentor marks case as solved, pending, or follow-up
```

## MVP Screens

### Quick Add Case

Fast form for live support sessions.

Required fields:

- Student identifier or name
- Problem title
- Problem details
- Status

Recommended optional fields:

- Course
- Batch
- Module or lesson
- Tags
- Answer text
- File attachments
- Video links

### Support Cases

List and search support cases.

Filters:

- Status
- Course
- Batch
- Topic/tag
- Mentor
- Date range

### Case Details

Show the full history of one student's problem.

Content:

- Student information
- Problem details
- Replies and follow-ups
- Attachments
- Video links
- Linked solution articles
- Internal mentor notes

### Student History

Show all support cases for a student.

Useful for identifying repeat blockers and context from previous sessions.

### Solution Library

Searchable reusable answers.

Content:

- Title
- Summary
- Step-by-step answer
- Related files
- Video links
- Tags
- Linked support cases
- Visibility: internal or public

## Proposed Data Model

This is a product-level model, not a final database schema.

### Student Reference

Fields:

- `id`
- `lmsUserId` optional
- `studentId` optional
- `name`
- `email` optional
- `phone` optional
- `metadata` optional

Notes:

- Student name alone should not be treated as a unique identity.
- If an LMS user exists, cases should link to that user.
- If only name/contact is available, create a temporary student reference and merge later if needed.

### Support Case

Fields:

- `id`
- `studentRefId`
- `title`
- `question`
- `courseSlug` optional
- `batchNo` optional
- `moduleSlug` optional
- `contentSlug` optional
- `status`: `open`, `solved`, `pending`, `follow_up`, `archived`
- `priority` optional
- `tags`
- `mentorId` optional
- `createdAt`
- `updatedAt`

### Support Reply

Fields:

- `id`
- `caseId`
- `authorId`
- `body`
- `isInternalNote`
- `createdAt`

### Support Attachment

Fields:

- `id`
- `caseId` optional
- `replyId` optional
- `solutionArticleId` optional
- `fileName`
- `mimeType`
- `size`
- `storageKey`
- `url`

### Support Video Link

Fields:

- `id`
- `caseId` optional
- `replyId` optional
- `solutionArticleId` optional
- `title`
- `url`
- `timestamp` optional
- `summary` optional

### Solution Article

Fields:

- `id`
- `title`
- `slug`
- `summary`
- `body`
- `tags`
- `visibility`: `internal`, `public`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

### Case To Solution Link

Fields:

- `caseId`
- `solutionArticleId`
- `linkedBy`
- `createdAt`

## Search Requirements

The support team needs practical search across Bangla, English, and Banglish.

Search should cover:

- Problem title
- Question details
- Answer text
- Solution article body
- Tags
- Student ID/name/email
- Error messages
- Course and batch

Important examples:

- `image show hocche na`
- `ছবি দেখাচ্ছে না`
- `image not rendering`
- `useEffect api call loop`

Video links should include text summaries because the URL alone is not searchable enough.

## MVP Acceptance Criteria

- A mentor can create a support case in under one minute during live support.
- A mentor can attach text, file references, and video links to the same case.
- A mentor can search older cases by student, topic, error text, course, or batch.
- A mentor can create a reusable solution article from a support case.
- A support case can link to one or more solution articles.
- Student-specific data stays internal by default.

## Future Features

These are not MVP requirements.

- Student self-service portal.
- Public knowledge base for common problems.
- Similar problem suggestions while creating a case.
- AI-assisted search and answer drafting.
- Zoom recording transcript import.
- Analytics: repeated problems by course, batch, topic, or lesson.
- Mentor workload and response-time reports.
- Feedback rating for solved cases.

## Open Decisions

- Will students create tickets themselves, or only mentors?
- Should this be a standalone app or part of the existing Hablu Programmer LMS?
- Should files be uploaded into our storage or stored as external links first?
- What is the first target search technology: database text search, external search engine, or AI-assisted search?
- Should selected solution articles become public for students?
- Do we trial Frappe Helpdesk/Zammad before building custom?

## Recommended Next Step

Run a short operational trial using 100-200 real support records. Track how mentors actually write questions, answers, tags, files, and video links. Use the result to finalize the schema and decide whether to customize an open-source helpdesk or build a custom Hablu-specific product.
