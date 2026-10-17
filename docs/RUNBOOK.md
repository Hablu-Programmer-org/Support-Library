# Support Library Operations Runbook

## Release identity

Production is managed only through `.github/workflows/deploy.yml`. Do not copy a working tree to the VPS, build there, edit release files in place, or deploy a mutable tag. The authoritative values are:

- GitHub publish run ID and its `release-metadata` artifact
- `APP_IMAGE` and `OPS_IMAGE` immutable digests in `release.env`
- `/opt/hablu-support-library/state/current-release`
- `/opt/hablu-support-library/state/current-image`

Inspect without printing the production environment:

```bash
cat /opt/hablu-support-library/state/current-release
cat /opt/hablu-support-library/state/current-image
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' hablu-support-library
```

## Routine checks

```bash
curl --fail --silent https://support.hablu-programmer.com/api/health/live | jq .
curl --fail --silent https://support.hablu-programmer.com/api/health/ready | jq .
docker logs --tail 100 hablu-support-library
```

Readiness verifies production environment configuration plus support/LMS database access. Liveness verifies only the process. Alert on repeated readiness failures, container restarts, OAuth failures, database errors, and failed deployment workflows.

## Deploy

1. Confirm the exact commit has successful `CI` and `Publish GHCR image` runs.
2. Open `Deploy production` and choose `deploy`.
3. Enter the successful publish run ID.
4. Review and approve the protected `production` environment deployment.
5. The workflow verifies the artifact, trusted SSH host, image digests, additive indexes, index state, and transaction preflight before cutover.
6. Confirm readiness, release identity, Google login, issue browsing, and an authorized disposable create/read flow.

Deployments are serialized. Do not cancel an in-progress production deployment unless incident response requires it.

## Rollback

1. Open `Deploy production`, choose `rollback`, and leave `publish_run_id` empty.
2. Review and approve the protected environment deployment.
3. The workflow restores the exact recorded previous image and release Compose file.
4. Recheck liveness, readiness, release identity, login, and issue access.

Index creation is additive and is not reversed by application rollback. If rollback state is absent, stop and investigate rather than selecting an arbitrary tag.

## Incident containment

If the application must be stopped immediately:

```bash
docker stop hablu-support-library
```

Preserve container logs and the four state files before cleanup. Rotate affected OAuth, Atlas, GHCR, SSH, or `AUTH_SECRET` credentials after suspected exposure; rotating `AUTH_SECRET` invalidates active sessions. Never paste `.env.production` or credentials into an issue, workflow input, or chat.

## Database recovery

Use encrypted support-database backups created with a backup-only credential. Restore into a non-production database first and validate indexes plus application behavior. The LMS database is read-only to this service and follows the LMS recovery process. Database restore and destructive index changes require a separate approved procedure; `db:indexes --apply --create-only` never drops indexes.

### Student email migration

Run `npm run db:hash-student-emails` first; dry-run is the default. After taking
and verifying an encrypted `mongodump`, apply with
`npm run db:hash-student-emails -- --apply --confirm=<database> --backup-acknowledged`.
The script redacts URI credentials, conditionally updates against source values,
and exits nonzero on conflicts or invalid data. Rollback is restoration of the
pre-migration encrypted dump; no plaintext export is produced. Retain old
encryption key versions through the backup retention window.

### Retired file-link cleanup

The generic external `fileLinks` feature has been removed; private image uploads
and HTTPS video links remain. Run the cleanup before deploying the schema removal:

1. Take and verify an encrypted `mongodump` of the support database.
2. Run `npm run db:remove-file-links` and retain its dry-run counts.
3. Apply with
   `npm run db:remove-file-links -- --apply --confirm=<database> --backup-acknowledged`.
4. Confirm the apply summary reports the expected issue/reply counts, then deploy.

The command removes only top-level `fileLinks` fields from `support-issues` and
`support-replies`. It is idempotent and redacts URI credentials. Its only rollback
is restoration of the pre-apply encrypted dump; retain the command output with the
release evidence.

## R2 key rotation

1. Create a new access key in the Cloudflare R2 dashboard.
2. Set `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` to the new values on the deployment.
3. Redeploy; the new key is picked up at boot (`readR2Config` reads env at process start).
4. Revoke the old key only after every running instance has restarted.

Rotating the bucket or account ID requires migrating every object key (keys are stored in Mongo), so prefer rotating credentials only. Object keys are immutable and never contain the client filename.

## Cloudinary key rotation and quota recovery

1. In Cloudinary Console → Settings → API Keys, create a replacement key/secret.
2. Atomically update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in the protected deployment env; `CLOUDINARY_CLOUD_NAME` normally stays unchanged.
3. Restart every app instance, then verify one upload, one authorized download, and one delete.
4. Revoke the old key only after all instances use the replacement.

Cloudinary Free has 25 credits, a 10 MiB per-image limit and a 25 MP resolution limit. Check Console usage when writes or reads are rejected. The app defaults to 5 MiB and fails startup if a Cloudinary deployment configures more than 10 MiB unless `CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB=true` explicitly acknowledges a plan that supports it. Do not use that flag to bypass an actual account limit.
