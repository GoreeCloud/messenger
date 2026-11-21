# Disposable E2EE test logging policy

The isolated GH-hosted `web/scripts/e2ee-smoke.mjs` does not accept
personal accounts and uses two generated disposable identities only.
However, the pinned Matrix JS SDK and Rust crypto code can produce
debug output containing room/event IDs, Curve25519 device identifiers,
encrypted Megolm session metadata and possibly upstream error details.

The harness explicitly supplies a **no-payload hierarchical logger**
to both anonymous/authenticated MatrixClient instances, so ordinary
Matrix SDK debugging messages and nested logger calls do not become
GitHub Actions logs. The harness itself publishes only constant
stage/summary statements and never dumps SDK errors, passwords, tokens,
event IDs or message bodies. Its separate native-Node runtime and
offline policy tests remain mandatory.

This is a defense-in-depth control, not a cryptographic guarantee
that every third-party module or native WebAssembly code honors the
injected SDK logger. GH tests use only disposable data and must be
audited for residual direct-console output in future SDK upgrades.
Never run the acceptance harness against real private accounts.

The action still tests actual encrypted message/reply transport,
rejects emoji reaction plaintext and missing-room downgrade, and
destroys its temporary Docker network, accounts and TLS certificate
when the runner job ends.
