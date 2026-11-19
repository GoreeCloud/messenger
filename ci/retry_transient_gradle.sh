#!/usr/bin/env bash
# Retry only when a dependency repository explicitly rate-limits (HTTP 429).
set -euo pipefail
if (( $# < 1 )); then echo "Usage: retry_transient_gradle.sh <command> [args...]" >&2; exit 64; fi
attempts=3
delay="$(printenv MESSENGER_CI_RETRY_SECONDS || printf '12')"
if [[ ! "$delay" =~ ^[0-9]{1,2}$ ]]; then echo "Invalid retry delay." >&2; exit 64; fi
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
for ((attempt = 1; attempt <= attempts; attempt++)); do
  : > "$log"
  echo "Build attempt $attempt/$attempts"
  # Pipefail makes this synchronous; grep sees the complete tee output.
  if "$@" 2>&1 | tee "$log"; then
    echo "Gradle build succeeded."
    exit 0
  else
    status=$?
  fi
  if (( attempt == attempts )) ||
      ! grep -Eiq '(Received status code 429|HTTP[ /0-9.]*429|Too Many Requests)' "$log"; then
    echo "Build failed (exit $status); no further retries." >&2
    exit "$status"
  fi
  echo "Dependency repository HTTP 429 detected; bounded retry follows." >&2
  sleep "$((attempt * delay))"
done
exit 1
