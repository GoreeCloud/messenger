# GoreeCloud Messenger — Features

## Implemented in Development source

- Disconnected native Android Development client with explicit no-account/no-network/no-message-storage presentation, transport/protection provenance examples, fail-closed Data readiness explanation, and no live Send control.
- Android source separates Identity session, exact conversation authorization, accepted GoreeCloud Data transport, and exact-conversation E2EE evidence as independent prerequisites; provider absence or error remains unknown/blocked rather than becoming readiness.
- Android Development artifact boundary keeps backup disabled, requests no Internet/contacts/SMS/phone/microphone/camera permissions, uses a distinct Development package identity, and carries adaptive, round, and monochrome launcher resources.
- Integrated PR #94 maps Android presentation source to current Official Stable Glaze UI V1.6 / 1.6.0 at exact release source `a7180679ea851389e0f3004515f9a25f420e716d` while leaving application-specific rendered, accessibility, adaptive-device, performance, rollback, Human Visual Excellence, release, and production acceptance false.
- This Development candidate projects Android `fontScale` into the presentation-only V1.6 large-text context, uses the shared 200%-class boundary for extra-large text, and lets large-text presentation yield application-owned screen gutter density without activating messaging or platform authority.
- GoreeCloud Data conversation/message domain contracts.
- Transport provenance separating Data, SMS, MMS, and RCS semantics.
- Authenticated sender and conversation authorization.
- Encrypted envelope submission and authorized history reads.
- Replay/duplicate and client-nonce protections.
- Recipient-authenticated delivery/read receipts with monotonic state progression.
- Opaque encrypted attachment upload and authorized fetch.
- Metadata-only attachment listing.
- Replay-safe encrypted attachment deletion.
- Exact raw ciphertext-byte download with generic binary transport and no content sniffing.
- Content-free privacy-controlled typing/idle signals with authenticated self-publication, conversation-membership checks, independent publish/observe policy gates, monotonic sequencing, stale-signal rejection, and a 10-second server expiry.
- Explicit optional composition of typing routes into the application-facing Data runtime under the same Authenticator boundary; typing is not enabled merely by constructing the base runtime.
- Authenticated per-conversation typing privacy preferences for the current Development memory policy, allowing a participant to independently disable publishing or observing typing presence.
- Strict typing-preference HTTP input that derives user identity from authentication and rejects request-body identity fields.
- Explicit optional runtime composition of the mutable typing-preference route, separate from the base message runtime and separate from typing-signal composition.

## Planned / incomplete

- Production GoreeCloud Identity sessions and device/key lifecycle.
- Identity-owned exact-handle username resolution integration.
- Production E2EE session establishment, verification, rotation, and multi-device state.
- Distributed message and attachment persistence/object storage.
- Push delivery, production presence fan-out/offline synchronization, and production rate limiting.
- **Durable Privacy Shield-backed** typing/presence preference persistence and native client typing/privacy presentation. The current preference store is Development memory state only.
- SMS/MMS/RCS carrier/platform adapters where legitimate APIs permit.
- Voice/video call signaling and media transport.
- Connected Android messaging/client persistence and production client packaging; current Glaze UI V1.6 / 1.6.0 rendered, accessibility, adaptive-device, performance, rollback, Human Visual Excellence, release, and production acceptance remain incomplete.
- Wardveil encrypted-object/security acceptance, Privacy Shield controls, Everkeep continuity, GoreeCloud Policy runtime integration, GoreeCloud Observability runtime integration, Manager/Mesh/Identity acceptance, and production deployment evidence.
