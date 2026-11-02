# Security posture — foundation preview

**Release status:** Experimental; not approved for sensitive communications or production. No security audit has been completed.

## Protections implemented

- No hard-coded credentials. Matrix access token is entered explicitly and held only in the browser tab's JavaScript memory; the token field is cleared after successful connection.
- HTTPS required for remote Matrix origins; `http://localhost` and loopback are permitted for local development. Credentials are sent as Authorization headers, never URL parameters. Redirects are rejected.
- Unknown or encrypted Matrix rooms are **blocked** by the plaintext connector. A 403/timeout is **not** interpreted as proof of plaintext. Room encryption is rechecked just before message reads/sends, though the state check and send are not atomic.
- Plaintext DATA transmission requires a per-session checkbox. Every message and protocol state explicitly says not end-to-end encrypted. No automatic carrier downgrade.
- Text is inserted into DOM using `textContent`, never interpolated as HTML. Request sizes and history depth are bounded.
- An in-memory outbox coalesces simultaneous sends with the same transaction ID, blocks changed-content reuse, and preserves the ID for manual retries. This does not guarantee cross-session exactly-once delivery. Closing a session aborts in-flight client requests; already submitted server-side writes cannot be revoked.
- Tests cover basic routing and transport authorization behavior.

## Known gaps and risks

- **No Matrix E2EE cryptographic stack.** The server can enable encryption between the state check and send; do not use this client to send confidential DATA messages.
- **No account authentication UI or secure token vault.** Use only test-account tokens; refresh or close to discard credentials. An attacker with active page script access may still read memory.
- **No persistent local database, backups, passkeys, session revocation, cross-signing or device verification.**
- No attachment parsing/download handling, CSP deployment policy, anti-phishing, notification controls or monitoring infrastructure.
- Browser extension compromise, malicious origins and third-party homeservers remain in the user trust boundary. Avoid untrusted origins.
- No RCS/SMS/MMS send/receive path; no claims of cellular or cross-device interoperability.
- No accessibility browser/device audits, native device tests or third-party security review yet.

## Before production

Implement and verify audited crypto/key management, server and device authorization, encryption at rest where applicable, independent threat modeling, privacy-retention controls, recovery tests, authenticated media, rate limiting, security headers, CI vulnerability checks, and tests against real accounts/devices. Never log tokens or plaintext user messages.

For production E2EE technical acceptance see [DATA-E2EE-GATE.md](DATA-E2EE-GATE.md).
