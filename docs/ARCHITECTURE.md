# Messenger architecture and protocol milestone gates

## Foundation

`web/`: dependency-free, accessible web presentation and ephemeral conversation state.

`src/protocols.mjs`: pure, platform-neutral delivery policy. Every candidate needs verified capability. Default secure mode requires independently verified encryption; fallback requires explicit policy and ciphertext-to-plaintext confirmation.

`src/matrix.mjs`: minimal Matrix Client-Server adapter for **testing plaintext**. The connector uses HTTPS origin validation, bearer headers, request timeout, no redirects, no HTTP caching, bounded reads, session-only secrets, fresh encryption-state inspection before plaintext reads/sends, cancellation on disconnect, and an idempotency transaction ID per message. This client-server security-state check cannot be atomic with a subsequent message PUT. It intentionally refuses encrypted or unknown-security rooms.

## Planned production architecture (not implemented)

1. **Domain:** immutable message ID, protocol/security state, delivery receipts, conversation membership, attachment descriptors, idempotency and audit-safe diagnostics.
2. **Secure DATA:** vetted Matrix Rust crypto bindings or an audited equivalent with authenticated devices, key verification, cross-signing, secure backup, forward secrecy, recovery and migration testing. Never claim E2EE solely because HTTPS is used.
3. **Android SMS/MMS:** native Kotlin app, default SMS role, Telephony APIs, subscription selection and carrier-specific tests. No SMS/MMS support from browsers or iOS third-party apps.
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
