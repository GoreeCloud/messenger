# Synapse vendored source-build risk gate

The repository retains exact upstream Synapse 1.163.0 source under
\`third_party/synapse/\`, with original AGPL notices and SHA-256 tree digest
verification. **That provenance check is not a verification of what the
upstream Docker build downloads and executes.**

At this repository revision, the vendored Dockerfile:

- Uses mutable version-tag base image references instead of immutable digests.
- Downloads the Rust installer using \`curl\` and pipes it into a shell.
- Selects the floating Rust \`stable\` compiler rather than a pinned toolchain.
- Exposes test-only arguments that can bypass the Poetry lockfile and
  dependency hash verification if an operator explicitly sets them.

These observations are confirmed by the read-only Python static inspector
\`deploy/audit_source_build.py\`. They do **not** prove the upstream is malicious.
The inspector also cannot prove that the build is secure or that dependency
downloads and remote scripts will behave consistently across dates.

## Operator workflow

Running \`bash deploy/build_source.sh\` verifies the known vendor source digest,
prints a static risk inventory, and **performs a dry run only**. No container
builder, package installer or upstream source is executed.

\`bash deploy/build_source.sh --execute\` is intentionally blocked with an
error. The operator must first review the Dockerfile, upstream image digests,
network-fetched Rust installer, Poetry/uv packages, Cargo dependencies and
container build isolation. Only after independent authorization and risk
acceptance, on a separate isolated development worker, may an operator call:

\`\`\`sh
bash deploy/build_source.sh --execute --acknowledge-upstream-network-risks
\`\`\`

This is an explicit acknowledgement, **not a security override that makes the
source safe**. The acknowledged command invokes Docker or Podman and may
download arbitrary external packages and base images. It is **not** executed
by the default CI pipeline and must not be run on production infrastructure
or with mounted secrets. Do not use the upstream \`TEST_ONLY_*\` arguments to
disable hash verification during release builds.

## Acceptance remains outstanding

A reviewed, pinned build environment should replace the mutable image
references and network-executed installer; the Rust compiler and Python
dependency provenance need acceptance, plus isolated source-image build,
runtime test, SBOM/vulnerability analysis, trusted TLS/PostgreSQL staging,
backup/restore and rollback drills. None are claimed as complete here.

Offline checks can be run safely without a container runtime:

\`\`\`sh
python3 -m unittest discover -s deploy/tests -v
python3 deploy/audit_source_build.py --strict
\`\`\`

The \`--strict\` static audit is expected to fail at the present upstream
Dockerfile until the flagged inputs are reviewed and pinned.
