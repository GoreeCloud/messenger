# GoreeCloud Messenger — Development Notes

## Current stabilization context

- Current V1.6 accessibility-context candidate projects only Android font scale, animator enablement, and touch-exploration state into the pure presentation policy. Touch exploration raises the existing interaction floor to 56 dp and enables screen-reader-optimized focus semantics; disabled Android animators request minimal motion. No message, Identity, transport, E2EE, privacy, security, recovery, policy, observability, persistence, or network authority is added. Exact-head CI and representative-device assistive-technology acceptance remain required.
- Repository lifecycle remains **Development**, overall platform conformance remains **nonconformant**, and Messenger is not Stable or production accepted.
- GitHub repository identity is now `GoreeCloud/messenger` after a repository rename. Repository ID, product identity, Android package namespaces, protocol/data identifiers, and communication authority boundaries remain unchanged; the rename does not establish runtime or release acceptance.
- Superseded documentation head `577c36669420ed689395fb752b036a38b4f1fda1` passed Platform Contract and Foundation validation but failed Android Client run `35492393753` because the SBOM provenance guard still expected the pre-rename GitHub path. Build, unit tests, debug assembly, and release assembly succeeded before that guard rejected `GoreeCloud/messenger`; the failed head remains audit evidence and is not accepted.
- Superseded documentation head `c412e7190e1aaf32504398698498dd745d5a77a6` passed Platform Contract and Foundation validation and advanced past SBOM generation, but Android Client run `35492840648` then failed because the separate build-evidence provenance guard still expected the pre-rename repository path. Build, unit tests, debug/release assembly, and SBOM generation succeeded before that second guard rejected `GoreeCloud/messenger`; the failed head remains audit evidence and is not accepted.
- Latest source-bearing stabilization baseline is `b27114a816d4c480a6b4160b5d59d43ec78860c3`, integrating PR #94 on top of the disconnected native Android Development line with exact-source CI hardening, accessibility semantics, Identity/session/device and exact-conversation authorization boundaries, and deployment/freshness-bound Data transport readiness.
- PR #79 exact source head `3cd0066c47d5c2779f4aaa231b1d220a19b0c337` passed the Messenger Foundation, Platform Contract 0.4, Android client build/evidence, and Android 16 emulator workflows before merge.
- The Android client is therefore authoritative Development source, but its disconnected/fail-closed behavior remains intentional and does not establish production messaging capability.
- Draft PR #76 and its stacked Glaze 1.4.1 lineage remain historical provenance only and must not be treated as current integration authority.

## Active stabilization observations

- The native Android client has no production account/session binding, connected message transport, durable client message storage, active production E2EE lifecycle, carrier authority, or live Send control.
- Client integration must not activate message transport, Identity, E2EE, privacy, security, recovery, policy, observability, synchronization, or delivery authority merely because UI source is present.
- The repository now declares accepted Platform Contract 0.4 structure and all nine Integral Platform Systems, while unresolved runtime systems remain explicitly blocked.
- Authoritative `main` now maps Android presentation source to exact Official Stable GLAZE UI V1.6 / 1.6.0 authority while Messenger-local rendered, accessibility, representative-device/form-factor, localization/RTL, performance, rollback, and Human Visual Excellence acceptance remain incomplete.
- Production Identity/session/device integration, accepted cryptographic session/key lifecycle, Wardveil, Privacy Shield, Everkeep, Mesh, Manager, GoreeCloud Policy, GoreeCloud Observability, protected signing/deployment, and representative target-environment evidence remain incomplete.

## Maintenance notes

Continue from authoritative `main`; do not revive or merge the stale stacked Android lineage unchanged. Preserve the disconnected/fail-closed client until authenticated transport, exact conversation ownership, cryptographic, privacy, security, policy, observability, recovery, and identity boundaries are accepted.

Any material Android source change requires fresh exact-head validation. Existing PR #79 evidence proves only the merged Development foundation at its exact source head; it does not establish future-revision, production, Release Candidate, or Stable acceptance.


## September 18 CI stabilization slice

- Android client CI now targets Ubuntu 24.04 rather than the moving `ubuntu-latest` label.
- Both Android jobs verify that the checked-out revision exactly matches the pull-request head or pushed `main` SHA before executing source.
- The build job also assembles the release variant as compilation/package-shape evidence without retaining or promoting it as a production artifact.
- These controls strengthen exact-source and build-variant evidence only. They do not activate network transport, Identity, E2EE, durable client state, Send authority, production signing, Release Candidate, or Stable status.


