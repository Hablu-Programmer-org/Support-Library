# Full Build Plan - Hablu Support Library

## Current Decisions

| Area | Decision |
|---|---|
| Database | MongoDB |
| App type | Standalone app first, LMS integration later |
| MVP users | Staff, mentor, admin |
| Student self-service | Deferred |
| File upload | Deferred todo |
| MVP file support | External file links only |
| Video support | External video links only |
| Build method | Feature-by-feature |
| Verification | Lint, typecheck, tests, build, and smoke test after each feature |

## Recommended Stack

| Layer | Recommended choice | Reason |
|---|---|---|
| Framework | Next.js App Router | Fast full-stack product build with React UI and server actions/API routes |
| Language | TypeScript strict | Safer product iteration and clearer domain models |
| Database | MongoDB | Flexible support-case data, tags, metadata, replies, and links |
| ODM | Mongoose | MongoDB-native schema and indexes; better fit than relational modeling for this MVP |
| Auth | Auth.js / NextAuth | Staff login, role-based access, optional Google login later |
| Auth DB adapter | Auth.js MongoDB adapter or custom user/session model | MongoDB adapter exists, but connection lifecycle must be managed explicitly |
| UI | shadcn/ui + Tailwind CSS | Open-code components, easy customization, good admin dashboard fit |
| Forms | React Hook Form + Zod | Fast form UX and shared validation |
| Testing | Vitest + Testing Library + Playwright | Unit/component tests plus critical user-flow smoke tests |
| File storage | Deferred: Cloudflare R2 | R2 has a useful free tier, but upload/security work should not block MVP |
| Search MVP | MongoDB indexes + controlled regex/text search | Good enough for first usable version |
| Search later | MongoDB Atlas Search, Meilisearch, or Typesense | Better Bangla/Banglish relevance and typo tolerance |

## Why MongoDB Is Acceptable Here

Support Library data is flexible:

- Some students will have LMS user IDs, some only names.
- Some cases will include course/batch/module, some will not.
- Replies can include text, external file links, video links, internal notes, and metadata.
- Solution articles need tags, visibility, links, and linked support cases.

MongoDB handles this shape well if we still enforce application-level validation and indexes.

## Important Technical Findings

### Mongoose And Next.js

Mongoose works with Next.js, but runtime must stay on Node.js. Do not use Edge runtime for database-backed routes because MongoDB Node driver depends on Node networking APIs.

Implementation notes:

- Use a shared `dbConnect()` helper.
- Register models with `mongoose.models.ModelName || mongoose.model(...)` to avoid hot-reload model overwrite errors.
- Use `.lean()` for server-rendered reads when possible.
- Keep `export const runtime = "nodejs"` on routes/pages that directly use Mongoose if needed.

### Auth.js MongoDB Adapter

Auth.js has a MongoDB adapter, but the adapter does not manage database connections automatically. We must pass a connected `MongoClient` or manage a shared client helper. If this conflicts with Mongoose, choose one of these approaches:

1. Auth.js MongoDB adapter with native `mongodb` client for auth collections, plus Mongoose for product collections.
2. Credentials/Google login with custom `User` and session logic in Mongoose.

Recommendation for MVP: start with Auth.js and MongoDB adapter if login requirements are simple. If role handling becomes custom-heavy, keep Auth.js for providers but control app roles in our own `UserProfile` collection.

### MongoDB Text Search Gap

MongoDB text indexes are useful, but they have important limits:

- One text index per collection.
- Index can include multiple fields, but search quality is basic.
- Text indexes store words, not semantic meaning or phrase proximity.
- Bangla/Banglish relevance may be weak.
- Text indexes add write overhead.

MVP search should be practical, not overpromised:

- Use exact filters for `studentId`, `email`, `courseSlug`, `batchNo`, `status`, `tags`.
- Use text/regex search for `title`, `question`, `reply.body`, `solution.body`.
- Store normalized helper fields such as `searchText`, `normalizedTags`, and maybe `banglishKeywords` later.

Phase 2 search options:

- MongoDB Atlas Search if using Atlas.
- Meilisearch or Typesense if we need independent, typo-tolerant search.
- AI semantic search later, only after enough high-quality solution articles exist.

### File Upload Deferred

Cloudflare R2 has a free tier, but uploading files safely is not just storage. It needs:

- Upload API or presigned URLs.
- File size limits.
- Allowed MIME types.
- Private access control.
- Signed download URLs.
- Delete lifecycle.
- Storage usage tracking.
- Abuse/malware considerations.

Therefore MVP stores external file links only.

Allowed MVP examples:

- Google Drive link
- GitHub gist/repo link
- CodeSandbox/StackBlitz link
- Cloudinary link
- Screenshot URL
- Existing LMS/resource URL

### R2 Free Tier Note

Cloudflare R2 Standard storage currently includes a monthly free tier:

