# Encrypted-message integration acceptance

The repo includes a manual, opt-in live test harness. It uses two separate
disposable Matrix accounts to assert that upstream Matrix Rust-backed JS SDK
encrypts a message, a second account independently decrypts it, and the
application's missing-room send gate refuses plaintext fallback. This is NOT
a substitute for independent security review, device verification, Android
interoperability, secret backup, or lost-device recovery.

The script intentionally does not run during pull-request CI, which has no
access to the required secret accounts or authorized homeserver. CI validates
the test harness preflight and TypeScript. Passing unit tests are **not**
evidence of a passing live E2EE round trip.

## Prerequisites and usage

Provision an isolated TLS-enabled Matrix homeserver and two disposable,
distinct test accounts. Use a dedicated test network; the test creates a
private encrypted room and attempts to leave it, but its history may remain
on the server. The harness also creates temporary login devices. Do not use
personal/family accounts or a production homeserver.

Use a private shell or secret manager to supply all five variables:
MATRIX_TEST_HOMESERVER, MATRIX_TEST_A_ID, MATRIX_TEST_A_PASSWORD,
MATRIX_TEST_B_ID, and MATRIX_TEST_B_PASSWORD.

From the web directory, run:

    npm ci
    npm run test:e2ee:live

Run npm run test:e2ee:live -- --help to show requirements without loading
secrets. Optional MATRIX_TEST_TIMEOUT_MS accepts 2000–300000 milliseconds.

The test process uses memory-only crypto and never writes credentials to
the repository. No secret is intentionally logged. Do not enable verbose
network/SDK debugging or shell command tracing when supplying credentials.
Server event histories still persist and contain routing metadata.

## Required acceptance remains open

1. Successful encrypted round trip against a real isolated server.
2. Full Android-web interoperability with device-level evidence.
3. Cross-signing, QR/SAS device verification and bad-device handling.
4. Durable encrypted key backup, authenticated restoration and wrong-key cases.
5. Plaintext downgrade tests after malicious server state changes.
6. Independent threat-model and security assessment before sensitive use.

Output may only be called a live integration pass after an actual server run
succeeds. Never report a passing preflight alone as interoperable E2EE.
