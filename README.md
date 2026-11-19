# GoreeCloud Messenger

**Status: 0.1.0-alpha.0 — development source preview, not production-ready or security-audited.**

GoreeCloud Messenger is an open-source Matrix-compatible messaging project with a first-party React/TypeScript web app, Kotlin/Jetpack Compose native Android app, and separately attributed Synapse homeserver source. It combines established open-source components instead of inventing an encryption protocol.

## Implemented in this preview

| Capability | Web | Android |
| --- | --- | --- |
| Existing Matrix account login | Yes, memory-only credentials | Yes, memory-only credentials |
| Joined room list | Yes | Yes |
| Message timeline | Matrix SDK, including E2EE when crypto works | Unencrypted rooms only (read-only) |
| Create private encrypted rooms | Yes | Not yet |
| Invite Matrix users | Yes | Not yet |
| Send messages | Only in encrypted rooms | Disabled pending native E2EE |
| Native device verification and recovery | Not yet | Not yet |
| Voice/video, media, push, moderation | Planned | Planned |

No Signal-equivalent security claim is made. Web crypto depends on the upstream Matrix Rust-backed SDK, and long-term key recovery, cross-signing and device verification are not implemented. Android does not read encrypted content or send messages. Both clients keep access tokens in memory, not on disk; the web crypto store is memory-only and loses keys on refresh.

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

Android requires JDK 21, Android SDK 35+, and Gradle wrapper:

~~~sh
cd android
./gradlew :app:assembleDebug
~~~

The debug APK is generated at android/app/build/outputs/apk/debug/app-debug.apk when the build succeeds. Device testing and signed distribution remain outstanding.

Passing GitHub Actions workflow runs also retain **development-only** web bundles and
Android debug APKs for seven days as CI artifacts. These are unsigned-for-release
preview outputs, not trusted production distributions.

## Platform alignment

GoreeCloud UI provides the verified current alpha semantic colors, spacing and typography adaptation. GoreeShield owns consent, privacy, retention and minimization; Wardveil owns defensive security; GoreeCloud Mesh owns future opt-in interoperability; GoreeCloud Identity remains a future authenticated integration and is not falsely claimed to be running.

Read [architecture](docs/ARCHITECTURE.md), [security limitations](docs/SECURITY.md), [roadmap](docs/ROADMAP.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

**Licensing:** Original first-party code is Apache-2.0. Vendored Synapse code remains AGPL-3.0-or-later and retains its own license and notices. Dependencies keep their respective upstream licenses. This repository has no verified production deployment, public service endpoint, Stable release, signed Android package or configured ongoing automation.
