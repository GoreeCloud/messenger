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
   allow_guest_access, url_preview_enabled, report_stats,\n   enable_metrics and enable_3pid_lookup. Ensure disable_registration is\n   absent or true (its false value overrides the safe registration setting).\n   Do not configure Sentry in the local preview.
   Keep app_service_config_files absent or empty. Configure a client listener.
4. Provision the trusted PyYAML safe parser in the operator environment,
   then run:

    python3 deploy/check_homeserver.py --config deploy/data/synapse/homeserver.yaml --mode local

5. Independently review approved port publishing and reverse proxy controls.
   Both Compose files expose 127.0.0.1:8008 only on the host. The server
   container may need to listen on the container interface for mapped ports.

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
