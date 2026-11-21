# Local homeserver bootstrap — development only

Docker or a compatible container runtime is required, and the service binds to
127.0.0.1:8008 only. It is not a production deployment.

1. Choose a Matrix server name you control (for example matrix.example.org).
2. Create deploy/data/synapse; it is gitignored.
3. Generate the pinned Synapse configuration:

~~~sh
cd deploy
mkdir -p data/synapse
docker pull matrixdotorg/synapse@sha256:08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6
docker run --rm --pull never --network none -v "$PWD/data/synapse:/data" \
  -e SYNAPSE_SERVER_NAME=matrix.example.org \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse@sha256:08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6 generate
~~~

4. Review data/synapse/homeserver.yaml, disable open registration, verify server name and signing-key security, and review listener/federation/storage policies. Never commit this file.
5. After a source/image and settings review, start locally with docker compose up -d.
6. Create test accounts through the supported Synapse administrative CLI. Never casually enable public registration.
7. Browser development may connect to http://localhost:8008. Android requires a separate trusted TLS hostname.
8. Shut down with docker compose down. Data deletion is a separate destructive action requiring a recovery decision.

The dev image is upstream prebuilt v1.163.0; it is not a verified image built from the vendored Synapse source. For production add source reproducibility, TLS reverse proxy, Postgres, encryption/key lifecycle, rate limiting, backups, restore tests and monitoring.

## Opt-in builds from the vendored source

Run `python3 deploy/verify_source.py` and `bash deploy/build_source.sh` to review
source structure and the dry-run build command. After independently reviewing the
upstream Dockerfile and dependencies, `bash deploy/build_source.sh --execute`
requests a local Podman or Docker source-image build. Do not treat this as
reproducible, vulnerability-scanned or deployment-ready.

Both Compose previews have `pull_policy: never` and no
`build:` block. `deploy/compose.yaml` consumes the reviewed
immutable official Synapse 1.163.0 Linux/amd64 digest, which must be
fetched deliberately before Compose can run. `deploy/compose.source.yaml`
consumes only the locally prebuilt
`goreecloud-messenger/synapse:1.163.0-source-local` image.
It cannot directly invoke the risky upstream Dockerfile via Compose.

The operator-only build entrypoint remains
`bash deploy/build_source.sh --execute --acknowledge-upstream-network-risks`.
It still contains known mutable base images, a remote shell installer,
a floating Rust toolchain and optional dependency-lock bypass args:
do not execute it before separate supply-chain and source review.
Neither Compose preview is production-ready. Both retain loopback-only
HTTP exposure, no automatic restart and separate runtime data. Verify
signing keys, server settings, routing and recovery independently.
Use `docker compose -f compose.source.yaml` only in an isolated,
authorized development environment after these gates pass.
All production hardening and restore requirements remain open.

## Configuration audit

Review [docs/HOMESERVER_POLICY.md](../docs/HOMESERVER_POLICY.md).
Before attempting to start an explicitly authorized test server, audit
the private generated homeserver.yaml and the exact Compose file selected:

~~~sh
python3 deploy/check_homeserver.py --config deploy/data/synapse/homeserver.yaml --mode local --compose deploy/compose.yaml
~~~

For a source-build preview, substitute `deploy/compose.source.yaml` and
independently review all vendored Dockerfile risks before any image build.
The policy checks explicit privacy settings, scoped local mounts, lack of
public port publishing and no host namespace/privilege escalation.
It never prints YAML secrets, launches containers, or claims a deployment
is secure. Runtime firewall, bridge networking and TLS still require
independent acceptance.
