# Security posture — foundation preview

**Release status:** Experimental; not approved for sensitive communications or production. No security audit has been completed.

## Protections implemented

- No hard-coded credentials. Matrix access token is entered explicitly and held only in the browser tab's JavaScript memory; the token field is cleared after successful connection.
- HTTPS required for remote Matrix origins; `http://localhost` and loopback are permitted for local development. Credentials are sent as Authorization headers, never URL parameters. Redirects are rejected.
- Unknown or encrypted Matrix rooms are **blocked** by the plaintext connector. A 403/timeout is **not** interpreted as proof of plaintext. Room encryption is rechecked just before message reads/sends, though the state check and send are not atomic.
- Plaintext DATA transmission requires a per-session checkbox. Every message and protocol state explicitly says not end-to-end encrypted. No automatic carrier downgrade.
- Text is inserted into DOM using `textContent`, never interpolated as HTML. Request sizes and history depth are bounded.
- Matrix room names are untrusted display labels, never authorization identifiers. The preview removes Unicode bidirectional formatting controls and text-line controls, skips malformed UTF-16 surrogates, and truncates labels at 100 complete Unicode code points; missing/blank titles fall back to the unchanged room ID. Matrix room and user IDs also reject control/bidi format characters before discovery, API navigation, or displaying timeline senders; invalid server-provided senders display as **Unknown**, never as a trusted identity or an own-message indicator. These controls mitigate spoofed display text but do not authenticate the named room or sender.
- Successful Matrix JSON responses are streamed with a 1 MiB decoded-byte ceiling and a 4,096-chunk ceiling before strict UTF-8 decoding and JSON parsing. Server-provided `Content-Length` is checked but never trusted as the sole bound; a missing body, oversized stream, malformed JSON, or successful JSON **non-object** response fails closed with a generic `MatrixError`, not an uncaught JavaScript `TypeError`. Matrix `whoami` identities must have a bounded, control-free `@localpart:server` shape before display. This is client resource hygiene, **not** proof of Matrix server trust, encrypted transport content, or production readiness.
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
- The volatile outbox rejects malformed or oversized plaintext room identifiers and Matrix event-ID acknowledgments (empty, control-bearing, non-ASCII or over 512 characters); they never become a confirmed send. Accepted acknowledgments retain only a frozen bounded `event_id`, discarding additional untrusted provider metadata, and retries keep the same transaction ID after uncertainty. This is input/receipt hygiene, **not** cryptographic event authenticity, proof of timeline synchronization, or exactly-once transport.
- `acquireCryptoStoreLease` is an unused **future integration safeguard** for cooperating tabs that would share a Matrix Rust crypto IndexedDB store. Its acquisition now has a five-second default deadline, bounded configuration, an explicit callback-less-provider refusal, and a late-grant path that immediately relinquishes the abandoned lock. [PR #43](https://github.com/GoreeCloud/messenger/pull/43) passed four PR checks and four post-merge CI workflows on source `ee664cb`. These are synthetic/browser-probe development tests, not an integrated SDK deployment. The helper does **not** establish E2EE, protect against a compromised browser or malicious lock provider, or provide crypto device verification.
- Actual mobile/browser integration, E2EE, offline durable delivery, media, SMS/MMS/RCS and multi-device recovery remain unverified and unimplemented.

## Session cancellation and account switching

The developer-preview UI now associates every connection attempt and room timeline read with a generation ticket. Disconnect closes the pending Matrix session, aborting its outstanding HTTP requests. Responses from an older connection or account are discarded rather than mutating a newly selected account; stale delivery callbacks also cannot set the new session's loading state. **Closing the client cannot undo events already accepted by a homeserver.** No security or production readiness claim is implied.

## Native Android preview safety

The native Android developer preview delegates text composition using `ACTION_SENDTO` to the device's existing SMS app. It requests no SMS permissions, reads no SMS databases, registers no SMS/MMS delivery receivers, has no network APIs or credential storage, and does not request to become the default SMS app. A recipient validator rejects URI-injection syntax and invalid numbers. The downstream messaging app controls transport selection, sending and storage; GoreeCloud does not attest to its security. No on-device permission, privacy or delivery audit has been performed.

## Browser preview CSP and framing boundary

The web preview now declares a restrictive **HTML meta Content-Security-Policy**: self-hosted JS/CSS/fonts, HTTPS Matrix origins (and explicit local development loopback), blocked objects/frames/workers and disabled form navigation; plus a no-referrer policy. The policy has no `unsafe-inline` or `unsafe-eval`. This constrains script injection but does **not** ensure a compromised homeserver, browser extension, or already-executed script is trustworthy.

**Required production server controls still absent:** set CSP as an HTTP response header, `frame-ancestors` in the response header, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, appropriate HTTPS/HSTS, cache-control for authenticated pages, and real E2EE. `frame-ancestors` and some navigation restrictions cannot be enforced by a meta tag. Static preview is not production safe.

## Browser Matrix test coverage and residual limits

The actual Chromium UI is tested against an isolated synthetic loopback homeserver, including failure/retry transactions, plaintext consent, token clearing, encrypted-room lockout, stale login cancellation, and an HTML-looking text payload that must not render as DOM markup. These tests do not exchange real secrets or messages. The Matrix client's supplied fetch method is bound correctly for browser globals. The mock is **not** a standards conformance test, independent penetration test or substitute for end-to-end encrypted multi-device testing; plaintext DATA remains unsuitable for confidential communications.

## Conservative DATA labels and room revocation

An encrypted Matrix room's state is now labeled **encryption reported**, not verified end-to-end encryption; this preview does not validate cryptographic identities. If a timeline fetch detects a changed encryption state or receives a 401/403 response, the room's cached plaintext eligibility becomes unknown, its timeline is hidden, and future sends are blocked pending a new connection and security inspection. A synthetic Chromium integration test checks these behaviors. This does not establish genuine E2EE support or eliminate the non-atomic plaintext security-state race.

## Read-only secure DATA bootstrap checkpoint

An isolated, unused `SecureDataBootstrap` guards future Matrix Rust SDK initialization with secure browser context, persistent IndexedDB, an exclusive Web Locks store lease and a matching `whoami()` account/device identity. It activates the SDK's global unverified-device blacklist and can inspect reported recovery/identity conditions, but exposes no messaging methods and **always returns canSend:false**. The existing plaintext UI does not instantiate or load this module. These gates and synthetic tests are not a deployed cryptographic implementation or proof of verified E2EE. See [secure DATA bootstrap scope](SECURE-DATA-SDK-BOOTSTRAP.md).

## Isolated Rust/WASM dependency compatibility test

A separate test-only Node 22 workspace under `integration/matrix-sdk-smoke/` installs a pinned `matrix-js-sdk@45.0.0` dependency graph from a committed npm lockfile with integrity hashes and lifecycle scripts disabled. Its CI runs a high/critical dependency audit and initializes the real Rust/WASM crypto backend with a synthetic identity in an ephemeral in-memory store. These checks do not prove vulnerability freedom, authenticated server behavior, persistent browser crypto-store safety, verified devices or a working encrypted conversation. The web and Android applications still do not import or ship the SDK. The stable release remains blocked by GitHub issue #2.

## Read-only room membership identity checks

The SDK bootstrap's future E2EE room inspector now fetches the joined member list from the SDK rather than trusting caller-supplied recipients, and requires the authenticated self identity plus every reported peer to have expected verification status. Malformed or incomplete membership is blocked. This cannot establish real device-key trust or a secure encrypted conversation, and every send is still disabled.

## Browser crypto-store prerequisites (synthetic-only)

Headless Chromium now tests real same-origin Web Locks exclusivity and reuse plus a disposable IndexedDB write/read after reload. Tests contain no accounts, messages, tokens, crypto secrets or third-party network calls. Browser primitives are necessary, not sufficient, for Matrix Rust crypto-store security; no actual Rust crypto database is opened by this test and E2EE remains inactive.

## Persistent Rust crypto store confidentiality (future-only)

Matrix SDK documents that `initRustCrypto({useIndexedDB:true})` without a `storageKey` or `storagePassword` leaves the persistent store **unencrypted**. The unused secure-DATA bootstrap now requires a nonzero 32-byte external device key, passes a cloned buffer to the SDK, and zeroes that clone when closed or initialization fails. The source input remains owned by its caller. Secure device-key generation, encrypted key custody, recovery, and actual browser Rust store testing are **not implemented**. No product claims of encrypted local storage or E2EE are made.

## Isolated persistent Matrix Rust browser-store test

The separate CI-only Matrix Rust browser probe initializes `matrix-js-sdk@45.0.0` with an explicitly supplied synthetic storage key in Chromium IndexedDB, then closes and reopens that test store after navigation. The JS/WASM bundle is built from an integrity-pinned audited npm graph and served exclusively from loopback; all test databases are disposable. **No live access token or user messages** are involved. A successful local reopen does not prove a secure release key manager, production E2EE, key backup, multi-device recovery or actual encrypted send/decrypt.

## Web plaintext timeline race hardening

The developer-only Matrix plaintext client now rechecks room encryption state **after** the timeline response returns, before any message is rendered. If a room turns encrypted or its state becomes inaccessible, the received plaintext timeline is rejected. The extra state request carries a latency cost and remains non-atomic with changes occurring afterward; it is **not** end-to-end encryption. Access tokens containing HTTP control characters are also rejected before headers are constructed.

## Plaintext Matrix room identity consistency

The developer-preview Matrix adapter now captures the selected room ID once per read/send, validates the room's basic identifier shape, and uses that captured ID consistently for the encryption-state checks, timeline URL, and plaintext PUT. A room object that changes ID or is marked encrypted while the asynchronous security check runs is rejected. The volatile outbox also refuses a changed room before dispatching and passes the transport a frozen identity snapshot instead of a caller-owned mutable UI object.

Synthetic regressions verify that switched-room sends do not issue plaintext PUTs, that mixed-room timelines are rejected, and that malformed room identifiers fail before network access. Existing outbox tests exercise normal idempotent dispatch; **a dedicated additional outbox-mutation test was not committed because the integration rejected that write**. Source review and general CI are not equivalent to full adversarial coverage.

**Residual limit:** The Matrix server can still change encryption state after the final check and before a PUT. These improvements do not provide E2EE, remote-device verification, atomic transport authorization, or confidential messaging. Use only disposable plaintext development rooms.
