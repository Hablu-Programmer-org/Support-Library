<#
.SYNOPSIS
    Verify and atomically push a Support Library release tag.

.DESCRIPTION
    Requires an already committed, clean main branch. The script never stages or
    commits files. It verifies the manifest version, runs the complete release
    gate, creates a lightweight tag, and atomically pushes main plus the tag.

.PARAMETER Version
    SemVer with or without a leading v. Defaults to the package.json version.
#>

param(
    [string]$Version
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Invoke-Gate {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

$PackageVersion = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "package.json") | ConvertFrom-Json).version
if (-not $Version) {
    $Version = $PackageVersion
}
$NormalizedVersion = $Version.TrimStart("v")
$Tag = "v$NormalizedVersion"

if ($NormalizedVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
    throw "Version must be valid SemVer: $Version"
}
if ($NormalizedVersion -ne $PackageVersion) {
    throw "Requested version $NormalizedVersion does not match package.json version $PackageVersion"
}
if ((git branch --show-current) -ne "main") {
    throw "Releases must be cut from main"
}
if (git status --porcelain) {
    throw "Working tree must be clean. Commit or stash changes before releasing."
}
git diff --quiet
if ($LASTEXITCODE -ne 0) { throw "Working tree has unstaged changes" }
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw "Index has staged changes" }
if (git tag --list $Tag) {
    throw "Tag $Tag already exists locally"
}
git ls-remote --exit-code --tags origin "refs/tags/$Tag" *> $null
if ($LASTEXITCODE -eq 0) {
    throw "Tag $Tag already exists on origin"
}
if ($LASTEXITCODE -ne 2) {
    throw "Could not verify remote tag state"
}

Invoke-Gate "Locked dependency install" { cmd /c "npm ci" }
Invoke-Gate "Lint" { cmd /c "npm run lint" }
Invoke-Gate "Typecheck" { cmd /c "npm run typecheck" }
Invoke-Gate "Unit tests" { cmd /c "npm test" }
Invoke-Gate "Clean production build" {
    if (Test-Path -LiteralPath ".next") { Remove-Item -Recurse -Force -LiteralPath ".next" }
    cmd /c "npm run build"
}
if (-not (Test-Path -LiteralPath ".next/standalone/server.js" -PathType Leaf)) {
    throw "Build did not produce .next/standalone/server.js"
}
Invoke-Gate "Production E2E" { cmd /c "npm run test:e2e" }
Invoke-Gate "Production dependency audit" { cmd /c "npm audit --omit=dev --audit-level=high" }
Invoke-Gate "Full dependency audit" { cmd /c "npm audit --audit-level=high" }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required for release verification"
}
$ComposeEnv = Join-Path $env:TEMP "support-library-release-$PID.env"
try {
    @(
        "MONGODB_URI=mongodb://mongo.invalid:27017/?replicaSet=rs0"
        "MONGODB_DB=support_library"
        "LMS_MONGODB_URI=mongodb://mongo.invalid:27017/?replicaSet=rs0"
        "LMS_MONGODB_DB=hp-v2"
        "AUTH_SECRET=Release-only_A7f3kP9xQ2mN8vR5tY1wL6sD4hJ0cB!2026"
        "AUTH_TRUST_HOST=true"
        "AUTH_URL=https://support.example.com"
        "AUTH_GOOGLE_ID=release.invalid.apps.googleusercontent.com"
        "AUTH_GOOGLE_SECRET=release-only-placeholder"
        "NEXT_PUBLIC_APP_URL=https://support.example.com"
        "NODE_ENV=production"
    ) | Set-Content -LiteralPath $ComposeEnv -Encoding ASCII

    $env:APP_ENV_FILE = $ComposeEnv
    $env:APP_IMAGE = "ghcr.io/example/support-library@sha256:" + ("a" * 64)
    $env:OPS_IMAGE = "ghcr.io/example/support-library-ops@sha256:" + ("b" * 64)
    Invoke-Gate "Generic Compose validation" { docker compose -f compose.example.yml config --quiet }
    Invoke-Gate "Traefik Compose validation" { docker compose -f compose.example.yml -f compose.traefik.yml config --quiet }
    Invoke-Gate "Production Compose validation" { docker compose -f compose.production.yml config --quiet }

    $Image = "support-library-release:$NormalizedVersion"
    Invoke-Gate "Runtime image build" { docker build --target runner --build-arg "DEPLOYMENT_VERSION=$(git rev-parse HEAD)" --tag $Image . }
    Invoke-Gate "Operations image build" { docker build --target ops --tag "support-library-ops-release:$NormalizedVersion" . }
    Invoke-Gate "Runtime container smoke" {
        docker run --rm --detach --name "support-library-release-$PID" --publish 127.0.0.1:12002:12000 --env NODE_ENV=production --env "AUTH_SECRET=Release-only_A7f3kP9xQ2mN8vR5tY1wL6sD4hJ0cB!2026" $Image
    }
    try {
        $Healthy = $false
        for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
            curl.exe --fail --silent http://127.0.0.1:12002/api/health/live *> $null
            if ($LASTEXITCODE -eq 0) {
                $Healthy = $true
                break
            }
            Start-Sleep -Seconds 2
        }
        if (-not $Healthy) {
            docker logs "support-library-release-$PID"
            throw "Runtime container did not become live"
        }
    } finally {
        docker stop "support-library-release-$PID" *> $null
    }
} finally {
    Remove-Item -LiteralPath $ComposeEnv -Force -ErrorAction SilentlyContinue
    Remove-Item Env:APP_ENV_FILE, Env:APP_IMAGE, Env:OPS_IMAGE -ErrorAction SilentlyContinue
}

Write-Host "`nAll release gates passed for $Tag." -ForegroundColor Green
$Confirmation = Read-Host "Create lightweight tag $Tag and atomically push main plus the tag? (y/N)"
if ($Confirmation -notin @("y", "Y")) {
    Write-Host "Release cancelled; no tag was created."
    exit 0
}

git tag $Tag
if ($LASTEXITCODE -ne 0) { throw "Failed to create lightweight tag $Tag" }
git push --atomic origin HEAD:main "refs/tags/$Tag"
if ($LASTEXITCODE -ne 0) {
    throw "Atomic push failed. The local tag remains; no partial remote update was accepted."
}

Write-Host "Release $Tag pushed atomically." -ForegroundColor Green
