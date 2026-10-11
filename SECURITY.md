# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

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
- **CSRF protection** on all Server Actions (double-submit cookie)

### Authorization
- **Three-tier roles**: ADMIN, MENTOR, VIEWER
- **Server-side enforcement** on every mutation
- **Resource ownership** checks (mentors can only edit own replies)

### Data Protection
- **Student email hashing**: Bcrypt (cost 12) at rest, excluded from search indexes
- **HTTPS enforcement**: All external links must use HTTPS
- **Rate limiting**: Per-scope fixed-window (10-30 req/min)
- **Audit logging**: All mutations with actor, action, resource, IP, UA, requestId

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
- Student emails are hashed and excluded from search
- Student data snapshotted into issues (not linked to LMS)
- Public API strips all PII (`studentName`, `studentEmail`, `lmsUserId`)

## Security Checklist for Deployments

- [ ] MongoDB: Auth enabled, TLS, replica set
- [ ] LMS credentials: Read-only, separate from app credentials
- [ ] `AUTH_SECRET`: 32+ chars, generated via `npx auth secret`
- [ ] `AUTH_URL`: HTTPS in production
- [ ] `AUTH_TRUST_HOST`: `true` behind proxy
- [ ] `ALLOW_INSECURE_LINKS`: `false` in production
- [ ] TLS: Let's Encrypt or custom certs via Traefik
- [ ] Rate limits: Traefik middleware + app-level limits
- [ ] Monitoring: Health endpoints, log aggregation
- [ ] Backups: Encrypted `mongodump` with retention

## Security Headers

Configured in `next.config.js`:
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Contact

For security concerns: **eshan@hablu-programmer.com**

PGP Key: Available on request

## Acknowledgments

We appreciate responsible disclosure from security researchers. Contributors who report valid vulnerabilities will be acknowledged in release notes (unless they prefer anonymity).