- 10 GB-month storage
- 1 million Class A operations
- 10 million Class B operations
- Free egress

R2 should be added after the core support workflow is proven.

## MVP Scope

MVP includes staff-side support logging and solution reuse.

Included:

- Staff login and roles.
- Student reference create/search.
- Support case create/list/detail.
- Replies and internal notes.
- Status updates.
- External file links.
- External video links.
- Solution article create/search.
- Link support cases to solution articles.
- Search and filters.

Excluded from MVP:

- File upload.
- Student portal.
- Public knowledge base.
- AI search or AI answer generation.
- Zoom transcript import.
- Email ticketing.
- SLA automation.

## Roles And Permissions

### Admin

- Manage users and roles.
- Create/edit/delete all support cases and solutions.
- View analytics.
- Configure system settings.

### Mentor

- Create and update students.
- Create and update support cases.
- Add replies, notes, file links, and video links.
- Create/edit solution articles.
- Link solution articles to cases.

### Viewer

- Read support cases and solution articles.
- No mutation access.

### Future Student Role

Deferred. Students should only see public solution articles and their own cases if student portal is later enabled.

## Data Model

This is the planned Mongoose-level model shape.

### User

```ts
type UserRole = "ADMIN" | "MENTOR" | "VIEWER";

type User = {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `email` unique
- `role`
- `isActive`

### StudentRef

```ts
type StudentRef = {
  _id: ObjectId;
  lmsUserId?: string;
  studentId?: string;
  name: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  searchText: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `studentId` sparse
- `email` sparse
- `phone` sparse
- `lmsUserId` sparse
- `searchText`

Rules:

- Do not use `name` as a unique identifier.
- Allow duplicate names.
- Merge flow can be added later if duplicate student records become a problem.

### SupportCase

```ts
type SupportCaseStatus = "OPEN" | "SOLVED" | "PENDING" | "FOLLOW_UP" | "ARCHIVED";

type SupportCase = {
  _id: ObjectId;
  studentRefId: ObjectId;
  title: string;
  question: string;
  courseSlug?: string;
  batchNo?: number;
  moduleSlug?: string;
  contentSlug?: string;
  status: SupportCaseStatus;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  tags: string[];
  linkedSolutionIds: ObjectId[];
  mentorId?: ObjectId;
  searchText: string;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `studentRefId`
- `status`
- `courseSlug`, `batchNo`
- `tags`
- `mentorId`
- `createdAt`
- `searchText`

### SupportReply

```ts
type ExternalFileLink = {
  title: string;
  url: string;
  type?: string;
  note?: string;
};

type VideoLink = {
  title: string;
  url: string;
  timestamp?: string;
  summary?: string;
};

type SupportReply = {
  _id: ObjectId;
  caseId: ObjectId;
  authorId: ObjectId;
  body: string;
  isInternalNote: boolean;
  fileLinks: ExternalFileLink[];
  videoLinks: VideoLink[];
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `caseId`, `createdAt`
- `authorId`
- `isInternalNote`

### SolutionArticle

```ts
type SolutionVisibility = "INTERNAL" | "PUBLIC";

type SolutionArticle = {
  _id: ObjectId;
  title: string;
  slug: string;
  summary: string;
  body: string;
  tags: string[];
  visibility: SolutionVisibility;
  fileLinks: ExternalFileLink[];
  videoLinks: VideoLink[];
  linkedCaseIds: ObjectId[];
  searchText: string;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `slug` unique
- `visibility`
- `tags`
- `createdBy`
- `searchText`

## Feature Roadmap

### Phase 0 - Foundation

Build:

- Next.js app scaffold.
- TypeScript strict.
- Tailwind and shadcn/ui setup.
- MongoDB connection helper.
- Mongoose base setup.
- ESLint, Prettier if needed.
- Vitest and Playwright setup.
- Environment example.

Acceptance:

- App boots locally.
- MongoDB connection works.
- `lint`, `typecheck`, `test`, and `build` scripts exist.
- Smoke page loads.

### Phase 1 - Auth And Roles

Build:

- Login.
- Logout.
- Session handling.
- User roles: Admin, Mentor, Viewer.
- Protected dashboard.
- Role middleware/helper.

Acceptance:

- Unauthenticated user cannot access dashboard.
- Inactive user cannot access dashboard.
- Viewer cannot mutate data.

### Phase 2 - Student References

Build:

- Create student reference.
- Search student by ID, name, email, phone.
- Student detail page.
- Student support history placeholder.

Acceptance:

- Mentor can create/select a student quickly.
- Duplicate names are allowed.
- Student ID/email/phone are searchable.

### Phase 3 - Support Cases

Build:

- Quick Add Case form.
- Case list.
- Case detail page.
- Status update.
- Tags.
- Course/batch/module/content optional fields.

Acceptance:

- Mentor can create a case in under one minute.
- Case appears in list.
- Case detail opens correctly.
- Filters by status, course, batch, and tag work.

### Phase 4 - Replies And Internal Notes

Build:

- Add reply/answer.
- Add internal note.
- Timeline view.
- Edit/delete policy for own replies if needed.

Acceptance:

- Public answer and internal note are visually distinct.
- Internal note never appears in future public/student output.
- Case timeline is ordered correctly.

### Phase 5 - External Links

Build:

- Add external file links to replies.
- Add video links to replies.
- Add timestamp/summary for video links.
- Basic URL validation.

Acceptance:

- Google Drive, GitHub, YouTube, Zoom/Loom, and generic HTTPS links can be saved.
- Invalid URLs are rejected.
- Links show clearly on case detail.

### Phase 6 - Solution Library

Build:

- Create/edit solution article.
- Solution article list.
- Solution article detail.
- Tags and visibility.
- External file/video links on articles.

Acceptance:

- Mentor can create reusable solution article.
- Article visibility can be internal/public.
- Public visibility does not expose student-specific case data.

### Phase 7 - Case-Solution Linking

Build:

- Link existing solution to case.
- Create solution from case answer.
- Show linked cases on article.
- Show linked articles on case.

Acceptance:

- One solution can link to many cases.
- One case can link to many solutions.
- Creating article from case requires manual cleanup before public visibility.

### Phase 8 - Search And Filters

Build:

- Search cases by student, title, question, reply body, tags, course, batch, status.
- Search solution articles by title, summary, body, tags.
- Basic normalized search field.

Acceptance:

- Repeated problems can be found quickly.
- Manual test examples include Bangla, English, and Banglish.
- Search result page is fast enough for MVP data volume.

### Phase 9 - Basic Analytics

Build:

- Common tags.
- Case count by course/batch.
- Status counts.
- Mentor activity counts.
- Recent unresolved cases.

Acceptance:

- Team can identify repeated blockers.
- Dashboard is read-only and role-protected.

### Phase 10 - R2 File Upload Todo

Deferred until MVP workflow is validated.

Build later:

- Cloudflare R2 bucket setup.
- Presigned upload flow.
- File type and size validation.
- Private file access.
- Signed downloads.
- Delete lifecycle.
- Usage tracking.

## Verification Plan

Every feature should be completed through this gate:

```text
Implement feature
-> run lint
-> run typecheck
-> run unit/component tests
-> run relevant Playwright smoke test
-> run production build
-> manual smoke test
-> update docs if behavior changed
```

Minimum scripts:

```json
{
  "lint": "next lint or eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "build": "next build"
}
```

Critical smoke flows:

1. Login.
2. Create student.
3. Create support case.
4. Add reply.
5. Add internal note.
6. Add external file link.
7. Add video link.
8. Create solution article.
9. Link solution to case.
10. Search case.
11. Search solution.

## Security And Privacy Requirements

- All dashboard routes must require authentication.
- All mutations must enforce role checks server-side.
- Student-specific support cases are internal by default.
- Public solution articles must not automatically include student identity or private notes.
- External links should use HTTPS unless explicitly allowed by admin.
- Do not expose raw MongoDB IDs unnecessarily in public URLs if student portal is later added.
- Add audit fields: `createdBy`, `updatedBy`, timestamps.
- Deleting records should be soft-delete or archived for support history unless admin hard-delete is explicitly needed.

## Known Gaps And Mitigations

| Gap | Risk | Mitigation |
|---|---|---|
| Bangla/Banglish search quality | Mentors may not find old solutions | Start with tags and normalized fields; later add Atlas Search/Meilisearch/Typesense |
| External file links can break | Old support records may lose files | Store title/note/source; later migrate important files to R2 |
| Student identity may be duplicated | Same student has multiple records | Use student ID/email/phone search; add merge tool later |
| Auth integration with current LMS unknown | Separate login friction | Start standalone; later add SSO or LMS token bridge |
| Mongoose with serverless can create connection issues | Runtime instability | Use shared connection helper and Node runtime only |
| Public article leakage | Student PII could appear in reusable solutions | Default articles to internal; require manual public publish review |
| File upload postponed | Some mentors may want direct upload | MVP supports external links; R2 is a tracked Phase 10 todo |

## Open Questions Before Coding

- UI library final: shadcn/ui or HeroUI?
- Auth provider: Google login, credentials login, or both?
- Deployment target: VPS, Vercel, or another platform?
- MongoDB target: existing Atlas project or new database?
- Domain/subdomain: what will be used for the standalone app?
- Will the first users be manually seeded admins/mentors?
- Should cases support Bengali UI labels from day one?

## Recommended First Development Task

Start with Phase 0 and Phase 1 only:

1. Scaffold Next.js app.
2. Add MongoDB/Mongoose connection.
3. Add Auth.js login.
4. Add role-protected dashboard shell.
5. Add lint/typecheck/test/build pipeline.

Do not start support-case feature until the foundation build passes.
