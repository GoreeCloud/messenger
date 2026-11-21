# Manually running the isolated Matrix E2EE acceptance workflow

The **Messenger isolated E2EE acceptance (manual only)** workflow is not
triggered by pushes, pull requests, Dependabot, or schedules. It exists to
provide a repeatable real two-account Matrix end-to-end encryption test *after*
an isolated server and disposable test credentials have been configured.

## Set up the protected environment

1. In repository settings, configure a GitHub Actions environment named
   **messenger-e2ee-isolated**. Restrict its allowed branches to protected
   **main**; require reviewer approval where available.
2. Configure five **environment secrets**, never plaintext repository files:
   MATRIX_TEST_HOMESERVER, MATRIX_TEST_A_ID, MATRIX_TEST_A_PASSWORD,
   MATRIX_TEST_B_ID, MATRIX_TEST_B_PASSWORD.
3. Both accounts must be disposable and belong to an independently verified
   HTTPS test homeserver. Isolate the service from personal and production
   Matrix accounts. E2EE smoke tests create rooms, invite accounts and
   transmit synthetic event content; room history may remain after cleanup.
4. Run the workflow manually from protected main and type **YES** into its
   disposable-accounts acknowledgment input. The authorization gate must
   pass before the job can access environment secrets.
5. Review the resulting **isolated-e2ee-matrix-two-account-roundtrip** job.
   A pass proves the live *browser SDK* smoke script confirmed encrypted
   wire envelopes, decryption, reply, reaction and missing-room fail-closed
   behavior on those specific disposable accounts. It does NOT verify
   Android-to-web interoperability, SAS/QR identity trust, cross-signing,
   lost-device restoration or production security.

## Security and operations

- The job uses contents:read only, Node 24, the committed package lock and
  commit-pinned checkout and setup-node actions. Secrets are passed only to
  the gated test steps, never to upload-artifact.
- Untrusted upstream Matrix exception text, credentials and message payloads
  must not appear in logged script output; the smoke script outputs only
  sanitized progress and pass/fail text.
- A missing acknowledgment, non-main branch or absent environment secrets
  must **fail** rather than falsely show green. No secrets are stored by
  GoreeCloud code; the Rust crypto clients are ephemeral.
- A branch writer could modify a workflow on their branch: GitHub environment
  **deployment branch protection** and reviewers are required as independent
  safeguards. The repo cannot enforce those settings solely from YAML;
  verify environment policy in GitHub before provisioning credentials.
- Never create test credentials inside a public PR, issue, local shell
  history, terminal log or artifact. Rotate/revoke disposable account
  credentials after a compromised test environment.

**Current status:** the workflow is implemented but has NOT been executed
against a live isolated homeserver, and environment credentials are not yet
configured or verified. Local test suites only verify the safety gates.


## Verified environment access policy (November 20, 2026 local)

The GitHub repository environment named messenger-e2ee-isolated has
now been created with **protected_branches=true** and
**custom_branch_policies=false**. GitHub readback confirmed those exact
settings. At verification, there were **zero configured environment
secrets and no manual live E2EE workflow runs**.

An isolated TLS Matrix test server and disposable account secrets
still need to be provisioned, approved and verified before a real
round-trip can be attempted. The new offline policy tests also guard
workflow trigger, authorization ordering, credential isolation and
lack of artifact uploads; they cannot substitute for reading the
current GitHub environment settings or a successful live test.
