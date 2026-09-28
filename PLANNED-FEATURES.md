# GoreeCloud Messenger — Planned Features and Open Obligations

**Record type:** Repository planned/incomplete-feature inventory  
**Repository:** `GoreeCloud/messenger`  
**Lifecycle:** Development / nonconformant  
**Authority:** Current `main` source, accepted repository evidence, and active GoreeCloud Tasks Management obligations  
**Governing standard:** Standard — Repository Feature Tracking and Changelog Governance v1.0, effective September 22, 2026.

## Interpretation

Items here are planned, incomplete, blocked, or acceptance-gated. Their presence does not imply implementation or release readiness. Partial foundations that already exist are also described in `IMPLEMENTED-FEATURES.md` for the verified portion only.

## Current stabilization obligations

- Connect a production GoreeCloud Identity adapter and verify exact account/session/device authority.
- Establish producer-authoritative exact conversation authorization in the connected runtime.
- Connect and accept the GoreeCloud Data transport without weakening the current fail-closed no-network/no-Send boundary before readiness is proven.
- Establish accepted production E2EE session creation, verification, rotation, recovery, and multi-device lifecycle.
- Add durable message and encrypted-attachment persistence/object storage with verified authorization and recovery boundaries.
- Complete production push delivery, offline synchronization, presence fan-out, and production rate limiting.
- Replace Development-memory typing/privacy preference state with durable Privacy Shield-governed persistence.
- Add connected native client messaging persistence and production packaging only after the prerequisite authority chain is accepted.
- Complete GLAZE UI V1.6 rendered, accessibility, adaptive-device, performance, rollback, and Human Visual Excellence acceptance.
- Complete representative-device, recovery, signing/distribution, Release Candidate, production, and Stable qualification.

## Planned product capabilities

- Identity-owned exact-handle username resolution integration.
- SMS/MMS/RCS carrier/platform adapters where legitimate platform APIs permit.
- Voice/video call signaling and media transport.
- Native client typing/privacy presentation backed by accepted persistence.
- Production-grade notification and offline-delivery behavior.

## Integral Platform System obligations

Evaluate and satisfy or explicitly justify the applicable state of all nine Integral Platform Systems:

- GoreeCloud Manager
- Privacy Shield
- Wardveil Security
- Everkeep
- GLAZE UI
- GoreeCloud Mesh
- GoreeCloud Identity
- GoreeCloud Policy
- GoreeCloud Observability

GoreeCloud Sync remains separately governed and must not be represented as a tenth Integral Platform System.

## Explicit non-claims

Until accepted evidence exists, this file does not claim production messaging, production E2EE, live connected Identity/Data transport, production deployment, Release Candidate, or Stable status.

## Legacy Drive roadmap migration ledger — 2026-09-22

The retired Drive roadmap used identifiers FR-001 through FR-013. Each meaningful obligation is accounted for here before Drive retirement. The ledger preserves identifier-level provenance without creating duplicate feature or Tasks Management authority.

- **FR-001 — Roadmap reconciliation control.** Migrated into this file's interpretation and maintenance rule; repository/Drive synchronization is retired.
- **FR-002 — Tasks Management routing control.** Preserved by the maintenance rule requiring actionable execution work to remain in GoreeCloud Tasks Management when applicable.
- **FR-003 — Evidence/lifecycle control.** Preserved as the requirement for authoritative implementation and verification before lifecycle promotion; the former Drive synchronization clause is superseded.
- **FR-004 — GoreeCloud Identity integration.** Still open for production account/session/device authority and Identity-owned exact-handle resolution. Development consumer boundaries do not establish live production integration.
- **FR-005 — E2EE authority and lifecycle.** Still open for reviewed production cryptographic device/session/key authority, verification, rotation, recovery, multi-device lifecycle, and exact conversation-scoped acceptance.
- **FR-006 — GoreeCloud Data transport and durable messaging.** Still open for live networking, durable messages/receipts/attachments, delivery/push/offline behavior, distributed persistence, authorization, and recovery while preserving ciphertext opacity.
- **FR-007 — Native composer/send readiness.** Still blocked until Identity, exact conversation authorization, Data transport, and active E2EE authorities are independently accepted. Existing readiness UI and explanation boundaries do not authorize Send.
- **FR-008 — Glaze UI application acceptance.** The legacy V1.3 target is superseded. Current open work is Messenger-specific GLAZE UI V1.6 rendered, accessibility, adaptive-device, performance, rollback, Human Visual Excellence, and representative-device acceptance.
- **FR-009 — Platform-system acceptance.** Still open. Earlier five-system wording is superseded by the current requirement to evaluate or satisfy all nine Integral Platform Systems where applicable: Manager, Privacy Shield, Wardveil Security, Everkeep, GLAZE UI, Mesh, Identity, Policy, and Observability; GoreeCloud Sync remains separately governed.
- **FR-010 — SMS/MMS/RCS adapters.** Still planned and allowed only through legitimate supported platform/carrier interfaces with explicit transport provenance and no silent downgrade from encrypted GoreeCloud Data communication.
- **FR-011 — Voice/video communication.** Still planned for GoreeCloud Data signaling/media transport with the applicable Identity, E2EE, privacy, security, authorization, and provenance controls.
- **FR-012 — Multi-device sync and encrypted recovery.** Still planned/open; implementation must preserve E2EE and remain consistent with separately governed GoreeCloud Sync plus applicable Everkeep and Privacy Shield requirements.
- **FR-013 — Modern conversation capabilities.** Still evidence-gated. Replies, threads, reactions, edits, deletion, search, disappearing communication, media/document exchange, and approved group/community controls may move to implemented status only as each bounded slice is integrated and accepted.

