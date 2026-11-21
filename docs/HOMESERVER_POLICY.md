# Synapse local configuration checks

Use the existing vendored-source preflight and an additional **opt-in**
config audit before testing the local homeserver. This is not a deployment
or comprehensive security assessment.

1. Generate an authorized Synapse homeserver.yaml in gitignored
   deploy/data/synapse; never place signing keys, registration secrets,
   passwords or production configuration in the public repository.
2. Restrict permissions: chmod 600 deploy/data/synapse/homeserver.yaml
3. Explicitly configure all seven flags as false (not commented-out defaults):
   enable_registration, enable_registration_without_verification,
   allow_guest_access, url_preview_enabled, report_stats,
   enable_metrics and enable_3pid_lookup. Ensure disable_registration is
   absent or true (its false value overrides the safe registration setting).
   Do not configure Sentry in the local preview.
   Keep app_service_config_files absent or empty. Configure a client listener.
4. Provision the trusted PyYAML safe parser in the operator environment,
   then run:

    python3 deploy/check_homeserver.py --config deploy/data/synapse/homeserver.yaml --mode local

5. Audit the chosen local development Compose file **without starting it**:

    python3 deploy/check_homeserver.py --config deploy/data/synapse/homeserver.yaml --mode local --compose deploy/compose.yaml

   To inspect the opt-in source-build preview instead, use
   `--compose deploy/compose.source.yaml`. Do not execute the source
   build without separate upstream dependency/build review.
6. Independently review actual Docker host port publishing, firewall and
   reverse-proxy behavior. Both checked-in Compose files currently expose
   127.0.0.1:8008 only on the host. The server container may need to
   listen on its container interface for mapped ports.

Production mode additionally demands a PostgreSQL driver and HTTPS base URL,
but a pass DOES NOT assert production readiness. TLS certificate validity,
proxy headers, federation topology, signing keys, credential retention, Android
trust, Wardveil hardening, GoreeShield policy, backups, restore tests and
monitoring remain gated requirements.

The parser uses yaml.safe_load, rejects symlinks, limits file size to 1 MiB,
refuses group/other-readable secrets on Unix, and prints field-name-only errors
rather than leaking actual values. Offline tests exercise unsafe options
without accessing private homeserver data.

These strict preview defaults may differ from intended production federation
or guest policy; any exception requires deliberate review, never silent relax.

## Optional local Compose structure guard

The offline `check_dev_compose_policy` refuses public IPv4/IPv6 port
publishing, ambiguous numeric or malformed mappings, additional unreviewed
services, host network/PID/IPC sharing, privilege escalation, added devices
or Linux capabilities, automatic restart, missing no-new-privileges, and
unexpected host volume mounts. Local TCP port 8008 must be explicitly mapped
to loopback only; regular and long Compose port syntax are supported.

Private homeserver config and the optional Compose file are now read by
`os.open` with no-follow semantics on supported POSIX hosts, validated
as regular files via `fstat`, and parsed from a single bounded opened
descriptor. Homeserver secrets must be mode 0600 or stricter. A malformed
or swapped final symlink fails closed. This still cannot prove security of
path ancestors, actual runtime network exposure, TLS/certificates, all
Compose features, nested/merged Compose overrides, or a real deployment.
An operator must separately review all effective Docker configuration.

Unit tests use synthetic in-memory Compose objects and synthetic private
configuration files. No production YAML, secret, signing key or PostgreSQL
credential is ingested by these tests. The default CLI remains
`--mode local`; production mode stays only a static config preflight,
not production acceptance.


## No implicit source build or mutable image pull

The local Compose previews intentionally contain no `build:` section
and set `pull_policy: never`. The regular development preview uses
the reviewed immutable official Synapse 1.163.0 Linux/amd64 image
digest; the source preview references only a separately built,
locally tagged image. Neither Compose file may quietly pull a mutable
registry tag or execute the vendor Dockerfile via Compose.

Static checks audit both fields and the expected official/source
image identifiers. The source-image build script requires explicit
upstream-risk acknowledgment. These controls do not yet establish
a reproducible or secure source-built image: the upstream Dockerfile
still contains mutable bases, a remote installer and a floating Rust
toolchain, which remain release blockers.
