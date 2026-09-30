# GoreeCloud Messenger — Changelogs

## 2026-09-30 — Repository root-cleanliness migration

- Moved canonical human-readable Messenger records from repository root into `docs/` while retaining `README.md`, `LICENSE`, `go.mod`, `goreecloud.platform.yaml`, and machine-required controls at root.
- Promoted the existing repository security record from `docs/security.md` to `.github/SECURITY.md` and updated Platform Contract evidence paths.
- Updated README documentation navigation to the canonical `docs/` feature, specification, changelog, branding, benefits, notes, and user-manual records.
- No server/client runtime, Identity, Data, E2EE, storage, transport, release, Production Acceptance, or Stable authority changed.

**Record type:** Repository change history  
**Repository:** `GoreeCloud/messenger`  
**Lifecycle:** Development / nonconformant  
**Governing standard:** Standard — Repository Feature Tracking and Changelog Governance v1.0, effective September 22, 2026.

## 2026-09-28 — Draft first-use guidance candidate

### Added on the unmerged candidate branch

- Mandatory three-step first-use guidance with persisted interruption/resume state.
- Replayable **Help & guidance** and a global contextual-hints on/off control.
- Android runtime/JVM coverage and a fail-closed source validator that permits only three non-message guidance preference keys while continuing to reject messaging/network/credential/cryptographic storage authority.

### Validation boundary

Exact-head Messenger Foundation and Android Client/emulator workflows passed after the runtime acceptance test was narrowed from “no interaction at all” to “no messaging-authority interaction.” This remains Draft Development evidence; live Identity, Data transport, E2EE, messaging persistence, representative-device acceptance, release, production, and Stable status remain open.

## 2026-09-22 — Repository feature/changelog governance migration

### Added

- `IMPLEMENTED-FEATURES.md` as the authoritative implemented-feature inventory.
- `PLANNED-FEATURES.md` as the authoritative planned/incomplete-feature inventory.
- `CHANGELOGS.md` as the authoritative repository change-history record.

### Changed

- Retired the repository `FEATURE-ROADMAP.md` control model.
- Removed the obsolete requirement to synchronize feature-roadmap authority with Google Drive.
- Preserved `FEATURES.md` as a product-facing feature description rather than lifecycle authority.

### Lifecycle boundary

This migration is documentation/control-plane work only. Messenger remains Development/nonconformant; no production messaging, Release Candidate, Production Acceptance, or Stable claim is created by this change.

## Historical change evidence

Historical implementation and validation evidence remains preserved by Git history, merged pull requests, repository `NOTES.md`, workflow records, and product-specific governed evidence. Future material feature/change entries must be recorded here when integrated.

## Maintenance rule

Record material integrated changes here with enough exact repository evidence to distinguish implemented `main` state from draft/unmerged work. Do not promote a lifecycle or acceptance claim merely because a source change or CI run exists.