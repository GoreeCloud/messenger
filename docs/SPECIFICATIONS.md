# GoreeCloud Messenger — Repository Specifications

Status: Development  
Canonical project record: `GoreeCloud/Projects/Project Specification — Messenger`  
Repository: `GoreeCloud/messenger`

## Product boundary

GoreeCloud Messenger is the native GoreeCloud messaging and calling application/service. It owns GoreeCloud Data messaging, conversation/message/receipt/attachment contracts, and approved client experiences. SMS, MMS, RCS, and carrier calling remain technically distinct transports and must never be mislabeled as GoreeCloud Data E2EE.

## Current implemented foundation

- Native Go domain/service/API layers for Data conversations and encrypted message envelopes.
- Authenticated sender and conversation-membership enforcement.
- Deterministic duplicate/idempotency and nonce-reuse protections.
- Authenticated delivery/read receipt contracts with monotonic state.
- Opaque encrypted attachment submission, authorized JSON/base64 fetch, metadata listing, replay-safe deletion, and raw ciphertext download.
- Local Development persistence abstractions and focused tests.

## Identity and discovery

Messenger must use GoreeCloud Identity for account/session authority and consumer username resolution. Username discovery must not create a Messenger-owned browsable account directory. The preferred contract is exact-handle resolution with explicit Identity-owned discoverability and per-service disclosure policy.

## Security and privacy requirements

- The service must not decrypt GoreeCloud Data message or attachment ciphertext.
- Encryption state must be represented only when verified by the applicable client/session protocol.
- Encrypted conversations must not silently downgrade to SMS/MMS.
- Attachment raw-byte transport must remain generic binary with no content sniffing and no server-side plaintext MIME interpretation.
- Wardveil Security, Privacy Shield, Everkeep, GoreeCloud Mesh, and GoreeCloud Identity integration are required where applicable.
- Integrated source-bearing PR #94 maps the Android client source to current Official Stable GLAZE UI V1.6 / 1.6.0 at exact release source `a7180679ea851389e0f3004515f9a25f420e716d`. Repository-local rendered, accessibility, adaptive/form-factor, localization/RTL, representative-device, performance, rollback, Human Visual Excellence, signing, release, and production acceptance remain required; source mapping alone is not conformance.

## Current acceptance boundary

This is not production-ready. Production-grade identity/device keys, cryptographic session establishment, multi-device synchronization, distributed message/object persistence, push delivery, abuse controls, carrier adapters, calling media infrastructure, client packaging, and deployment acceptance remain incomplete.