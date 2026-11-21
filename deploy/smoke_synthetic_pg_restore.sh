#!/usr/bin/env bash
# Isolated disposable PostgreSQL 15.7 smoke check. No host backups are read.
set -euo pipefail

if [[ "$#" -ne 1 || "$1" != "--ack-synthetic-only" ]]; then
  echo "BLOCKED: pass --ack-synthetic-only; never use production credentials." >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "BLOCKED: Docker is required for an explicitly disposable test." >&2
  exit 2
fi

# Reviewed, cached official Postgres 15.7 Alpine image. No network pull is
# allowed. To upgrade it, inspect the source/digest and update the pin first.
image="postgres@sha256:468d34fefd6338031787c7b8e94078975b3aaf4d66c7ead25c39cd3ba46a15c6"
docker image inspect "$image" >/dev/null

container="gc-messenger-pg-disposable-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting an isolated disposable PostgreSQL container; no host mounts or ports."
docker run -d --rm --name "$container" --pull never --network none --read-only --user 70:70 \
  --memory 384m --cpus 0.75 --pids-limit 64 --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=128m,uid=70,gid=70,mode=0700 \
  --tmpfs /var/run/postgresql:rw,nosuid,size=16m,uid=70,gid=70,mode=0770 \
  --tmpfs /tmp:rw,nosuid,size=48m,mode=1777 \
  -e POSTGRES_PASSWORD=synthetic-disposable-test-only \
  -e POSTGRES_DB=gcm_synthetic \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  "$image" >/dev/null

ready=0
for i in $(seq 1 40); do
  # pg_isready can succeed before the entrypoint creates POSTGRES_DB;
  # require a successful query against the actual synthetic target DB.
  if docker exec "$container" psql -X -qAt -v ON_ERROR_STOP=1 \
      -U postgres -d gcm_synthetic -c "SELECT 1" 2>/dev/null | grep -qx '1'; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo "BLOCKED: disposable PostgreSQL never became ready." >&2
  exit 3
fi

docker exec "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d gcm_synthetic \
  -c "CREATE TABLE synthetic_messages (id integer PRIMARY KEY, body text NOT NULL); INSERT INTO synthetic_messages VALUES (1, 'synthetic-only-test');" >/dev/null
docker exec "$container" pg_dump -Fc -U postgres -d gcm_synthetic -f /tmp/synthetic.dump
docker exec "$container" createdb -U postgres gcm_restored
docker exec "$container" pg_restore --exit-on-error --no-owner --no-privileges \
  -U postgres -d gcm_restored /tmp/synthetic.dump

actual=$(docker exec "$container" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d gcm_restored \
  -c "SELECT count(*) || ':' || max(body) FROM synthetic_messages")
if [[ "$actual" != "1:synthetic-only-test" ]]; then
  echo "BLOCKED: restored synthetic data is not identical." >&2
  exit 4
fi
echo "PASS: synthetic PostgreSQL dump, empty-database restore and exact row verification."
echo "NOT VERIFIED: Synapse keys/media, real backups, E2EE, production recovery."
