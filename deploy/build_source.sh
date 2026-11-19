#!/usr/bin/env bash
# Source-image build entrypoint; never runs from the default dry run.
# --execute also requires explicit acceptance of known upstream build risks.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 deploy/verify_source.py
python3 deploy/audit_source_build.py
echo "Building from third_party/synapse/docker/Dockerfile is NOT a security approval."
echo "Review upstream build instructions and their external dependency downloads first."
if [[ "$#" -eq 0 || "$1" != "--execute" ]]; then
  echo "DRY RUN: container build -f third_party/synapse/docker/Dockerfile -t goreecloud-messenger/synapse:1.163.0-source-local third_party/synapse"
  echo "Operator build requires --execute --acknowledge-upstream-network-risks after independent source/dependency review."
  exit 0
fi
if [[ "$#" -ne 2 || "$2" != "--acknowledge-upstream-network-risks" ]]; then
  echo "BLOCKED: the vendor Dockerfile contains mutable base-image tags, a remote shell installer and a floating Rust toolchain." >&2
  echo "Build only on an isolated, authorized test host after review; pass --execute --acknowledge-upstream-network-risks explicitly." >&2
  exit 2
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