## Accessibility stabilization — September 18, 2026

PR #83 is integrated on `main`. The app title and major readiness/provenance/platform section headings use Android accessibility-heading semantics on API 28+, and Android 16 runtime acceptance verifies them. This does not widen messaging or platform authority.


## Foundation CI supply-chain stabilization — September 18, 2026

- PR #84 is integrated on `main`; Messenger Foundation uses Ubuntu 24.04 plus immutable checkout and setup-go commit SHAs while preserving the accepted action major versions.
- Foundation checkout now targets and verifies the exact pull-request head or pushed main revision before Go source is executed.
- This changes CI provenance only; it does not activate Data transport, Identity, E2EE, durable state, Send authority, production signing, RC, or Stable status.


## Disconnected runtime authority stabilization — September 19, 2026

- Android 16 runtime acceptance now treats the current disconnected shell as explicitly read-only: no descendant view may be clickable or long-clickable.
- The existing no-network/no-live-communication permission boundary and exact `Send`-control absence check remain in force.
- This protects the Development shell from silently acquiring user-triggered messaging authority before accepted Identity/session/device binding, exact conversation authorization, Data transport, E2EE lifecycle, durable state, Privacy Shield, Wardveil Security, Everkeep, Mesh, Manager, Policy, and Observability integration exist.
- The change does not connect Messenger, add a transport, create a Send action, or satisfy issue #78 production/release blockers.


## Identity session/device authority boundary — September 19, 2026

- PR #86 is integrated on `main` and strengthens the future GoreeCloud Identity seam so a bare authenticated state is no longer sufficient for Data messaging readiness.
- A positive Identity projection now requires both session binding and device binding to be independently reported as bound by the responsible Identity authority.
- The minimized boundary carries no principal, session, device, token, credential, or secret identifiers.
- Unit tests verify that missing session binding, missing device binding, provider failure, and explicit unauthenticated state all fail closed before the send coordinator may invoke an injected transport.
- This is Development authority-contract hardening only. The disconnected Android shell still has no production Identity adapter, network authority, Send control, durable client state, or accepted production messaging capability.

## Exact-conversation authorization stabilization — September 19, 2026

- PR #89 is integrated on `main` and strengthens the future conversation authorization seam used by Android Data messaging readiness.
- A bare VERIFIED_PARTICIPANT claim is no longer sufficient. Positive readiness also requires the responsible authorization authority to bind its decision to the current accepted Identity session/device authority, report the decision as current, and identify the exact canonical conversation scope requested by the client.
- The minimized boundary carries no participant list, principal identifier, ACL, token, credential, or reusable authorization material.
- Unit coverage fails closed for bare participant claims, missing Identity binding, stale authorization decisions, and mismatched conversation scope.
- This does not create a production authorization adapter, authenticate a user, connect Data transport, expose Send, establish E2EE, persist messages, or establish production, Release Candidate, or Stable authority.

- Superseded candidate head `f73139adf5d5d7eb0a6e67cdaee8fe23a24d34e6` failed the Android client authority-boundary guard because the required literal conversation-authority call was split across lines. The authorization logic itself had not executed; the corrected candidate preserves the strengthened fail-closed projection while restoring the repository guard-visible call shape.

- Superseded candidate head `09663a64bd9aaf66f09bfe731ac424b4189742f2` cleared the authority-boundary guard but failed unit tests because existing send-coordinator fixtures still modeled a bare positive conversation claim. The corrected candidate updates only accepted test fixtures to carry the new authorization acceptance facts and drops unaccepted authorization scope before readiness evaluation so rejected scope cannot manufacture an unrelated E2EE mismatch reason.

- Superseded candidate head `e340cbdbf30548a06e1075e569050845795d7fb6` reduced the remaining failures to two stale expectations: one transport-isolation test still used a bare participant claim, and one mismatched-conversation test expected only the cryptographic gate to reject a scope mismatch. The corrected candidate uses accepted authorization evidence when testing transport isolation and expects both independent conversation-scoped gates to fail closed when both scopes mismatch.


## Data transport current-authority hardening — September 19, 2026

