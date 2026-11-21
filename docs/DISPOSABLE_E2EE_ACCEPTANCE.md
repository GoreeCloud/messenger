# Disposable encrypted Matrix acceptance — GitHub-hosted manual workflow

The native Android app, source-built Synapse distribution, key recovery and
cross-signing are **not yet accepted**. The existing
`web/scripts/e2ee-smoke.mjs` has a real Matrix two-account acceptance path,
but no disposable HTTPS credentials are installed in GoreeCloud's existing
manual `messenger-e2ee-isolated` environment.

A separate, **manual-only** workflow
`.github/workflows/e2ee-disposable-local.yml` provisions its own
ephemeral Matrix homeserver in a GitHub-hosted Ubuntu runner. This does
not touch the GoreeCloud VPS, private users, DNS, Caddy, or a personal
Matrix account. The job uses the existing protected-branch-only
`messenger-e2ee-isolated` environment, read-only GitHub permissions
and a mandatory typed **YES** acknowledgment.

## Isolation and provenance

- The verified official `matrixdotorg/synapse:v1.163.0` Linux/amd64
  manifest is pinned to immutable image
  `sha256:08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6`,
  verified through registry manifest inspection on November 20, 2026.
  This is **prebuilt official Synapse**, not GoreeCloud's source-built
  vendored Synapse image; that separate acceptance remains pending.
- Docker has **`--network none`** (no container network access
  beyond its own loopback), no published ports, no production volumes,
  no extra capabilities, no new privileges, a read-only root filesystem,
  and bounded memory/CPU/processes. A reviewed Python standard-library
  relay within the disposable container exposes only a Unix-domain
  socket under its generated, restricted test-data directory.
  The Node HTTPS proxy on host loopback uses only that specific socket.
  Neither the container nor the test relay can reach a public network.
- Synapse generates a one-job signing key and shared secret; anonymous
  signup, guests, URL previews and metrics are disabled. A disposable
  runner TLS proxy accepts only Matrix API paths, binds loopback, and
  serves a job-generated HTTPS certificate explicitly trusted via
  `NODE_EXTRA_CA_CERTS`; the test **never disables TLS verification**.
- Only a generated `@gc_alpha:localhost` and
  `@gc_beta:localhost` are registered. Random passwords are masked
  in GitHub logs and used solely in the runner process; no backups,
  conversation history, test messages or authentication credentials
  are uploaded as Actions artifacts.
- The smoke harness verifies actual encrypted wire envelopes,
  decryption by the recipient, encrypted replies, plaintext-reaction
  downgrade refusal, and missing-room downgrade refusal. Failure prints fixed redacted
  messages. A finally/trap cleanup stops the proxy and deletes the
  disposable container, runner-only Unix socket and generated test data.

## Invocation

After this workflow is **merged into protected main** and source/policy
tests pass, an authorized maintainer can manually start it:

```sh
gh workflow run e2ee-disposable-local.yml -R GoreeCloud/messenger --ref main \
  -f disposable_only_ack=YES
```

This is a **state-changing command** on an ephemeral GitHub runner, not
a local preview: run only after verifying the official image digest,
workflow code, approved permissions and protected main environment.

## Limitations and risk acceptance

A syntactically valid workflow and local unit tests are not evidence that
the live encrypted roundtrip succeeded. Record the actual GitHub Actions
run ID, results and relevant redacted failures separately. Do not promote
the app beyond experimental alpha until this roundtrip passes and native
Android cross-device E2EE, device verification/cross-signing, encrypted
key recovery, secure source-built Synapse with PostgreSQL/TLS/media
backups, dependency audit and appropriate manual security review
also pass.


## First live attempt and isolation correction

Manual GitHub Actions run `44865008742` (November 21, 2026 UTC)
**did not reach the two-user E2EE acceptance**: the disposable Synapse
container started but the health check through a Docker `--internal`
bridge and loopback-published host port failed. A separate synthetic
PostgreSQL network probe on the authorized VPS reproduced the
host-publication restriction. That probe was disposed of.

The original job also discovered a UID-991 cleanup problem with
Synapse-generated test data. The revised test removes Docker published
ports and bridge networks entirely, uses container-local loopback and a
runner-scoped Unix-domain socket, and restores the generated test-directory
ownership before deleting **only** the exact job-created temporary path.
The revised workflow must still **pass an independently verified manual
Actions run** before an encrypted roundtrip can be claimed. No prior
failed or source-only run counts as acceptance.


## Second live run: local socket visibility (not cryptography)

Run `44866044382` on protected main passed the server's internal HTTP
health check under Docker `--network none`, confirming the first
published-port dependency was removed. It then stopped at the Unix-socket
readiness gate because the runner-owned process lacked traverse permission
on the UID-991-owned synthetic data directory when it checked for the
socket. The script granted directory traversal only **after** that check.

The directory traversal adjustment now precedes the `test -S` readiness
check, while the containing runner-owned workspace stays private (0700).
A policy regression test enforces this order. Neither failed run reached
encrypted message exchange; both are setup failures rather than E2EE
interoperability findings. Another authorized, disposable main-branch run
must pass before any live E2EE acceptance claim.

## Native Node 24 module resolution acceptance

The first live run after successful disposable account registration failed
before sending messages: native Node ESM could not resolve the browser
`security.ts` module's extensionless relative import, even though
TypeScript and Vite builds passed. The source now explicitly imports
`./config.ts` (supported by the existing `allowImportingTsExtensions`
bundler configuration), and the web suite spawns native Node 24 to
ensure the module loads without Vite. The synthetic runner performs
`e2ee-smoke.mjs --help` as a non-networked import preflight **before**
pulling or starting the official Synapse container image, and rejects
any module-resolution failure without printing credentials.

This only fixes test harness startup: encrypted message and device
interop require a separately successful live manual workflow run.

## First verified two-account web E2EE test — November 21, 2026 UTC

[GitHub Actions run #44869616763](https://github.com/GoreeCloud/messenger/actions/runs/44869616763)
completed **SUCCESS** on protected main with both authorization-gate
and disposable two-account E2EE jobs successful. The test reported:

> PASS: encrypted wire envelopes, two-user decryption, encrypted reply,
> reaction plaintext downgrade refusal, and missing-room downgrade
> prevention.

The isolated server used the immutable official **prebuilt**
Synapse 1.163.0 image, two generated nonadmin accounts, local trusted
HTTPS, a network-disabled container and a job-only Unix socket. The
workflow also reported successful cleanup. This is a browser-to-browser
ciphertext text/reply baseline, not encrypted emoji reactions: the
SDK emits reaction metadata unencrypted, so PRs #70/#71 disable
these actions on both clients until a reviewed encrypted transport exists.

The historical failed setup and plaintext-reaction runs remain
preserved above as troubleshooting evidence, not successful acceptance.
Open release gates include native Android cross-device E2EE, device
identity verification/cross-signing, key recovery, source-built
Synapse, production backup restores and independent security review.
