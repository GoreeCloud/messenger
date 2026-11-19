# Local homeserver bootstrap — development only

Docker or a compatible container runtime is required, and the service binds to
127.0.0.1:8008 only. It is not a production deployment.

1. Choose a Matrix server name you control (for example matrix.example.org).
2. Create deploy/data/synapse; it is gitignored.
3. Generate the pinned Synapse configuration:

~~~sh
cd deploy
mkdir -p data/synapse
docker run --rm -v "$PWD/data/synapse:/data" \
  -e SYNAPSE_SERVER_NAME=matrix.example.org \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:v1.163.0 generate
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

`deploy/compose.source.yaml` selects the local source build. It retains
loopback-only HTTP exposure, no automatic restart and separate runtime data.
Do not run this configuration until the signing keys and server configuration
are reviewed. Use `docker compose -f compose.source.yaml ...` or an appropriate
compatible container runtime only for an explicitly authorized local test.
All production hardening and restore requirements remain open.
