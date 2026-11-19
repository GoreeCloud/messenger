# Security posture and limitations

**Experimental preview. Not audited, accepted, or fit for sensitive production use.**

### Present mitigations
- HTTPS homeserver required for web, with only localhost HTTP for browser development; Android requires HTTPS without exception.
- Browser access tokens remain memory-only; Android Matrix session and SQLite crypto state are Keystore-protected in app-private, excluded-from-backup storage. No plaintext Android SharedPreferences token is used.
- Web initializes upstream Rust-backed Matrix crypto and blocks sending into rooms considered unencrypted. New rooms request encryption.
- Android now uses the upstream Matrix Rust SDK for room encryption, room timelines and encrypted sending. It refuses to send in plaintext rooms. **Actual E2EE interoperability and identity verification remain untested.**
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
7. Four synthetic Android Keystore tests have passed on a real phone; end-to-end login/restoration, encrypted network interoperability, load, security penetration, disaster recovery and backup restoration have NOT been verified.
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
