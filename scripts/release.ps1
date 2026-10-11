<#
.SYNOPSIS
    Create and push a signed Git tag for Support Library release.

.DESCRIPTION
    This script commits all changes, creates a signed tag, and pushes to origin.
    Requires GPG key configured for signed tags.

.PARAMETER Version
    Version to tag (default: v1.0.0)

.PARAMETER Lightweight
    Use lightweight tag instead of signed tag (no GPG required)

.EXAMPLE
    .\scripts\release.ps1 -Version v1.0.0
    .\scripts\release.ps1 -Version v1.0.0 -Lightweight
#>

param(
    [string]$Version = "v1.0.0",
    [switch]$Lightweight
)

$ErrorActionPreference = "Stop"

# Get repo root
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "=== Support Library Release Script ===" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow
Write-Host "Repo: $RepoRoot" -ForegroundColor Yellow
Write-Host ""

# Check git status
$Status = git status --porcelain
if (-not $Status) {
    Write-Host "No changes to commit. Checking for existing tag..." -ForegroundColor Yellow
    if (git tag -l $Version) {
        Write-Host "Tag $Version already exists!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Changes detected. Staging all..." -ForegroundColor Yellow
    git add -A
    git status
}

# Verify build passes before release
Write-Host "`n=== Running verification gates ===" -ForegroundColor Cyan
$Commands = @(
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build"
)

foreach ($cmd in $Commands) {
    Write-Host "Running: $cmd" -ForegroundColor Gray
    $result = & cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $cmd" -ForegroundColor Red
        exit 1
    }
}
Write-Host "All verification gates PASSED" -ForegroundColor Green

# Commit message
$CommitMsg = @"
release: $Version - Open-source release with security hardening

Phase 1: Critical security fixes
- CSRF protection on all Server Actions
- Remove ALLOW_INSECURE_LINKS, enforce HTTPS everywhere
- Hash studentEmail (bcrypt cost 12) at rest, exclude from search
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Rate limit on OAuth callback (10 req/min/IP)
- Secure session cookies (HttpOnly, Secure, SameSite=Lax)

Phase 2: Defense-in-depth hardening
- Server-side mentorId enforcement (MENTOR role)
- Audit logs enriched with IP, UA, requestId
- Search regex timeout (5s maxTimeMS)
- IP fallback rate limiting
- Fix createOperationId partial index (sentinel '__none__')

Phase 3: Open-source preparation
- Generic Docker Compose (compose.example.yml + compose.traefik.yml)
- Multi-platform deploy workflow (.github/workflows/deploy.example.yml)
- Self-hosted deployment docs (Docker, Vercel, Railway, Render, Coolify)
- LMS integration docs (schema, role mapping, custom adapters)
- Branding guidelines (BRANDING.md)
- Standard OSS files (CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md)
- Updated README with architecture + doc navigation

All verification gates pass: lint, typecheck, test (52), build
"@

# Commit if there are changes
if ($Status) {
    Write-Host "`n=== Committing changes ===" -ForegroundColor Cyan
    git commit -m $CommitMsg
} else {
    Write-Host "`nNo new changes to commit (already committed)." -ForegroundColor Yellow
}

# Check if tag exists
if (git tag -l $Version) {
    Write-Host "Tag $Version already exists locally!" -ForegroundColor Red
    Write-Host "Delete it first: git tag -d $Version" -ForegroundColor Yellow
    exit 1
}

# Create tag
Write-Host "`n=== Creating tag $Version ===" -ForegroundColor Cyan
$TagMsg = @"
$Version - Support Library Open Source Release

Security-hardened support library for Hablu Programmer LMS.

Features:
- Staff-first issue management with replies, file/video links
- Google OAuth via Auth.js v5, roles synced from external LMS
- Three-tier access: ADMIN / MENTOR / VIEWER
- Student email hashing (bcrypt), excluded from search indexes
- CSRF protection, rate limiting, audit logging on all mutations
- Container hardening (non-root, read-only FS, dropped caps)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)

Deployment:
- Docker Compose (generic + Traefik override)
- Multi-platform: Vercel, Railway, Render, Coolify, VPS
- Self-hosted deployment guide with MongoDB replica set setup

Documentation:
- Self-hosted deployment guide
- LMS integration guide (schema, role mapping, custom adapters)
- Branding guidelines, contributing, security policy, code of conduct

Verification: lint + typecheck + 52 unit tests + build all pass
"@

if ($Lightweight) {
    Write-Host "Creating lightweight tag (no GPG signature)..." -ForegroundColor Yellow
    git tag $Version -m $TagMsg
} else {
    Write-Host "Creating signed tag (requires GPG key)..." -ForegroundColor Yellow
    git tag -s $Version -m $TagMsg
}

# Show tag info
git show $Version --no-pager | Select-Object -First 20

# Confirm push
Write-Host "`nReady to push to origin?" -ForegroundColor Cyan
$Confirm = Read-Host "Push commit and tag to origin/main? (y/N)"
if ($Confirm -eq 'y' -or $Confirm -eq 'Y') {
    Write-Host "Pushing..." -ForegroundColor Cyan
    git push origin main
    git push origin $Version
    Write-Host "`n✅ Release $Version pushed successfully!" -ForegroundColor Green
    Write-Host "GitHub Release: https://github.com/$(git config --get remote.origin.url | Select-String '(?<=github.com[:/])[^/]+/[^/]+(?=\.git)').Matches.Value/releases/tag/$Version" -ForegroundColor Cyan
} else {
    Write-Host "`nSkipped push. Run manually when ready:" -ForegroundColor Yellow
    Write-Host "  git push origin main" -ForegroundColor Gray
    Write-Host "  git push origin $Version" -ForegroundColor Gray
}