# Source build and upstream provenance

- Upstream: https://github.com/element-hq/synapse
- Pinned release: **v1.163.0**, upstream Git commit
  193cf9466fbfbe334700c541dc1442f135179aaf
- Manifest: third_party/synapse/pyproject.toml
- Source build recipe: unmodified third_party/synapse/docker/Dockerfile
- Imported files retain upstream LICENSE-AGPL-3.0, copyright,
  authorship and notices. Root Apache license applies only to GoreeCloud files.

The opt-in deploy/compose.source.yaml builds the local homeserver image
directly from the copied source tree, rather than matrixdotorg/synapse's
prebuilt binary image. The script deploy/build_source.sh defaults to a dry
run; explicit --execute is needed to run a build.

**Important limitations:** the upstream Dockerfile fetches additional
dependencies, Rust tooling, and runtime base images dynamically. A build
from a pinned source snapshot is **not** a reproducible byte-identical or
secure/accepted supply chain without pinned image digests, artifact checksums,
network policy, SBOMs and dependency scans. Merely copying or building source
does not prove it is safe, nor that a running deployment uses this build.
No production service is created by the source build instructions.

Run python3 deploy/verify_source.py and
python3 -m unittest discover -s deploy/tests -v to validate basic structure.
They do not import or execute the Synapse source, install dependencies, or
start containers. Generated homeserver.yaml and signing keys stay in
gitignored deploy/data/synapse and must not be committed.

Before deploying, complete issue #4: audited source-built image, TLS ingress,
PostgreSQL, restrictive registration and anti-abuse, key and metadata
retention, secure backups and restore testing. A source digest can identify
drift, but alone does not establish upstream equivalence or package safety.
