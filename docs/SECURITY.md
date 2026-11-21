# Security posture and limitations

**Experimental preview. Not audited, accepted, or fit for sensitive production use.**

### Present mitigations
- HTTPS homeserver required for web, with only localhost HTTP for browser development; Android requires HTTPS without exception.
- Browser access tokens remain memory-only; Android Matrix session and SQLite crypto state are Keystore-protected in app-private, excluded-from-backup storage. No plaintext Android SharedPreferences token is used.
- Web initializes upstream Rust-backed Matrix crypto and blocks sending into rooms considered unencrypted. New rooms request encryption.
- Android now uses the upstream Matrix Rust SDK for room encryption, room timelines and encrypted sending. It refuses to send in plaintext rooms. **Android cross-device E2EE interoperability and identity verification remain untested.**
- Server dev preview binds to 127.0.0.1, not the public network.
- Message and member text is rendered as text in React rather than remote HTML.
- No intentional message/token analytics or debug logging.

### Blocking risks
1. Browser device keys disappear on reload until explicitly encrypted persistent storage is enabled; verification, cross-signing and remote key recovery are still missing.
2. Android encrypts its SQLite crypto store under a random key wrapped by Android Keystore; only the local-device wrapping/restore behavior has been exercised on hardware. Cross-device identity, cross-signing, secure server key backup and actual two-device E2EE are still absent. Signing out deletes local keys.
3. Synapse development image is an external prebuilt artifact, not a verified build from this repository's upstream source.
4. Browser XSS, malicious extensions, compromised endpoints or malicious participants can bypass plaintext confidentiality.
5. Matrix and federation reveal metadata; bridging networks additionally breaks some end-to-end trust assumptions.
6. No media encryption, background sync, resilient offline queues, authenticated notifications or anti-abuse controls have been verified.
7. Nine synthetic Android instrumentation checks (six Keystore-vault and three Compose onboarding) passed on a real phone before the latest theme change; end-to-end login/restoration, encrypted network interoperability, accessibility, load, security penetration and complete Synapse disaster recovery have NOT been verified.
8. Homeserver registration policy, TLS, federation, storage, key management, monitoring and rate limits require separate acceptance.

### Stable acceptance gates
- Two-device encrypted round-trip, device verification, cross-signing and successful key recovery across app restart.
- Tests for lost keys, wrong homeservers, tampering, token revocation and plaintext downgrade prevention.
- Locked dependency audit, SBOM, source provenance, third-party licensing review and security review.
- Native Android device, permissions, network and accessibility tests.
- Verified Synapse source build, secure database, TLS, backups, restore and staged rollback.
- Independent security assessment before real use.

Never include private accounts, passwords, access tokens, signing keys or messages in public issues. Treat all upstream code and dependencies as untrusted until verified.

See [Android encrypted storage](ANDROID_LOCAL_STORAGE.md) for the data-at-rest protection, verified device tests and remaining limits.

Offline backup-input hash/size and safe scratch-copy verification are now
covered by [synthetic rehearsal checks](SNAPSHOT_RESTORE_REHEARSAL.md).
The actual PostgreSQL/Synapse service restore, media/key recovery and
production backup acceptance gates remain open.

Browser UI SDK error redaction now uses **exact messages from a controlled
allowlist**, not prefix matching. Prefix-matching arbitrary upstream errors
could reveal attacker-supplied identifiers or bearer credentials inside the
UI; new unit tests deliberately inject lookalike malicious error strings.
This does not remove the need for strict logging/CSP/XSS review.

## Further verified boundaries

Both clients now offer explicit incoming invitation Join/Decline controls,
never auto-join a room, and never treat an invitation as proof of trusted
E2EE. They search only already loaded messages locally, without forwarding
search terms to a separate service. The browser validates invitation and reply mutations against room encryption and expected IDs.
Reactions are blocked because the reviewed SDK reaction transport exempts m.reaction from encryption.
Its encrypted-room timeline also refuses server-injected plaintext
message/reaction envelopes that merely resemble decrypted E2EE events.

The official GoreeCloud UI source-pinned web tokens and Android Expressive
theme are presentation foundations, not security or privacy mechanisms.
The browser CSP Caddy example is deliberately report-only and nondeployed.

On an authorized VPS a disposable, non-networked PostgreSQL database with
invented rows was backed up and restored successfully. **No real Synapse
database, homeserver signing key, media or Matrix E2EE backup was restored**.
Real-world key recovery and verified cross-device E2EE remain release blockers.

## Native event provenance constraint

The current Matrix Rust Android FFI `EventTimelineItem.eventTypeRaw`
corresponds to its timeline **content event type**, not necessarily the
original encrypted event wire envelope. Source inspection shows it is
derived from `item.content().event_type_str()` in the Rust FFI timeline
conversion. It therefore cannot alone establish whether a room message
arrived as `m.room.encrypted` or was injected as plaintext by an
untrusted homeserver.

Do not add a misleading Android `eventTypeRaw == "m.room.encrypted"`
check: that would confuse content and wire event types and could hide
legitimate decrypted messages without supplying a security guarantee.
Until trustworthy SDK provenance is exposed and real adversarial testing
passes, Android messages should continue to state that remote device
identity is **not verified**, and this limitation remains a release risk.

## Verified browser reaction plaintext leak (disposable E2EE acceptance)

A two-account isolated HTTPS Synapse E2EE run, #44868521029, revealed
that pinned Matrix JS SDK 45.1.0 sends `m.reaction` unencrypted in
encrypted rooms. This exposes emoji choices and relation metadata. The
web client now **blocks reaction sends**, provides a clear explanation,
and does not display plaintext server-injected reactions in encrypted rooms.
The security rule is covered by tests of the actual pinned SDK route.
See [reaction encryption limitation](REACTION_ENCRYPTION_LIMIT.md).
Do not count a live plaintext reaction send as E2EE acceptance.

## Verified disposable two-account browser E2EE baseline

The protected-main manual GitHub Actions
[run #44869616763](https://github.com/GoreeCloud/messenger/actions/runs/44869616763)
completed **SUCCESS** on November 21, 2026 UTC. Disposable nonadmin
Matrix users on pinned official prebuilt Synapse 1.163.0 exchanged
authenticated encrypted text and a reply across separately initialized
Matrix Rust-backed browser clients. The strict harness verified
`m.room.encrypted` wire envelopes, independent recipient decryption,
the reply relation, refusal to send plaintext emoji reactions, and a
missing-room plaintext downgrade refusal. Local TLS was trusted within
the ephemeral job, and cleanup completed.

This does **not** certify peer-device identities, Android-to-web
interoperability, encrypted emoji reactions, key backup/recovery, source
builds, real Synapse media/database/key restores, or production safety.
Web and Android reaction sending remain disabled by PRs #70/#71.
