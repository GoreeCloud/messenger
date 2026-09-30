# GoreeCloud Messenger

Native GoreeCloud messaging and calling with usernames, end-to-end encryption, Data messaging, SMS/RCS integration, groups, and video calls.

## Status

Active Development — native messaging domain/service foundations, GoreeCloud Data HTTP transport, receipts, opaque encrypted attachments, privacy-controlled typing foundations, hardened single-node Development persistence, minimized runtime diagnostics, and a disconnected native Android Development client are implemented in source. Production Identity, cryptographic session establishment, connected client transport, distributed delivery/storage, durable Privacy Shield-backed preference storage, complete server bootstrap, and client acceptance remain incomplete.

The current foundation establishes the transport-provenance domain model used to keep Data, SMS, MMS, and RCS communication technically distinct. GoreeCloud Data adds encrypted-envelope validation, authenticated sender enforcement, conversation authorization, deterministic retry protection, persistence abstraction, authenticated delivery/read receipts, opaque encrypted-attachment transport, and short-lived content-free typing state. The attachment surface can submit, fetch as JSON/base64, list metadata, delete with replay-safe tombstones, and download exact ciphertext bytes without asking the server to interpret plaintext media.

The HTTP layer has one application-facing composition boundary that registers message, receipt, and attachment routes onto the same mux. Typing presence and typing-privacy preference routes are independently optional compositions under that same authenticator; neither capability is enabled merely by constructing the base Data runtime. This preserves shared `/v1/data/conversations/...` routing without creating a second authentication boundary.

The Development typing policy exposes independent per-conversation choices for publishing and observing typing state. The preference API derives the acting user from authentication, checks conversation membership, rejects request-body identity fields, and returns only the two minimized boolean choices. Its current storage implementation is memory-backed for deterministic Development validation and is not durable Privacy Shield preference persistence.

Receipt persistence can be explicitly selected as memory or hardened file-backed storage; there is no implicit durable-to-memory fallback. The development executable requires an explicit receipt-persistence environment selection. `memory` must not carry an ignored durable root. `file` requires an explicit absolute non-root persistence directory. Missing, unsupported, relative, root-level, or contradictory settings fail closed before the executable reports its development contract active.

After configuration is accepted, the executable can report a minimized categorical diagnostic containing only receipt persistence mode, implemented durability class, and configuration source. File-mode diagnostics deliberately omit the configured receipt root and any message, receipt, conversation, credential, or cryptographic content. `single-node-durable` describes the selected implementation class only; it is not a distributed-durability or production-readiness claim.

## Product principles

- Every message identifies its actual transport.
- End-to-end encryption is represented only when the application has verified that state.
- GoreeCloud Data messaging works independently of cellular service.
- Username identities are first-class and are not required to map one-to-one to phone numbers.
- Encrypted GoreeCloud conversations do not silently downgrade to SMS or MMS.
- RCS is integrated only where supported platform and carrier APIs legitimately allow it.
- Voice and video calling remain distinguishable from carrier calling.
- Delivery/read state is recipient-authenticated and is not presented as carrier or cryptographic proof.
- Attachment services transport opaque ciphertext and do not decrypt user content.
- Typing presence remains content-free, short-lived, participant-authorized, and independently privacy-gated for publish and observe behavior.
- Operational diagnostics must minimize sensitive configuration and communication data.
- Current Official Stable GLAZE UI V1.6 / 1.6.0 plus GoreeCloud Manager, Privacy Shield, Wardveil Security, Everkeep, GoreeCloud Mesh, GoreeCloud Identity, GoreeCloud Policy, and GoreeCloud Observability are substantive platform integration requirements for applicable surfaces. Integrated source-bearing PR #94 maps the Android client source to exact V1.6 Stable release source `a7180679ea851389e0f3004515f9a25f420e716d`, while Messenger-local application acceptance remains blocked.

## Repository layout

- `cmd/messenger/` — development executable for exercising core contracts and validating explicit receipt-persistence process configuration
- `internal/domain/` — transport, encryption, identity, conversation, message, call, Data-envelope, receipt, attachment, and typing contracts
- `internal/service/` — GoreeCloud Data, receipt, attachment, typing, typing-privacy, persistence, and authorization boundaries
- `internal/api/` — authenticated HTTP transport plus the unified application-facing Data route-composition boundary and optional typing/privacy routes
- `internal/runtimeconfig/` — fail-closed process configuration derivation and minimized diagnostic projection for currently implemented runtime options
- `docs/architecture.md` — product architecture and trust boundaries
- `.github/SECURITY.md` — encryption, security, and vulnerability-reporting constraints
- `docs/data-messaging.md` — Data service authorization, storage, retry, and carrier-separation contract
- `docs/data-http-api.md` — HTTP API, authentication, authorization, receipt, attachment, runtime composition, and privacy boundary
- `docs/durable-receipt-store.md` — file durability, runtime selection, and environment-configuration boundaries
- `docs/runtime-diagnostics.md` — minimized runtime configuration diagnostic and non-disclosure boundary
- `client/android/` — disconnected original native Android Development client with fail-closed messaging authority boundaries and exact-artifact validation

## Documentation

- [docs/USER-MANUAL.md](docs/USER-MANUAL.md)
- [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md)
- [docs/FEATURES.md](docs/FEATURES.md)
- [docs/IMPLEMENTED-FEATURES.md](docs/IMPLEMENTED-FEATURES.md)
- [docs/PLANNED-FEATURES.md](docs/PLANNED-FEATURES.md)
- [docs/CHANGELOGS.md](docs/CHANGELOGS.md)
- [docs/BENEFITS.md](docs/BENEFITS.md)
- [docs/COMPETITIVE-OBJECTIVES.md](docs/COMPETITIVE-OBJECTIVES.md)
- [docs/BRANDING.md](docs/BRANDING.md)
- [docs/NOTES.md](docs/NOTES.md)

## Client status

A native Android Development client is present as a disconnected, fail-closed shell. It has no production account, network/message transport, durable message storage, active E2EE provider, carrier authority, or Send control. It exists to validate native client structure, communication provenance, independent readiness authorities, the V1.6 presentation-source mapping, lifecycle behavior, and artifact provenance without manufacturing messaging capability.

Additional tablet, desktop Linux, and other approved clients remain planned. All clients must consume shared transport, identity, privacy, security, recovery, policy, observability, and messaging contracts rather than redefining them independently. Consumer username resolution remains a GoreeCloud Identity-owned exact-handle disclosure concern rather than a Messenger-owned account directory.

## Current limitations

This repository remains Development. The Android shell is source-present but disconnected and not production accepted. The repository does not yet establish production-grade Identity sessions, device/key lifecycle, end-to-end cryptographic session establishment, connected Android message transport, distributed message delivery, production object storage, push notification delivery, durable Privacy Shield-backed typing preference storage, production presence fan-out/offline synchronization, anti-abuse/rate-limit acceptance, carrier adapters, calling media transport, Messenger-local Glaze UI acceptance, or production deployment evidence.

The unified Data handler is a composition boundary, and the command-level environment parser supplies a strict receipt-persistence selection contract with a minimized categorical diagnostic. The current executable still does not assemble the complete Data runtime dependencies, credentials/Identity boundaries, TLS, service lifecycle, production health/readiness monitoring, migration, and deployment configuration needed for a production server.

## License

GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).