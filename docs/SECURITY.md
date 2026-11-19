# Security posture and limitations

**Experimental preview. Not audited, accepted, or fit for sensitive production use.**

### Present mitigations
- HTTPS homeserver required for web, with only localhost HTTP for browser development; Android requires HTTPS without exception.
- No browser localStorage token or Android SharedPreferences token persistence.
- Web initializes upstream Rust-backed Matrix crypto and blocks sending into rooms considered unencrypted. New rooms request encryption.
- Android hides encrypted message bodies and disables all sends pending native audited crypto implementation.
- Server dev preview binds to 127.0.0.1, not the public network.
- Message and member text is rendered as text in React rather than remote HTML.
- No intentional message/token analytics or debug logging.

### Blocking risks
1. In-memory web device keys disappear on reload. Secret storage, verification, cross-signing and key recovery are missing.
2. Native Android E2EE is not implemented; authentication and plain-room preview are not a secure alternative to a verified encrypted client.
3. Synapse development image is an external prebuilt artifact, not a verified build from this repository's upstream source.
4. Browser XSS, malicious extensions, compromised endpoints or malicious participants can bypass plaintext confidentiality.
5. Matrix and federation reveal metadata; bridging networks additionally breaks some end-to-end trust assumptions.
6. No media encryption, background sync, resilient offline queues, authenticated notifications or anti-abuse controls have been verified.
7. No device QA, load testing, security penetration testing, disaster recovery or backup restoration has been completed.
8. Homeserver registration policy, TLS, federation, storage, key management, monitoring and rate limits require separate acceptance.

### Stable acceptance gates
- Two-device encrypted round-trip, device verification, cross-signing and successful key recovery across app restart.
- Tests for lost keys, wrong homeservers, tampering, token revocation and plaintext downgrade prevention.
- Locked dependency audit, SBOM, source provenance, third-party licensing review and security review.
- Native Android device, permissions, network and accessibility tests.
- Verified Synapse source build, secure database, TLS, backups, restore and staged rollback.
- Independent security assessment before real use.

Never include private accounts, passwords, access tokens, signing keys or messages in public issues. Treat all upstream code and dependencies as untrusted until verified.
