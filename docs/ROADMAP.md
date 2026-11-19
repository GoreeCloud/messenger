# Development roadmap

This is a priority plan, not a release claim.

## Foundation
- [x] Create a public monorepo and source for web and native Android clients.
- [x] Implement web Matrix login, room list, encrypted room creation, invites and basic messaging.
- [x] Limit web sending to encrypted rooms; keep tokens in memory and validate homeserver URL.
- [x] Native Compose login, room listing, Matrix Rust SDK encrypted-room timeline, private-room creation, invitations and encrypted send source.
- [x] Android local debug build and unit policy checks (not network/device acceptance).\n- [x] Native Android room timeline pagination with stale-callback suppression.
- [x] Adopt verified GoreeCloud UI alpha color roles for current preview.
- [x] Integrate pinned native Kotlin Matrix Rust SDK bindings and compile with upstream crypto.
- [ ] Independently verify encrypted two-account, two-device send/receive and device trust.
- [ ] Device cross-signing, key verification and secure backup/recovery.
- [x] Add an opt-in two-account E2EE integration harness with safe local preflight.
- [ ] Execute and pass the full two-user encrypted round trip against isolated Synapse.

## Messaging features
- [ ] Media, voice notes, file encryption, reactions, replies, editing and threads.
- [ ] Encrypted groups, roles and moderation.
- [ ] Voice/video using reviewed MatrixRTC, TURN and LiveKit.
- [ ] Opt-in push and GoreeCloud Notify integration.
- [ ] Offline sync, notification privacy and data portability.
- [ ] Address-book-free contact discovery and abuse prevention.

## Ecosystem integration
- [ ] GoreeCloud Identity authentication contract (no assumed deployment).
- [ ] GoreeShield privacy, retention, sharing and consent controls.
- [ ] Wardveil threat detection with no access to E2EE plaintext.
- [ ] GoreeCloud Mesh opt-in events and interoperability.
- [ ] GC UI consumer acceptance, accessibility and visual QA.
- [ ] Risk-reviewed cross-network bridge adapters, off by default.

## Stable release gates
- [ ] Source-built and hardened Synapse with Postgres and trusted TLS.
- [ ] Authenticated, verified two-device E2EE and recovery tests.
- [ ] Security assessment, dependencies and license auditing, SBOM.
- [ ] Native Android device QA, signed build and accessibility review.
- [ ] Production backup, restore, monitoring, rollback and migration drills.
- [ ] Verified branch protection, CI and sole-maintainer PR workflow.
