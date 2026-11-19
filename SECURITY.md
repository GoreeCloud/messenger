# GoreeCloud Messenger security and responsible disclosure

GoreeCloud Messenger is an **experimental source preview**, not an audited,
independently verified, or production-ready secure messaging application. It
must not be represented as Signal-equivalent security.

For a possible vulnerability, avoid publishing exploits, passwords, recovery
keys, devices, message plaintext, or personal information in public issues
and pull requests. Use GitHub's private vulnerability reporting mechanism on
the GoreeCloud/messenger repository when available, or contact the repository
maintainer through a verified private channel. Do not create or guess private
email addresses or submit third-party credentials as proof of impact.

The security threat model, local encrypted storage caveats, and outstanding
release gates are documented in docs/SECURITY.md. Never claim a dependency
advisory check, SBOM, simulator build, signed debug APK or source digest is
an independent security audit.

Supported runtime releases: none; the repository is still alpha development.
Source changes pass PR-gated web, Android and backend checks. Dependabot
creates update proposals for review; the separate scheduled GitHub Actions
advisory workflow runs production npm audit, produces a seven-day CycloneDX
web dependency SBOM, and repeats vendored-source provenance checks. It does
not deploy, publish, or automatically merge releases.

Security bugs should receive a risk-ranked fix and an evidence-backed test;
sensitive disclosure details remain private until coordinated publication.
