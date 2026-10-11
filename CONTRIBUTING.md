# Contributing to Support Library

Thank you for your interest in contributing! This document outlines the process and standards for contributing to Support Library.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your changes: `git checkout -b feature/your-feature-name`
4. **Make your changes** following the guidelines below
5. **Run verification** locally (see below)
6. **Submit a Pull Request** with a clear description

## Development Setup

```bash
# Install dependencies
npm ci

# Copy environment example
cp .env.example .env.local

# Configure .env.local with your values (see .env.example)

# Start MongoDB replica set (required for transactions)
docker run -d --name mongo-rs -p 27017:27017 mongo:8.0 --replSet rs0 --bind_ip_all
docker exec mongo-rs mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'

# Run development server
npm run dev
```

## Verification Requirements

**All changes must pass these checks before merging:**

```bash
# Run all verification steps
npm run verify

# Which runs:
npm run lint        # ESLint
npm run typecheck   # TypeScript type checking
npm run test        # Unit tests (Vitest)
npm run build       # Next.js production build

# For auth/DB/UI changes, also run:
npm run test:e2e    # Playwright E2E tests (requires MongoDB)
```

**CI will automatically run these on every PR.**

## Code Standards

### TypeScript
- Strict mode enabled — no `any` types without justification
- Use type inference where possible
- Define interfaces for complex objects
- Use Zod schemas for runtime validation

### React/Next.js
- Server Components by default, Client Components only when needed (`"use client"`)
- Use Server Actions for mutations (`"use server"`)
- Follow Next.js 15 App Router conventions
- Use `next/font` for fonts, `next/image` for images

### Styling
- Tailwind CSS 4 with CSS variables
- Dark mode via `next-themes` (class strategy)
- Mobile-first responsive design
- Use `nativeFieldClass`, `nativeSelectClass`, `nativeTextareaClass` for form inputs

### Database (MongoDB + Mongoose)
- All queries in service layer (`lib/services/`)
- Use transactions for multi-document operations
- Parameterized queries only (no raw `$where`)
- Add indexes for query patterns
- Soft delete with `deletedAt` field

### Security
- **Never** commit secrets (`.env.local` is gitignored)
- All Server Actions protected with CSRF + role guards
- Input validation via Zod on every mutation
- Rate limiting on all mutations
- Audit logging for sensitive operations
- No PII in logs or search indexes

## Testing

### Unit Tests (Vitest)
- Location: `__tests__/*.test.ts`
- Test pure functions, utilities, validation schemas
- Mock external dependencies (DB, Auth, etc.)

### E2E Tests (Playwright)
- Location: `e2e/*.spec.ts`
- Test critical user flows: auth, issue CRUD, replies, permissions
- Run against dedicated test database (`MONGODB_TEST_DB`)
- Use `storageState` for authenticated roles

### Test Database
- E2E tests use isolated database: `MONGODB_TEST_DB`
- Safety guards prevent writing to development database
- Global teardown cleans test data

## Pull Request Process

1. **Title**: Clear, descriptive (e.g., "Add rate limiting to OAuth callback")
2. **Description**: Explain the problem, solution, and any breaking changes
3. **Linked Issues**: Reference related issues (`Fixes #123`)
4. **Screenshots**: Required for UI changes
5. **Verification**: Confirm all checks pass locally
6. **Review**: At least one maintainer approval required
6. **Merge**: Squash and merge after approval

## Commit Messages

Follow conventional commits:
```
feat: add rate limiting to OAuth callback
fix: prevent CSRF on Server Actions
docs: update deployment guide for Railway
refactor: extract request context utility
test: add unit tests for search utilities
```

## Breaking Changes

- Major version bump required
- Document migration steps in release notes
- Update `.env.example` if new variables added
- Deprecate old APIs with warnings before removal

## Release Process

1. Maintainer creates release branch: `release/vX.Y.Z`
2. Update `package.json` version
3. Generate changelog
4. Tag release: `git tag -s vX.Y.Z`
5. GitHub Actions builds and publishes Docker image
6. Deploy workflow available for manual trigger

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). All contributors must adhere to it.

## Security Issues

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Questions?

- Open a GitHub Discussion for general questions
- Check existing issues/PRs before creating new ones
- Contact maintainers via GitHub for urgent matters

---

Thank you for contributing to Support Library!