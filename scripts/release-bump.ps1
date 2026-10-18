<#
.SYNOPSIS
    Bump the package.json version, commit it, then run the full release gate.

.DESCRIPTION
    Increments the SemVer version in package.json (and package-lock.json),
    commits the bump on the current branch, then invokes scripts/release.ps1
    with the new version. The release script re-runs the gate (lint, typecheck,
    unit tests, production build, e2e, Docker builds/smoke, audits), creates a
    lightweight tag, and atomically pushes main plus the tag.

.PARAMETER Level
    SemVer level to bump: 'patch' (default), 'minor', or 'major'.
#>

param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Level = "patch"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$CurrentVersion = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "package.json") | ConvertFrom-Json).version
Write-Host "Bumping $Level version from $CurrentVersion" -ForegroundColor Cyan

# npm version <level> --no-git-tag-version updates package.json and
# package-lock.json without creating a commit or tag; we commit the bump
# ourselves so release.ps1's clean-tree check passes and the bump is
# traceable in git history.
cmd /c "npm version $Level --no-git-tag-version"
if ($LASTEXITCODE -ne 0) {
    throw "npm version $Level failed with exit code $LASTEXITCODE"
}

$NewVersion = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "package.json") | ConvertFrom-Json).version
Write-Host "New version: $NewVersion" -ForegroundColor Green

git add package.json
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No version change detected; nothing to commit." -ForegroundColor Yellow
    exit 0
}

git commit -m "chore: release v$NewVersion"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to commit version bump"
}
Write-Host "Committed version bump." -ForegroundColor Green

# Hand off to the release script, which verifies the gate, tags, and
# atomically pushes main + the tag.
& (Join-Path $PSScriptRoot "release.ps1") -Version $NewVersion
