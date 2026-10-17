# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |
| < 1.0   | No        |

Only the latest stable release receives security updates.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

Instead, email us at: **eshan@hablu-programmer.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

We will acknowledge receipt within 48 hours and provide a preliminary assessment within 5 business days.

## Disclosure Process

1. **Report received** → Acknowledgment within 48 hours
2. **Assessment** → Preliminary analysis within 5 business days
3. **Fix development** → Target fix within 30 days for critical issues
4. **Testing** → Internal verification + regression tests
5. **Release** → Security patch release (patch version bump)
6. **Public disclosure** → After users have time to upgrade (typically 2 weeks)

## Security Architecture

### Authentication
- **Auth.js v5** with Google OAuth only
- **JWT sessions** (8-hour expiry, HTTP-only cookies)
- **Role mapping** from external LMS database (read-only)
- **CSRF protection** on all Server Actions (session-bound expiring HMAC tokens, timing-safe validation)

### Authorization
- **Three-tier roles**: ADMIN, MENTOR, STUDENT
- **Server-side enforcement** on every mutation
- **Resource ownership** checks (mentors can only edit own replies)

### Data Protection
- **Student email storage**: AES-256-GCM authenticated encryption for authorized staff display plus a separately keyed HMAC-SHA-256 lookup value for exact search; plaintext is excluded from storage and from full-text search
- **HTTPS enforcement**: All external links must use HTTPS
- **Rate limiting**: Per-scope fixed-window (10-30 req/min)
- **Audit logging**: issue/reply mutations, publication, OAuth sign-in, and selected denied events; request context is recorded when available
- **Uploaded attachments (images only, PNG/JPEG/GIF/WebP)**: stored in a private object store (Cloudflare R2). Object keys are server-generated (`attachments/YYYY/MM/<uuid>.<ext>`); the client filename is never used as a path. The store is never reached directly: `/api/attachments/<id>` authorizes the session (ADMIN/MENTOR, or the uploader themselves) before streaming, and answers 404 rather than 403 to avoid an existence oracle. Uploads are **never** added to the public projection (policy A1) and filenames are excluded from `searchText` to prevent PII leaks. No antivirus runs, so risky container formats (PDF/ZIP/Office) are deliberately excluded. Images are identified by magic bytes, dimensions are capped (8000 px side, 40 MP) against decompression bombs, and EXIF metadata is accepted as a residual risk (images are not re-encoded). Container formats rely on `X-Content-Type-Options: nosniff` and the enumerated MIME type allowlist.

### Infrastructure
- **Container hardening**: Non-root, read-only FS, dropped capabilities
- **Security headers**: CSP, HSTS, X-Frame-Options, etc.
- **MongoDB**: Replica set required (transactions), parameterized queries only
- **Network**: MongoDB isolated, TLS in production

## Known Security Considerations

### External LMS Dependency
- Support Library requires read-only access to an external LMS database
- LMS credentials must be separate from Support Library credentials
- Network isolation recommended between LMS and Support Library

### OAuth Scope
- Only Google OAuth supported (no password-based auth)
- Relies on Google's security for credential management
- No password reset flow in Support Library

### Student Data
- Student names and encrypted emails are sensitive issue fields visible only to authorized staff; email is excluded from full-text search
- Each `studentEmailEncrypted` ciphertext is authenticated with AES-256-GCM and bound to its key version; the `studentEmailLookup` HMAC is derived from an independent key so a search index leak cannot decrypt email
- Key rotation keeps previous versions in both keyrings until records are re-wrapped by the guarded migration script
- Student data snapshotted into issues (not linked to LMS)
- Public API strips all PII (`studentName`, `studentEmail`, `lmsUserId`)

## Security Checklist for Deployments

- [ ] MongoDB: Auth enabled, TLS, replica set
- [ ] LMS credentials: Read-only, separate from app credentials
- [ ] `AUTH_SECRET`: 32+ chars, generated via `npx auth secret`
- [ ] `STUDENT_EMAIL_ENCRYPTION_KEYS` / `STUDENT_EMAIL_LOOKUP_KEYS`: independent random 32-byte keyrings, `STUDENT_EMAIL_KEY_VERSION` set
- [ ] `TRUSTED_PROXY_HOPS`: matches the number of trusted proxies in front of the app
- [ ] `AUTH_URL`: HTTPS in production
- [ ] `AUTH_TRUST_HOST`: `true` behind proxy
- [ ] TLS: Let's Encrypt or custom certs via Traefik
- [ ] Rate limits: Traefik middleware + app-level limits
- [ ] Monitoring: Health endpoints, log aggregation
- [ ] Backups: Encrypted `mongodump` with retention

## Security Headers

Configured in `next.config.mjs`:
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

The CSP itself is applied as a nonce-based policy in `proxy.ts` that allows no `unsafe-eval` in production builds.

## Contact

For security concerns: **eshan@hablu-programmer.com**

PGP Key: Available on request

## Acknowledgments

We appreciate responsible disclosure from security researchers. Contributors who report valid vulnerabilities will be acknowledged in release notes (unless they prefer anonymity).
