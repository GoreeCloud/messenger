# Isolated synthetic PostgreSQL backup / restore rehearsal

The offline Synapse snapshot hash verifier in `deploy/verify_snapshot.py`
does **not** prove that a database archive can be restored. To separately
validate the PostgreSQL tooling and disaster-recovery operator workflow,
Messenger includes `deploy/smoke_synthetic_pg_restore.sh`, which uses
*invented rows only*.

**Executed on an authorized GoreeCloud VPS, November 20, 2026 local:**

- Docker image: cached official `postgres:15.7-alpine` at immutable
  `postgres@sha256:468d34fefd6338031787c7b8e94078975b3aaf4d66c7ead25c39cd3ba46a15c6`
- Container: nonroot UID 70, read-only root filesystem, **network disabled**,
  no forwarded host ports, no host bind mounts, no production credentials or
  account content, explicit memory/CPU/process limits, ephemeral tmpfs data
- Fixture: one generated table and one synthetic message string
- Actions: `pg_dump -Fc` backup -> `createdb` empty restore target ->
  `pg_restore --exit-on-error` -> exact data query/compare
- **Result: PASS.** Follow-up inspection returned zero remaining test
  containers. PostgreSQL source code was not imported into Messenger.
  The VPS's existing services and network ingress were not changed.

## How to run intentionally

This script is **not run automatically by CI** or on pull requests.
On a trusted, authorized Docker host where that exact reviewed image digest
is already cached:

```bash
bash deploy/smoke_synthetic_pg_restore.sh --ack-synthetic-only
```

The script refuses any call missing the acknowledgment. Docker pulls are
disabled. Only synthetic data is created; the working database and archive
are inside container memory and are erased on normal script cleanup. If the
process is forcibly killed, check for a leftover container with the
`gc-messenger-pg-disposable-` prefix and remove that **specific** container
after confirming it belongs to this test.

A dedicated standard-library CI policy test checks that the script remains
non-networked, unprivileged, container-only, bounded, and acknowledgment-gated.
It also checks syntax without running Docker.

## What this does not prove

A successful synthetic PostgreSQL restore **is not** a Synapse
database/media/room-key restore. It does not validate any production
schema, Matrix signing keys, filesystem backups, SQL migrations, retention
policy, TLS, room encryption, disposable account interoperability, failover,
restoration of a full Synapse homeserver, or an actual production deployment.
Those release gates require independent isolated acceptance evidence.

Synapse source provenance, encrypted device continuity and privacy
policies remain separate GoreeCloud release obligations.

## Startup readiness race found in the repeatable script

An initial execution of the reusable script discovered that the PostgreSQL
socket could report readiness before the Docker entrypoint finished creating
the synthetic application database. No restoration ran in that failed
attempt; the throwaway container was removed. The script now waits for
**a successful SELECT 1 in gcm_synthetic**, not just a ready socket. This
readiness regression is covered by an additional offline policy test.

## Verified repeatable-script result

After fixing the readiness race, the **exact repository script** was copied
to a temporary path on the authorized VPS and executed with
`--ack-synthetic-only`. It successfully created the invented row,
generated its custom-format PostgreSQL archive, restored into an empty
database, and verified the restored value. The temporary file was deleted.
An independent post-run Docker listing showed **no disposable test
containers**. No existing VPS service or ingress was modified.
