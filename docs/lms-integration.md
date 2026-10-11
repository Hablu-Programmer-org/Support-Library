# LMS Integration Guide

Support Library requires read-only access to an external LMS (Learning Management System) database for user authentication and role mapping. This document describes the expected schema and integration patterns.

## Architecture Overview

```
┌─────────────────────┐     Read-only      ┌──────────────────┐
│  Support Library    │ ─────────────────► │  LMS Database    │
│  (support_library)  │   MongoDB queries  │  (hp-v2 / custom)│
└─────────────────────┘                    └──────────────────┘
        │
        ▼
┌─────────────────────┐
│  Local Cache        │
│  (staff_users)      │
└─────────────────────┘
```

- **LMS Database**: Source of truth for all user accounts (staff + students)
- **Support Library**: Caches staff users locally, looks up students on-demand
- **No writes to LMS**: Support Library never modifies the LMS database

## Required LMS Database Schema

### `User` Collection

The LMS must have a `User` collection with the following fields:

```javascript
{
  _id: ObjectId,                    // Unique identifier
  userId: String,                   // Business ID (e.g., "STU-12345")
  email: String,                    // Unique, lowercase, indexed
  name: String,                     // Full name
  role: String,                     // One of: SUPER_ADMIN, ADMIN, MANAGER, COORDINATOR, MODERATOR, INSTRUCTOR, MEMBER, STUDENT, USER
  image: String | null,             // Profile image URL
  isActive: Boolean,                // Account status (default: true)
  emailVerified: Date | null,       // Email verification timestamp
  createdAt: Date,
  updatedAt: Date
}
```

### Required Indexes

```javascript
// Unique email for lookups
db.User.createIndex({ email: 1 }, { unique: true })

// Optional: for role-based queries
db.User.createIndex({ role: 1, isActive: 1 })
```

## Role Mapping

LMS roles are mapped to Support Library's three-tier system:

| LMS Role | Support Library Role | Permissions |
|----------|---------------------|-------------|
| `SUPER_ADMIN` | `ADMIN` | Full access, publish/unpublish, staff management |
| `ADMIN` | `ADMIN` | Full access, publish/unpublish |
| `MANAGER` | `ADMIN` | Full access, publish/unpublish |
| `COORDINATOR` | `ADMIN` | Full access, publish/unpublish |
| `MODERATOR` | `ADMIN` | Full access, publish/unpublish |
| `INSTRUCTOR` | `MENTOR` | Create/edit issues, replies |
| `MEMBER` | `MENTOR` | Create/edit issues, replies |
| `STUDENT` | `VIEWER` | Read published issues only |
| `USER` | `VIEWER` | Read published issues only |
| (unknown) | `VIEWER` | Read published issues only |

**Mapping logic** (from `lib/lms-roles.ts`):
```typescript
const ADMIN_LMS_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MANAGER", "COORDINATOR", "MODERATOR"
]);
const MENTOR_LMS_ROLES = new Set(["INSTRUCTOR", "MEMBER"]);

function mapLmsRole(lmsRole?: string | null): UserRole {
  const normalized = (lmsRole ?? "").trim().toUpperCase();
  if (ADMIN_LMS_ROLES.has(normalized)) return "ADMIN";
  if (MENTOR_LMS_ROLES.has(normalized)) return "MENTOR";
  return "VIEWER";
}
```

## Authentication Flow

1. User clicks "Sign in with Google" → Google OAuth
2. Auth.js receives email from Google
3. Support Library queries LMS `User` collection by email
4. If user exists and `isActive: true`:
   - Map LMS role → Support Library role
   - Create/update local `staff_users` cache entry
   - Grant access
5. If user not found or `isActive: false`:
   - Deny access
   - Show appropriate error message

## Student Lookup (Autocomplete)

When staff creates an issue, they enter a student's email. Support Library:
1. Queries LMS `User` collection by email (case-insensitive fallback)
2. If found, returns `userId` and `name` for auto-fill
3. Staff can override name if needed
4. Student data is **snapshotted** into the issue (not linked)

## Environment Variables

```env
# LMS Database (read-only)
LMS_MONGODB_URI=mongodb://readonly_user:pass@host:27017/?replicaSet=rs0
LMS_MONGODB_DB=hp-v2  # Database name containing User collection
```

## Mock LMS for Development/Testing

For local development without a real LMS, you can seed a mock `User` collection:

```bash
# Using the test database (requires E2E_ALLOW_DATABASE_RESET=true)
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
MONGODB_DB=support_library_test
LMS_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
LMS_MONGODB_DB=support_library_test
```

Seed script (`scripts/seed-mock-lms.ts`):
```typescript
import mongoose from "mongoose";
import bcrypt from "bcrypt";

async function seedMockLms() {
  await mongoose.connect(process.env.LMS_MONGODB_URI!, { dbName: process.env.LMS_MONGODB_DB! });
  const db = mongoose.connection.db!;

  await db.collection("User").deleteMany({});
  await db.collection("User").insertMany([
    {
      userId: "ADMIN-001",
      email: "admin@test.com",
      name: "Test Admin",
      role: "ADMIN",
      image: null,
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      userId: "MENTOR-001",
      email: "mentor@test.com",
      name: "Test Mentor",
      role: "INSTRUCTOR",
      image: null,
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      userId: "STUDENT-001",
      email: "student@test.com",
      name: "Test Student",
      role: "STUDENT",
      image: null,
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log("Mock LMS users seeded");
  await mongoose.disconnect();
}
```

## Custom LMS Adapter

If your LMS uses a different schema or database, you can replace the LMS integration:

1. **Replace `lib/lms.ts`**: Implement `findLmsUserByEmail` and `lookupLmsStudent`
2. **Replace `lib/lms-roles.ts`**: Implement custom `mapLmsRole`
3. **Update `lib/auth-guard.ts`**: Adjust role types if needed

The integration points are isolated in:
- `lib/lms.ts` — Database queries
- `lib/lms-roles.ts` — Role mapping
- `lib/lms-db.ts` — MongoDB client management
- `auth.ts` — Auth.js `signIn` callback

## Security Considerations

- **Read-only credentials**: LMS MongoDB user must have `read` role only
- **Network isolation**: LMS database should only be accessible from Support Library servers
- **Separate databases**: Use different MongoDB users for Support Library and LMS
- **Audit**: Log all LMS lookups (already implemented via rate limiting + audit)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "LMS_MONGODB_URI is missing" | Set `LMS_MONGODB_URI` in `.env.local` |
| "User not found in LMS" | Verify email exists in LMS `User` collection |
| "Account deactivated" | Check `isActive: true` in LMS |
| "Role not recognized" | Ensure LMS role matches mapping in `lms-roles.ts` |
| Case-sensitive email mismatch | LMS lookup tries exact match first, then case-insensitive |

## Testing LMS Integration

```bash
# Run unit tests for LMS role mapping
npm test -- __tests__/lms-roles.test.ts

# Run E2E tests (requires MongoDB + LMS_MONGODB_URI)
npm run test:e2e
```