This ledger is migration evidence only. Current lifecycle truth remains the repository-native feature records and verified repository evidence.

## Maintenance rule

Move an item to `IMPLEMENTED-FEATURES.md` only after the authoritative implementation and required verification are integrated. Record material lifecycle changes in `CHANGELOGS.md`. Keep actionable execution work in GoreeCloud Tasks Management without creating duplicate task authority.

## Legacy Drive roadmap identifier traceability

This table preserves the material identifiers and source-state wording from the retired Google Drive roadmap. The current lifecycle classification and authoritative feature truth remain the `IF-*` and `PF-*` records above; this table is migration traceability only and must not be used to revive Drive as a synchronization target.

| Legacy ID | Legacy obligation | Priority | Source state at migration |
| --- | --- | --- | --- |
| FR-001 | Reconcile and maintain every current planned or recommended GoreeCloud Messenger feature from the authoritative project record and verified repository evidence in this roadmap. | High | Ongoing control |
| FR-002 | Move actionable feature obligations into GoreeCloud Tasks Management when required, preserving priority, dependency, and lifecycle disposition. | High | Ongoing control |
| FR-003 | Do not mark features implemented, complete, cancelled, or superseded without authoritative evidence and synchronized authoritative feature records under the governance in force at the time; the former Drive copy is now retired. | High | Ongoing control |
| FR-004 | Integrate production GoreeCloud Identity sessions, device identity, authorization, and Identity-owned exact-handle username resolution for Messenger. | High | Development consumer boundary implemented; production authority and live integration pending |
| FR-005 | Establish and security-review the end-to-end cryptographic device, session, key, verification, rotation, and exact conversation-scoped E2EE authority required for production communication. | High | Development acceptance and explanation boundaries implemented; concrete reviewed cryptographic authority remains pending |
| FR-006 | Implement live GoreeCloud Data networking plus production message, receipt, attachment, delivery, push, offline, and distributed persistence foundations without weakening ciphertext opacity or authorization. | High | Planned — production transport/delivery pending |
| FR-007 | Advance the native Android client from disconnected readiness evidence to a real composer/send path only after Identity, exact conversation authorization, Data transport, and verified active E2EE authorities are independently accepted. | High | Development readiness UI now explains each blocked Identity, exact conversation authorization, Data transport, and E2EE prerequisite without exposing Send; real composer/send remains blocked by FR-004 through FR-006 |
| FR-008 | Complete GLAZE UI V1.3 / 1.3.0 Adaptive Resonance rendered, accessibility, adaptive/form-factor, representative-device, performance, rollback, and release acceptance for Messenger clients. | High | Planned — application acceptance pending |
| FR-009 | Complete applicable Wardveil Security, Privacy Shield, Everkeep, GoreeCloud Mesh, and GoreeCloud Manager integrations with evidence-backed production acceptance. | High | Planned — platform-system acceptance pending |
| FR-010 | Add SMS, MMS, and RCS adapters only through legitimate supported platform/carrier interfaces while preserving explicit transport provenance and no silent encrypted-Data downgrade. | Medium | Planned — platform/carrier capability dependent |
| FR-011 | Implement GoreeCloud Data voice and video calling signaling and media transport with applicable identity, E2EE, privacy, security, and provenance controls. | Medium | Planned |
| FR-012 | Implement authorized multi-device synchronization and encrypted backup/restore/recovery behavior without weakening E2EE or bypassing Everkeep and Privacy Shield requirements. | Medium | Planned |
| FR-013 | Continue evidence-gated modern conversation capabilities including replies, threads, reactions, edits, deletion, search, disappearing communication, media/document exchange, and approved group/community controls. | Medium | Planned / Development slices as separately evidenced |
