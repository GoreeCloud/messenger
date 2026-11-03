# Messenger architecture and protocol milestone gates

## Foundation

`web/`: dependency-free, accessible web presentation and ephemeral conversation state.

`src/protocols.mjs`: pure, platform-neutral delivery policy. Every candidate needs verified capability. Default secure mode requires explicit DATA cryptographic verification (not an unauthenticated encryption flag); SMS/MMS/RCS remain non-E2EE candidates until approved adapters exist; fallback requires explicit policy and ciphertext-to-plaintext confirmation.

`src/matrix.mjs`: minimal Matrix Client-Server adapter for **testing plaintext**. The connector uses HTTPS origin validation, bearer headers, request timeout, no redirects, no HTTP caching, bounded reads, session-only secrets, fresh encryption-state inspection before plaintext reads/sends, cancellation on disconnect, and an idempotency transaction ID per message. This client-server security-state check cannot be atomic with a subsequent message PUT. It intentionally refuses encrypted or unknown-security rooms.

`src/outbox.mjs`: bounded in-memory outbox that coalesces concurrent duplicate submits, keeps stable Matrix transaction identifiers for uncertain retries, requires consent on every dispatch and cannot persist plaintext to disk. It is not an offline durable queue and does not guarantee exactly-once across devices, process restarts or homeserver TTLs.

## Planned production architecture (not implemented)

1. **Domain:** immutable message ID, protocol/security state, delivery receipts, conversation membership, attachment descriptors, idempotency and audit-safe diagnostics.
2. **Secure DATA:** vetted Matrix Rust crypto bindings or an audited equivalent with authenticated devices, key verification, cross-signing, secure backup, forward secrecy, recovery and migration testing. Never claim E2EE solely because HTTPS is used.
3. **Android SMS/MMS:** A native Java Android preview now delegates text composition to the installed messaging app (no SMS permissions or role takeover). A future, separately gated full handler requires the Android default SMS role, Telephony APIs, inbound SMS/MMS persistence, subscription selection, denial recovery and carrier-specific tests. No SMS/MMS support from browsers or iOS third-party apps.
4. **RCS:** only legitimate operator/system-privileged interfaces or a provider-authorized bridge; never automate/scrape Google Messages or imply a public third-party RCS API exists. Obtain access and compatibility evidence before enabling.
5. **Cross-platform:** native platform packages and a shared protocol/policy model. Web is a supplemental surface, not a native mobile substitute.
6. **Operations:** self-hostable Matrix/Synapse services with secure DNS, TLS, access control, backups, retention, rate limits, monitoring, abuse controls and documented data ownership.
7. **GoreeCloud:** GC UI Foundations verified package, Identity/Wardveil/GoreeShield/Mesh integration only through actual supported interfaces.

## Release acceptance gates

- **G1:** UI, routing tests and accessibility smoke tests; carrier modes visibly unavailable.
- **G2:** Matrix E2EE initialization and key/device recovery, identity verification, encrypted media, security regression tests. Disable test plaintext mode for production releases unless explicitly approved.
- **G3:** Native Android SMS/MMS receive/send with dual SIM, default handler migration and on-device tests.
- **G4:** Authenticated RCS service integrations with verified interoperability and fallback testing.
- **G5:** Native clients, cross-device encryption, backup/restore, reliability and self-hosted operations with external security review.

## Transport security matrix

| Transport | Browser foundation | E2EE assertion |
|---|---|---|
| LOCAL | In-memory only; no network | No |
| DATA (Matrix plaintext room) | Test-mode text read/send after opt-in | **No** |
| DATA (encrypted Matrix room) | Locked, cannot read or send | No unsupported assertion |
| RCS | Adapter unavailable | None |
| MMS | Adapter unavailable | No |
| SMS | Adapter unavailable | No |

A Matrix homeserver's state response is not itself sufficient proof of trustworthy encryption or verified recipients. Production security needs cryptographic session validation, key verification, account recovery and adversarial testing.

**E2EE integration specification:** [DATA-E2EE-GATE.md](DATA-E2EE-GATE.md) documents required upstream SDK, verification, recovery and release acceptance gates.

## Cycle 3 preview quality work

`src/timeline.mjs` merges bounded Matrix server history with pending and failed local sends. Reconciliation requires the server event ID from the original send response; it does not equate same-text messages with the same event. `src/drafts.mjs` keeps the current composer value for each conversation in volatile tab memory. The connection lifecycle clears account-specific drafts. `src/crypto-store-lease.mjs` is an isolated, currently unused Web Locks guard for a future Rust crypto store integration; E2EE remains blocked.

`src/session-epoch.mjs` owns monotonic invalidation tickets for asynchronous work. `web/app.mjs` uses separate connection and timeline epochs to avoid reconnecting from stale authentication results or overwriting a switched account's messages.

## Native Android preview boundary

`android/` uses Android Gradle Plugin 8.13.2 and an original native Java Activity. `Intent.ACTION_SENDTO` with a validated `smsto:` recipient hands composition to the installed SMS app. The delegated app independently controls send confirmation, SIM, transport and persistence; **GoreeCloud does not send or receive carrier messages**. No dangerous SMS permissions, default role request, SMS/MMS receivers, hidden APIs, or third-party code are present. See [Android developer preview](../android/README.md).

## Hermetic browser-to-Matrix integration verification

The dependency-free Chromium test (`scripts/browser-smoke.mjs`) now runs a synthetic loopback Matrix Client-Server fixture and tests the actual web interface through fetch, authentication, room state, plaintext read/send, simulated server failure, same-transaction retry, event-id reconciliation, XSS-safe rendering, encrypted-room refusal and stale session cancellation. This fixture is test-only; it does not implement a production homeserver. The browser-bound Matrix `fetch` receiver is explicitly bound to the global environment (see `tests/matrix.test.mjs`) to avoid a browser-only illegal invocation. Do not interpret fixture success as a live Matrix homeserver, cryptographic E2EE or mobile carrier acceptance.
