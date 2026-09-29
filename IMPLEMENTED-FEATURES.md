# GoreeCloud Messenger — Implemented Features

**Record type:** Repository implemented-feature inventory  
**Repository:** `GoreeCloud/messenger`  
**Lifecycle:** Development / nonconformant  
**Authority:** Current `main` source and accepted repository evidence  
**Governing standard:** Standard — Repository Feature Tracking and Changelog Governance v1.0, effective September 22, 2026.

## Interpretation

This record describes behavior implemented in the current GoreeCloud Messenger Development source. It does **not** claim live production messaging, accepted production Identity, accepted E2EE, production deployment, Release Candidate, or Stable qualification.

`FEATURES.md` remains the product-facing feature description. This file is the lifecycle authority for what is implemented.

## Candidate-only Development capability on this branch

The current Draft onboarding candidate adds mandatory three-step first-use guidance, persisted interruption/resume state, replayable **Help & guidance**, and globally disableable contextual hints. Its preference storage is statically bounded to setup completion/current-step/hint-toggle metadata and must not persist message, conversation, account, credential, plaintext, ciphertext, or cryptographic authority. This paragraph is candidate evidence only until integration; it does not override the current-main authority rule below.

## Implemented Development capabilities

### Android client boundary

- Disconnected native Android Development client with explicit no-account/no-network/no-message-storage presentation.
- Fail-closed transport/protection provenance and Data-readiness explanation.
- No live Send control while required production authorities are absent.
- Independent prerequisites for Identity session, exact conversation authorization, accepted GoreeCloud Data transport, and exact-conversation E2EE evidence.
- Provider absence/error remains unknown or blocked rather than being promoted to readiness.
- Android Development artifact requests no Internet, contacts, SMS, phone, microphone, or camera permissions.
- Android backup remains disabled for the current Development artifact.
- Distinct Development package identity with adaptive, round, and monochrome launcher resources.
- Android presentation source mapped to Official Stable GLAZE UI V1.6 / 1.6.0 without claiming Messenger application acceptance.
- Large-text presentation context support remains presentation-only and does not activate messaging authority.

### GoreeCloud Data messaging foundation

- Conversation and message domain contracts.
- Transport provenance separating GoreeCloud Data, SMS, MMS, and RCS semantics.
- Authenticated sender and exact conversation authorization boundaries.
- Encrypted envelope submission and authorized history reads.
- Replay/duplicate and client-nonce protections.
- Recipient-authenticated delivery/read receipts with monotonic state progression.
- Opaque encrypted attachment upload and authorized fetch.
- Metadata-only attachment listing.
- Replay-safe encrypted attachment deletion.
- Exact raw ciphertext-byte download through generic binary transport with no content sniffing.

### Typing/presence Development foundation

- Content-free privacy-controlled typing/idle signals.
- Authenticated self-publication and conversation-membership checks.
- Independent publish/observe policy gates.
- Monotonic sequencing, stale-signal rejection, and bounded server expiry.
- Optional composition of typing routes into the application-facing Data runtime under the same authentication boundary.
- Authenticated per-conversation typing privacy preferences using current Development memory state.
- Strict typing-preference HTTP input deriving identity from authentication rather than request-body identity fields.
- Optional runtime composition of mutable typing-preference routes separate from the base message runtime.

## Implemented-but-not-accepted boundaries

The following foundations exist but remain acceptance-gated and therefore also appear in `PLANNED-FEATURES.md`:

- GoreeCloud Data domain/runtime foundations without a connected production transport.
- E2EE-shaped message/attachment handling without accepted production E2EE key/session lifecycle.
- Identity/authentication interfaces without accepted production Identity integration.
- Typing preference behavior backed only by Development memory state.
- GLAZE UI V1.6 source adoption without full Messenger rendered/accessibility/adaptive-device/performance/rollback/HVE acceptance.

## Explicitly not established

Current authoritative source does not establish:

- connected production messaging;
- production GoreeCloud Identity sessions or device/key lifecycle;
- accepted production E2EE session establishment, verification, rotation, or multi-device state;
- distributed durable message/attachment persistence;
- push delivery and production offline synchronization;
- accepted SMS/MMS/RCS adapters;
- production voice/video calling;
- complete Integral Platform System acceptance;
- production deployment/signing or Stable qualification.

## Maintenance rule

When an obligation in `PLANNED-FEATURES.md` is implemented and verified on the authoritative integration line, reconcile it here and record the material change in `CHANGELOGS.md`. Draft or unmerged pull requests are not implementation authority.