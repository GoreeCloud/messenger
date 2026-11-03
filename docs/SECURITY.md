# Security posture — foundation preview

**Release status:** Experimental; not approved for sensitive communications or production. No security audit has been completed.

## Protections implemented

- No hard-coded credentials. Matrix access token is entered explicitly and held only in the browser tab's JavaScript memory; the token field is cleared after successful connection.
- HTTPS required for remote Matrix origins; `http://localhost` and loopback are permitted for local development. Credentials are sent as Authorization headers, never URL parameters. Redirects are rejected.
- Unknown or encrypted Matrix rooms are **blocked** by the plaintext connector. A 403/timeout is **not** interpreted as proof of plaintext. Room encryption is rechecked just before message reads/sends, though the state check and send are not atomic.
- Plaintext DATA transmission requires a per-session checkbox. Every message and protocol state explicitly says not end-to-end encrypted. No automatic carrier downgrade.
- Text is inserted into DOM using `textContent`, never interpolated as HTML. Request sizes and history depth are bounded.
- An in-memory outbox coalesces simultaneous sends with the same transaction ID, blocks changed-content reuse, and preserves the ID for manual retries. This does not guarantee cross-session exactly-once delivery. Closing a session aborts in-flight client requests; already submitted server-side writes cannot be revoked.
- Tests cover basic routing, transport authorization, and explicit cryptographic-verification gating. Reported encryption alone cannot make SMS/MMS/RCS an E2EE route in the current foundation.

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

## Cycle 3 boundaries — timeline and temporary drafts

- Failed/uncertain sends are retained after a room refresh, instead of silently disappearing. Timeline reconciliation only uses a returned homeserver event ID, never matching message text or timestamps.
- The tab-only draft store has a 100-record/16,000-character bound and is cleared for remote rooms on disconnect or account switch. No browser storage API is used. Refreshing or closing the tab loses all drafts.
- The volatile outbox now rejects malformed homeserver acknowledgments so they remain retriable with the same transaction ID, not silently classified as delivered.
- `acquireCryptoStoreLease` is an unused **future integration safeguard** for cooperating tabs that would share a Matrix Rust crypto IndexedDB store. It does not establish E2EE, protect against a compromised browser, or provide crypto device verification.
- Actual mobile/browser integration, E2EE, offline durable delivery, media, SMS/MMS/RCS and multi-device recovery remain unverified and unimplemented.

## Session cancellation and account switching

The developer-preview UI now associates every connection attempt and room timeline read with a generation ticket. Disconnect closes the pending Matrix session, aborting its outstanding HTTP requests. Responses from an older connection or account are discarded rather than mutating a newly selected account; stale delivery callbacks also cannot set the new session's loading state. **Closing the client cannot undo events already accepted by a homeserver.** No security or production readiness claim is implied.

## Native Android preview safety

The native Android developer preview delegates text composition using `ACTION_SENDTO` to the device's existing SMS app. It requests no SMS permissions, reads no SMS databases, registers no SMS/MMS delivery receivers, has no network APIs or credential storage, and does not request to become the default SMS app. A recipient validator rejects URI-injection syntax and invalid numbers. The downstream messaging app controls transport selection, sending and storage; GoreeCloud does not attest to its security. No on-device permission, privacy or delivery audit has been performed.

## Browser preview CSP and framing boundary

The web preview now declares a restrictive **HTML meta Content-Security-Policy**: self-hosted JS/CSS/fonts, HTTPS Matrix origins (and explicit local development loopback), blocked objects/frames/workers and disabled form navigation; plus a no-referrer policy. The policy has no `unsafe-inline` or `unsafe-eval`. This constrains script injection but does **not** ensure a compromised homeserver, browser extension, or already-executed script is trustworthy.

**Required production server controls still absent:** set CSP as an HTTP response header, `frame-ancestors` in the response header, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, appropriate HTTPS/HSTS, cache-control for authenticated pages, and real E2EE. `frame-ancestors` and some navigation restrictions cannot be enforced by a meta tag. Static preview is not production safe.
