# VPS deployment

Production pulls an exact GHCR full-commit-SHA tag, resolves it to an immutable registry digest, and runs that digest behind the existing Traefik instance. GitHub's protected `production` environment must require an approver.

## VPS layout

```text
/opt/hablu-support-library/
  releases/<full-git-sha>/compose.production.yml
  shared/.env.production
  state/{current,previous}-{release,image}
```

State files are written with a temporary file plus atomic rename, so a release is never paired with the wrong image. Before the rollout the deploy applies additive MongoDB indexes and runs a write/transaction preflight using the `-ops` image built from the same commit; a failure aborts the deployment before the new release starts.

Create `root_default` before the first deployment and pre-authenticate Docker to GHCR with a read-only package token if the package is private. The deploy user needs narrowly scoped access to Docker and `/opt/hablu-support-library`; protect SSH with keys only and restrict inbound SSH by source IP where practical.

Create `/opt/hablu-support-library/shared/.env.production` owned by the deploy user, mode `0600` (use root only when root is the deploy user). Populate the runtime names from `.env.example` with production values, including separate `MONGODB_URI` and `LMS_MONGODB_URI` credentials, `AUTH_URL=https://support.hablu-programmer.com`, and `NODE_ENV=production`. Never store this file in GitHub or copy it during deployment.

## External setup

- Atlas: use one credential with `readWrite` only on the support database and a separate credential with `read` only on `hp-v2`; do not grant cluster-admin or cross-database write roles. Allow only the VPS egress IP in Atlas Network Access.
- DNS: point `support.hablu-programmer.com` to the VPS. Confirm ports 80/443 reach Traefik and the `mytlschallenge` resolver can issue a certificate.
- Google OAuth: add `https://support.hablu-programmer.com/api/auth/callback/google` as an exact authorized redirect URI and the production origin as an authorized JavaScript origin.

## GitHub setup

Create a protected `production` environment with required reviewers and deployment-branch restrictions. Add environment secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, and `VPS_SSH_KNOWN_HOSTS`; the known-host value must be obtained through a trusted out-of-band channel, not `ssh-keyscan` in CI. Optionally set `VPS_SSH_PORT` as an environment variable.

The workflows run in order: `CI` -> `Publish GHCR image` -> approval-gated `Deploy production`. Publish builds both the runtime and `-ops` images for the verified commit and uploads a `release-metadata` artifact containing the commit SHA and runtime image digest; deploy downloads that artifact rather than trusting `workflow_run` metadata, and refuses to run if the pulled image digest differs. CI uses an ephemeral MongoDB and runs the production build before Playwright. It automatically adopts `playwright.ci.config.ts` when that future config is added; until then it uses `playwright.12001.config.ts`.

## Initial deploy and checks

1. Back up the support database and verify the protected env file and Atlas roles.
2. Merge to `main`, wait for CI and image publication, then approve the production deployment.
3. Check `docker ps --filter name=hablu-support-library` and `docker inspect --format '{{json .State.Health}}' hablu-support-library`.
4. Check `/api/health/live` for process liveness and `/api/health/ready` for support/LMS database readiness.
5. Sign in through Google, load the issue library, create/read a disposable support case with an authorized staff account, then remove it.
6. Confirm Traefik serves the expected certificate and no container port is published on the host.

## Rollback

Run `Deploy production` manually with action `rollback` and approve the protected environment. The workflow restores the recorded previous release and image. A failed deployment also rolls back automatically before the workflow exits. Re-run liveness, login, and issue-library smoke checks after rollback.

## Backup and recovery

Schedule encrypted `mongodump` backups for the support database using a backup-only Atlas credential, store them off the VPS with retention and access logging, and alert on failures. Test a restore into a non-production database regularly. The application reads `hp-v2`; its backup and recovery remain owned by the LMS database process.

## Secret rotation

Rotate `AUTH_SECRET`, OAuth credentials, Atlas credentials, the GHCR read token, and SSH deploy keys on a documented schedule and immediately after suspected exposure. Rotation of `AUTH_SECRET` invalidates sessions. Update the VPS env file atomically, restart through the approved workflow, and verify health and authentication; never place runtime values in workflow files, images, logs, or deployment artifacts.
