#!/usr/bin/env bash
# Disposable two-account Matrix acceptance. GH-hosted ephemeral runner ONLY.
# Never use any personal account, production TLS, VPS Docker, or host data.
set -euo pipefail

if [[ "$#" -ne 1 || "$1" != "--ack-disposable-only" || "${GITHUB_REF:-}" != "refs/heads/main" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "BLOCKED: manual authorized GitHub main with --ack-disposable-only required." >&2
  exit 2
fi
for tool in docker python3 openssl node curl; do
  command -v "$tool" >/dev/null || { echo "BLOCKED: missing test tool $tool." >&2; exit 2; }
done
test -n "$RUNNER_TEMP" && test -d "$RUNNER_TEMP" || {
  echo "BLOCKED: required ephemeral runner workspace is unavailable." >&2; exit 2;
}

image="matrixdotorg/synapse@sha256:08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6"
container="gc-e2ee-synapse-$GITHUB_RUN_ID"
workspace="$(mktemp -d "$RUNNER_TEMP/gc-e2ee-XXXXXXXX")"
chmod 0700 "$workspace"
proxy_pid=""
cleanup() {
  if [[ -n "$proxy_pid" ]]; then
    kill "$proxy_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  # Only delete our exact mktemp child under the GitHub runner's temp path.
  if [[ "$workspace" == "$RUNNER_TEMP"/gc-e2ee-* && -d "$workspace" ]]; then
    # The Synapse-generated files belong to UID 991, not the runner.
    # Chown only this exact disposable directory after its container stops.
    sudo chown -R "$(id -u):$(id -g)" "$workspace" >/dev/null 2>&1 || true
    rm -rf -- "$workspace"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting pinned official Synapse image with Docker network access disabled."
docker pull --quiet "$image" >/dev/null
docker image inspect "$image" >/dev/null
mkdir -m 0700 "$workspace/synapse"
sudo chown 991:991 "$workspace/synapse"
# The pinned official image generates its disposable signing key and shared secret.
# All generated material stays inside this runner-owned temporary directory.
docker run --rm --user 991:991 --network none --pull never --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 512m \
  --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  --mount "type=bind,source=$workspace/synapse,target=/data" \
  -e SYNAPSE_SERVER_NAME=localhost -e SYNAPSE_REPORT_STATS=no \
  "$image" generate >/dev/null

sudo chown -R "$(id -u):$(id -g)" "$workspace/synapse"
python3 - "$workspace/synapse/homeserver.yaml" <<'PY'
import os
import secrets
import sys
from pathlib import Path
try:
    import yaml
except ImportError as exc:
    raise SystemExit("BLOCKED: PyYAML is required to safely configure disposable Synapse.") from exc
config_path = Path(sys.argv[1])
if config_path.is_symlink() or not config_path.is_file():
    raise SystemExit("BLOCKED: missing regular isolated homeserver config.")
config = yaml.safe_load(config_path.read_text())
if not isinstance(config, dict):
    raise SystemExit("BLOCKED: invalid generated homeserver config.")
listeners = config.get("listeners")
if not isinstance(listeners, list):
    raise SystemExit("BLOCKED: generated server has no listeners.")
client_listener_found = False
for listener in listeners:
    if not isinstance(listener, dict) or listener.get("type") != "http" or listener.get("tls"):
        continue
    if listener.get("port") == 8008:
        listener["bind_addresses"] = ["127.0.0.1"]
        client_listener_found = True
if not client_listener_found:
    raise SystemExit("BLOCKED: generated client listener is absent.")
config.update({
    "server_name": "localhost",
    "public_baseurl": "https://localhost:18443/",
    "enable_registration": False,
    "allow_guest_access": False,
    "url_preview_enabled": False,
    "report_stats": False,
    "enable_metrics": False,
    "enable_3pid_lookup": False,
    "registration_shared_secret": secrets.token_hex(32),
    "app_service_config_files": [],
})
config_path.write_text(yaml.safe_dump(config, sort_keys=False))
os.chmod(config_path, 0o600)
PY

# The official Synapse image uses UID 991 by default. This directory contains
# only generated test secrets; it never mounts any production host files.
sudo chown -R 991:991 "$workspace/synapse"
docker run -d --rm --name "$container" --pull never \
  --network none --read-only --user 991:991 \
  --memory 1536m --cpus 2 --pids-limit 256 --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,noexec,size=96m \
  --mount "type=bind,source=$workspace/synapse,target=/data" \
  -e SYNAPSE_CONFIG_PATH=/data/homeserver.yaml \
  "$image" >/dev/null

ready=0
for _ in $(seq 1 180); do
  # The container has no network interfaces other than its own loopback.
  # Check the Matrix API with the Python already installed in its image.
  if docker exec "$container" python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8008/_matrix/client/versions", timeout=2).read(32)' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  state="$(docker inspect --format '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' "$container" 2>/dev/null || echo "not-running")"
  echo "FAIL: disposable homeserver did not pass internal localhost Matrix health check. State: $state" >&2
  logs="$(docker logs "$container" --tail 100 2>&1 || true)"
  if grep -Eqi '(permission denied|permissionerror|operation not permitted)' <<< "$logs"; then
    echo "DIAG: test container reported a filesystem/UID permission problem." >&2
  elif grep -Eqi '(configerror|configuration error|missing required)' <<< "$logs"; then
    echo "DIAG: test container reported a Synapse config error." >&2
  elif grep -Eqi '(bind|listen|address already)' <<< "$logs"; then
    echo "DIAG: test container reported an internal listener problem." >&2
  fi
  exit 3
fi

# Copy only the reviewed local stdlib relay into the ephemeral container.
# No host TCP port is published: the container exposes a Unix socket in
# its disposable data mount, reachable only through runner-controlled paths.
docker exec -i "$container" sh -c 'cat > /tmp/gc-matrix-unix-relay.py' < deploy/ephemeral_unix_relay.py
docker exec -d "$container" python3 /tmp/gc-matrix-unix-relay.py
relay_ready=0
for _ in $(seq 1 30); do
  if [[ -S "$workspace/synapse/gc-matrix.sock" ]]; then
    relay_ready=1
    break
  fi
  sleep 0.2
done
if [[ "$relay_ready" -ne 1 ]]; then
  echo "FAIL: disposable container Unix relay did not create its socket." >&2
  exit 3
fi
sudo chmod 0711 "$workspace/synapse"
export MATRIX_TEST_UNIX_SOCKET="$workspace/synapse/gc-matrix.sock"

# Generate a certificate trusted only within this one ephemeral CI job.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$workspace/tls-key.pem" -out "$workspace/tls-cert.pem" \
  -subj /CN=localhost -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -addext "basicConstraints=critical,CA:TRUE" >/dev/null 2>&1
chmod 0600 "$workspace/tls-key.pem" "$workspace/tls-cert.pem"
node web/scripts/ephemeral-tls-proxy.mjs \
  "$workspace/tls-cert.pem" "$workspace/tls-key.pem" &
proxy_pid=$!

tls_ready=0
for _ in $(seq 1 40); do
  if curl -fsS --cacert "$workspace/tls-cert.pem" --connect-timeout 1 \
    --max-time 2 https://localhost:18443/_matrix/client/versions >/dev/null 2>&1; then
    tls_ready=1
    break
  fi
  sleep 0.25
done
if [[ "$tls_ready" -ne 1 ]]; then
  echo "FAIL: runner-only trusted-TLS Matrix proxy did not become ready." >&2
  exit 4
fi

# Transient test credentials never enter source, Actions outputs or artifacts.
a_password="$(openssl rand -hex 24)"
b_password="$(openssl rand -hex 24)"
echo "::add-mask::$a_password"
echo "::add-mask::$b_password"
if ! docker exec "$container" register_new_matrix_user \
  --config /data/homeserver.yaml --user gc_alpha --password "$a_password" \
  http://localhost:8008 >/dev/null 2>&1; then
  echo "FAIL: first disposable Matrix account could not be registered." >&2
  exit 5
fi
if ! docker exec "$container" register_new_matrix_user \
  --config /data/homeserver.yaml --user gc_beta --password "$b_password" \
  http://localhost:8008 >/dev/null 2>&1; then
  echo "FAIL: second disposable Matrix account could not be registered." >&2
  exit 5
fi

export NODE_EXTRA_CA_CERTS="$workspace/tls-cert.pem"
export MATRIX_TEST_HOMESERVER="https://localhost:18443"
export MATRIX_TEST_A_ID="@gc_alpha:localhost"
export MATRIX_TEST_B_ID="@gc_beta:localhost"
export MATRIX_TEST_A_PASSWORD="$a_password"
export MATRIX_TEST_B_PASSWORD="$b_password"
export MATRIX_TEST_DISPOSABLE_ACK="YES"
export MATRIX_TEST_TIMEOUT_MS="120000"
echo "Testing disposable authenticated Matrix Rust E2EE sessions over verified job-local TLS."
node web/scripts/e2ee-smoke.mjs
echo "PASS: ephemeral TLS, disposable account roundtrip, and cleanup stage reached."
