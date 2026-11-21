# GoreeCloud Messenger

**Status: 0.1.0-alpha.0 — development source preview, not production-ready or security-audited.**

GoreeCloud Messenger is an open-source Matrix-compatible messaging project with a first-party React/TypeScript web app, Kotlin/Jetpack Compose native Android app, and separately attributed Synapse homeserver source. It combines established open-source components instead of inventing an encryption protocol.

## Implemented in this preview

| Capability | Web | Android |
| --- | --- | --- |
| Existing Matrix account login | Yes, memory-only tokens | Yes, Keystore-wrapped local session |
| Joined room list | Yes | Yes |
| Message timeline | Matrix SDK, including E2EE when crypto works | Matrix Rust SDK timeline, including encrypted-room events |
| Create private encrypted rooms | Yes | Yes, unverified E2EE runtime preview |
| Invite Matrix users | Yes | Yes, encrypted rooms |
| Incoming invitations | Explicit Join or Decline; never auto-join | Explicit Join or Decline; never auto-join |
| Search already loaded messages | Local sender/text filtering; no search endpoint | Local sender/text filtering; no search endpoint |
| Local encrypted crypto persistence | Memory-only by default; opt-in passphrase-protected IndexedDB | Non-exportable Android Keystore wraps local SQLite/session |
| Send messages | Only in encrypted rooms | Only in encrypted rooms, via Matrix Rust SDK |
| Emoji reactions | Encrypted room only | Encrypted room only, pending interoperability |
| Replies to existing messages | Encrypted room only | Encrypted room only, pending interoperability |
| Native device verification and recovery | Not yet | Not yet |
| Voice/video, media, push, moderation | Planned | Planned |

No Signal-equivalent security claim is made. Web crypto depends on the upstream Matrix Rust-backed SDK, and long-term key recovery, cross-signing and device verification are not implemented. Android now uses upstream Matrix Rust SDK crypto for room timelines and encrypted send/receive, but no two-device exchange, device verification or key recovery has been accepted. The web keeps tokens and crypto state in memory by default, with an optional passphrase-protected local Rust crypto store (not server-side key recovery). Android stores its Matrix access token only inside a Keystore-wrapped local session and encrypted SQLite device database, with no OS cloud backup; this is NOT cross-device key recovery.

## Repository

- web/ — React + TypeScript + Matrix JS SDK
- android/ — Kotlin and Jetpack Compose
- deploy/ — loopback-bound self-hosted Synapse development configuration
- third_party/synapse/ — pinned, independently licensed upstream source snapshot
- docs/ — architecture, threat model, roadmap, attribution
- .github/workflows/ — web and Android checks

## Local setup

Web requires Node 24 or a compatible current Node 22:

~~~sh
cd web
npm ci
npm run typecheck
npm test
npm run build
npm run dev
~~~

Connect to a Matrix homeserver you control or one you trust, over HTTPS. For a local-only test homeserver, see [deploy/README.md](deploy/README.md). Do not use a production account with irreplaceable encrypted history for this preview.
The pinned Synapse source build includes upstream Dockerfile network-execution
risks. Read [source-build safety](docs/SOURCE_BUILD_SAFETY.md) before any
operator-initiated build. The default source-build command remains a dry run,
and no source image has been independently accepted or deployed.

Android requires JDK 21, Android SDK platform 37/build tools 36, Gradle wrapper 9.9.1, and Material 3 1.5.0 for the pinned first-party Expressive theme:

~~~sh
cd android
./gradlew :app:assembleDebug
~~~

The debug APK is generated at android/app/build/outputs/apk/debug/app-debug.apk when the build succeeds. It includes large Matrix Rust native binaries; six isolated Keystore-vault and three Compose-onboarding checks passed on a physical OnePlus handset before the latest source-pinned GC UI theme adoption. The handset is now disconnected, and theme appearance, real-homeserver login/restore, signed distribution, secret recovery and two-device E2EE round trips remain unverified.

Passing GitHub Actions workflow runs also retain **development-only** web bundles and
Android debug APKs for seven days as CI artifacts. These are unsigned-for-release
preview outputs, not trusted production distributions.
Preview archives include a per-file SHA-256 manifest verified by CI; see
[preview artifact integrity](docs/ARTIFACT_INTEGRITY.md). Checksums are
not signatures or independent proof of build security.

## Platform alignment

GoreeCloud UI provides the verified current alpha semantic colors, spacing and typography adaptation. GoreeShield owns consent, privacy, retention and minimization; Wardveil owns defensive security; GoreeCloud Mesh owns future opt-in interoperability; GoreeCloud Identity remains a future authenticated integration and is not falsely claimed to be running.

Read [Android encrypted device storage](docs/ANDROID_LOCAL_STORAGE.md), [architecture](docs/ARCHITECTURE.md), [security limitations](docs/SECURITY.md), [roadmap](docs/ROADMAP.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

**Licensing:** Original first-party code is Apache-2.0. Vendored Synapse code remains AGPL-3.0-or-later and retains its own license and notices. Dependencies keep their respective upstream licenses. This repository has no verified production deployment, public service endpoint, Stable release, signed Android package or production monitoring/rollout automation. A weekly GitHub Actions dependency-audit workflow exists; that is not production monitoring.

## Manual E2EE acceptance testing

The opt-in two-account live-encryption test lives at web/scripts/e2ee-smoke.mjs.
It requires an isolated TLS homeserver and two disposable test accounts, never
runs in public CI, and does not save credentials or encrypted keys. See
[docs/E2EE_TESTING.md](docs/E2EE_TESTING.md) for prerequisites, limitations and
remaining cross-platform, device-trust and key-recovery acceptance gates.

## Offline backup input checking

An offline, non-destructive integrity validator for operator-prepared
PostgreSQL snapshots and optional media bundles is documented at
[Synapse restore rehearsal](docs/SNAPSHOT_RESTORE_REHEARSAL.md).
A separately tested, network-disabled disposable PostgreSQL 15.7 custom-format dump/restore using only invented rows passed on the authorized VPS. The [repeatable script and guarded synthetic restore evidence](docs/POSTGRES_SYNTHETIC_RESTORE.md) do not prove a recoverable Synapse deployment, real backup integrity, or room-key/media restoration.

## Nondeployed web security header example

A Caddy v2 staging-only, report-only CSP and browser privacy-header sample
is documented at [web security headers](docs/WEB_SECURITY_HEADERS.md).
It is not installed on the VPS or enabled in the browser bundle.

## Central GoreeCloud UI adoption (source-pinned alpha)

The browser uses the upstream generated `--gc-*` tokens and the native
Android application uses the official Material 3 Expressive Compose theme.
The first-party `GoreeCloud/gc-ui` adapter is source-vendored at a
reviewed commit (MIT), with SHA-256 pins tested in required CI.
See [official design-source provenance](third_party/gc-ui/SOURCE.md).

This follows GoreeCloud UI's alpha design system, **not** a published Stable
SDK or approved production visual/accessibility quality gate. The Android
screen now follows system light/dark appearance; the existing web preview
deliberately retains Iris/dark pending visual acceptance.
