# GoreeCloud Messenger — Changelogs

**Record type:** Repository change history  
**Repository:** `GoreeCloud/messenger`  
**Lifecycle:** Development / nonconformant  
**Governing standard:** Standard — Repository Feature Tracking and Changelog Governance v1.0, effective September 22, 2026.

## 2026-09-22 — Repository feature/changelog governance migration

### Added

- `IMPLEMENTED-FEATURES.md` as the authoritative implemented-feature inventory.
- `PLANNED-FEATURES.md` as the authoritative planned/incomplete-feature inventory.
- `CHANGELOGS.md` as the authoritative repository change-history record.

### Changed

- Retired the repository `FEATURE-ROADMAP.md` control model.
- Removed the obsolete requirement to synchronize feature-roadmap authority with Google Drive.
- Preserved `FEATURES.md` as a product-facing feature description rather than lifecycle authority.
- Added an identifier-level migration ledger for legacy Drive roadmap records FR-001 through FR-013, preserving Identity, E2EE, Data transport, native-send readiness, calling, sync/recovery, and conversation obligations while reconciling stale version-specific wording to current governance.

### Lifecycle boundary

This migration is documentation/control-plane work only. Messenger remains Development/nonconformant; no production messaging, Release Candidate, Production Acceptance, or Stable claim is created by this change.

## Historical change evidence

Historical implementation and validation evidence remains preserved by Git history, merged pull requests, repository `NOTES.md`, workflow records, and product-specific governed evidence. Future material feature/change entries must be recorded here when integrated.

## Maintenance rule

Record material integrated changes here with enough exact repository evidence to distinguish implemented `main` state from draft/unmerged work. Do not promote a lifecycle or acceptance claim merely because a source change or CI run exists.