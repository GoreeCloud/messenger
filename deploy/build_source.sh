#!/usr/bin/env bash
# Source-image build entrypoint; does not run unless explicitly passed --execute.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 deploy/verify_source.py
echo "Building from third_party/synapse/docker/Dockerfile is NOT a security approval."
echo "Review upstream build instructions and their external dependency downloads first."
if [[ "$#" -eq 0 || "$1" != "--execute" ]]; then
  echo "DRY RUN: container build -f third_party/synapse/docker/Dockerfile -t goreecloud-messenger/synapse:1.163.0-source-local third_party/synapse"
  echo "Pass --execute to build with podman or docker after reviewing the upstream Dockerfile."
  exit 0
fi
if command -v podman >/dev/null 2>&1; then
  runtime=podman
elif command -v docker >/dev/null 2>&1; then
  runtime=docker
else
  echo "No supported container builder found." >&2; exit 1
fi
"$runtime" build --file third_party/synapse/docker/Dockerfile \
  --tag goreecloud-messenger/synapse:1.163.0-source-local \
  third_party/synapse
