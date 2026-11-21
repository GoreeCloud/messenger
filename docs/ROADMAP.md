# Development roadmap

This is a priority plan, not a release claim.

## Foundation
- [x] Create a public monorepo and source for web and native Android clients.
- [x] Implement web Matrix login, room list, encrypted room creation, invites and basic messaging.
- [x] Limit web sending to encrypted rooms; keep tokens in memory and validate homeserver URL.
- [x] Native Compose login, room listing, Matrix Rust SDK encrypted-room timeline, private-room creation, invitations and encrypted send source.
- [x] Android local debug build and unit policy checks (not network/device acceptance).
- [x] Native Android room timeline pagination with stale-callback suppression.
- [x] Encrypted local SQLite key and Matrix session persistence using Android Keystore.
- [x] Six vault tests and three Compose onboarding tests passed on an actual OnePlus Android device, before the latest source-pinned GC UI theme migration.
- [ ] Verify real Android login/restore after process death and failed/offline server refresh.
- [x] Source-pin the official GoreeCloud UI alpha design tokens for web and the Android Material 3 Expressive theme, with SHA-256 verification in protected CI.
- [x] Integrate pinned native Kotlin Matrix Rust SDK bindings and compile with upstream crypto.
- [ ] Independently verify encrypted two-account, two-device send/receive and device trust.
- [ ] Device cross-signing, key verification and secure backup/recovery.
- [x] Add an opt-in two-account E2EE integration harness with safe local preflight.
- [x] Pass isolated two-account browser encrypted text/reply and reaction-downgrade-refusal acceptance (GitHub Actions #44869616763); Android and encrypted reaction interop remain pending.

## Messaging features
- [ ] Media, voice notes, encrypted attachments, message editing and threads.
- [x] Encrypted text and reply source on both platforms. Emoji reaction sends are now disabled pending proof of encrypted SDK transport.
- [x] Explicit incoming Matrix room invitation Join/Decline actions on both clients; no auto-join or unverified encryption claim.
- [x] Local-only case-insensitive search of already loaded messages on web and Android; no message indexing service.
- [ ] Implement verified interoperable encrypted emoji reactions and test ciphertext wire envelopes across two real clients; current SDK reaction exception requires fail-closed behavior.
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
- [x] An isolated PostgreSQL custom-format backup and restore of synthetic rows succeeded; the complete Synapse database/media/key restore remains unverified.
- [ ] Demonstrate Android and web ciphertext-envelope provenance under an adversarial homeserver; web has an envelope display gate, Android SDK binding provenance requires further verification.
- [ ] Prove real Matrix Rust SDK logout timeout, session/device revocation, and keystore preservation under process death; coroutine-only timeout tests do not guarantee native FFI interruption.
- [ ] Authenticated, verified two-device E2EE and recovery tests.
- [ ] Security assessment, dependencies and license auditing, SBOM.
- [ ] Native Android device QA, signed build and accessibility review (nine synthetic connected-device checks passed previously; current theme/invitation screens have not been accepted on hardware).
- [ ] Production backup, restore, monitoring, rollback and migration drills.
- [x] Verify protected main, mandatory pull requests, required web/Android/backend CI and no bypass actors.

- [x] Verify the pinned official Synapse disposable two-account browser
  E2EE baseline with independently trusted ephemeral TLS (GitHub Actions
  #44869616763, success). Source-built Synapse and Android trust gates remain.

- [x] Run the manual isolated Android 35 emulator Keystore/Compose
  instrumentation on the source-pinned GoreeCloud UI (GitHub Actions
  #44868265302, success). Real E2EE hardware testing remains pending.

- [x] Expose read-only Android Rust SDK own-identity, recovery and backup
  states with an explicit warning that peer trust and successful encrypted
  key restoration have not been verified.
- [ ] Complete independent SDK-assisted cross-signing, backup enrollment,
  recovery-key UX and a real two-device recovery roundtrip.

- [ ] Implement and verify genuinely encrypted browser reaction semantics
  before restoring emoji action buttons. The pinned Matrix JS SDK 45.1.0
  deliberately bypasses reaction encryption, so web reaction sends are
  blocked rather than leaking emoji in plaintext. Separately verify
  Android Rust timeline reactions are also now fail-closed pending ciphertext proof (PR #71).