- PR #91 is integrated on `main` and strengthens the existing accepted-transport projection without adding a live network adapter or widening the disconnected Development shell.
- A positive Data transport state now requires accepted configuration, Identity/authentication binding, protected-channel behavior, bounded failure policy, **current deployment/environment binding**, and **fresh acceptance evidence**.
- Missing or rejected deployment binding or stale transport acceptance fails closed to `UNKNOWN`; coordinator tests verify that neither condition can invoke the injected send transport.
- No endpoint, credential, token, certificate, Android INTERNET permission, durable queue, retry engine, Send control, production adapter, deployment, Release Candidate, or Stable authority is created.
- Current Official Stable GLAZE UI V1.6 / 1.6.0 remains the required authority; integrated PR #94 maps Android presentation source to that exact release while keeping application acceptance blocked.

- Accepted exact-head evidence for PR #91: Platform Contract run `35490212282`, Messenger Foundation run `35490212048`, and Messenger Android Client run `35490212049` all succeeded before squash merge to authoritative main commit `fa0417fcf7274fb611981af768d35b8555908c53`.


## Android GLAZE UI V1.6 source mapping integration — September 20, 2026

- PR #94 is integrated on authoritative `main` as source-bearing commit `b27114a816d4c480a6b4160b5d59d43ec78860c3`, mapping the disconnected Android presentation source from V1.5.1 to exact Official Stable GLAZE UI V1.6 / 1.6.0 release source `a7180679ea851389e0f3004515f9a25f420e716d`.
- Shared V1.6 consumer eligibility is not rebound as Messenger acceptance. The Platform Contract Glaze result becomes applicable-blocked, overall conformance stays nonconformant, and all Messenger-local rendered/device/release gates remain open.
- A pure presentation resolver adds Reduced Transparency, Reduced Motion, performance-cost, large-text, focus, and conservative target semantics without accepting message, conversation, Identity, E2EE, transport, privacy, security, recovery, policy, observability, or remote-content inputs.
- The Activity consumes only a neutral resolver result for its existing minimum interaction target. No INTERNET permission, connected transport, Send control, account/session provider, durable message storage, cryptographic session, telemetry, or optical adapter is activated.
- Retained neutral pigments and layout conveniences are explicitly Messenger-owned rather than represented as exact shared tokens.
- Accepted pre-merge evidence for exact PR #94 head `c2a54e467106184280c58fa094997d5941a5f08f`: Platform Contract run `35491709281`, Messenger Foundation run `35491709047`, and Messenger Android Client run `35491709088` succeeded, including Android 16 runtime acceptance. Post-merge Platform Contract run `35491897117`, Foundation run `35491896713`, and Android Client run `35491896747` all succeeded on exact source merge commit `b27114a816d4c480a6b4160b5d59d43ec78860c3`, including Android 16 runtime acceptance.
- Issue #78 remains open for production communication authorities and full product acceptance.


## Android V1.6 runtime text-scale candidate — September 20, 2026

- This Development branch is based on exact authoritative main `34383fa50e585fa7ebc64147b319d6448125d7aa`; no historical Android stack is reused as integration authority.
- `MessengerAndroidGlazeContext` projects only Android's local `fontScale` into the existing V1.6 large-text / extra-large-text presentation flags. Invalid configuration fails closed to the neutral default, and the 200%-class threshold follows the shared V1.6 large-text resilience boundary.
- The disconnected Activity consumes that presentation result only for existing conservative interaction targets and application-owned screen-gutter density yielding. No account/session, conversation authorization, Data transport, E2EE, message, privacy, security, recovery, policy, observability, remote-content, or networking authority is added.
- Android instrumentation adds Activity recreation regression coverage requiring the Development, Data-send-unavailable, and Not-Release-Candidate boundaries to remain visible after recreation.
- Exact-head Foundation, Platform Contract (when path-triggered), Android build/evidence, unit, and Android 16 emulator validation remain required before integration. Representative physical-device large-text/accessibility/rendered review remains separately required and this slice does not establish Release Candidate, production, or Stable status.


## Strict single-value JSON request parsing candidate — September 23, 2026

A bounded Development candidate corrects a shared HTTP parser weakness in message submission, delivery-receipt recording, encrypted-attachment submission, and typing publication. The earlier trailing-body check decoded a second value into an empty struct and rejected only a nil decode error; because unknown fields or non-object trailing values themselves produce decode errors, some extra JSON values could be ignored after an otherwise valid first request object. The candidate centralizes an EOF-only trailing check so any second JSON value or malformed non-whitespace suffix fails closed with HTTP 400, and adds endpoint regressions for all four mutation routes. This does not connect the Android client, change authentication/authorization, expose plaintext, activate Data transport, establish E2EE production authority, or satisfy physical/runtime/release/Stable acceptance. Exact-head CI, independent review, guarded merge/readback, and the existing issue #78 production blockers remain required.
