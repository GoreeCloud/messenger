# GoreeCloud Messenger

**One app. Four messaging protocols. Complete control.**

GoreeCloud Messenger is a privacy-first unified messaging project intended to support **RCS, MMS, SMS, and DATA**. This repository contains a **web development foundation** and a separate **native Android developer preview**. Neither is a production messenger or a complete cellular/RCS client. The feature specification in the product brief is a **roadmap**, not an implemented feature list.

## Current implementation (web development preview)

- Responsive, keyboard-accessible unified inbox shell with protocol filters, search, clear transport/security indicators, a light/dark appearance, and GC UI-inspired floating/rounded navigation.
- **Local notes:** Compose and view notes in browser-tab memory. Notes disappear on page refresh; **no persistence or encryption is claimed**.
- **DATA (limited):** Connect to a Matrix homeserver by HTTPS origin and an existing access token, inspect joined rooms, read recent plain-text events, and send text to **unencrypted** Matrix rooms **only after explicit, per-session consent**. Token and timelines stay in tab memory. Room details and operation errors are visible. An in-memory outbox coalesces concurrent duplicate attempts and retains one transaction ID for manual retries; room encryption is rechecked before each read and send. A non-atomic state-check/send race remains, so this connector is not safe for confidential messages.
- **Security gates:** Encrypted/unknown-status rooms fail closed. Unsupported RCS/MMS/SMS adapters cannot send. Default protocol routing requires independent cryptographic verification of DATA before classifying it as an encrypted route; SMS/MMS/RCS can never be promoted by a carrier-reported encryption flag in this foundation; ciphertext-to-plaintext downgrades require confirmation in transport policy (and are not implemented as automatic UI sends).
- Node-built-in tests for routing, encryption-state gating, TLS, session cancellation, duplicate-send coalescing and explicit consent, plus GitHub Actions checks. The Chromium suite also exercises a full **synthetic Matrix session** through the actual UI (connect, read, consent, retry, sync, encrypted-room lockout and disconnect).

**Critical limitation:** This version **does not provide secure DATA/E2EE**. It does not encrypt or decrypt Matrix room events, verify devices/keys, or store/restore secrets. The limited Matrix plaintext mode is for testing only. Never enter highly sensitive content into unencrypted Matrix rooms. Matrix's server can access plaintext messages; use a disposable test account. This web version **cannot** register as Android's default SMS application and **does not** implement SMS, MMS or carrier RCS. The separate Android app is intentionally not eligible for the default SMS role; it only opens the installed messaging app's compose screen.

## Native Android developer preview

The first-party [Android Java application](android/README.md) has a responsive rounded native UI and can open the installed SMS app's composer through an explicit `ACTION_SENDTO` handoff. It requests **no SMS permissions**, cannot receive/read/send SMS itself, does not replace the default SMS app, and cannot determine whether the downstream app chooses SMS/MMS/RCS. A separate GitHub Actions job compiles the app and executes JVM unit tests. No phone, SIM, carrier, or delivery acceptance is implied.

Build with Android SDK 36, JDK 17 and Gradle 8.13 using `gradle :app:assembleDebug :app:testDebugUnitTest` inside `android/`. **Do not install this preview as a default SMS handler.**

## Run locally

Requires Node.js 20+ for tests and Python 3 for static hosting.

```sh
npm run check
npm test
npm run serve
```

Open **http://localhost:4173/web/**. No npm dependencies, bundled fonts, tracking, external scripts or default backend account are required.

To test DATA, choose **Connect DATA**, enter the **origin** of a Matrix homeserver and a previously obtained token for a test user. No server is automatically created. Only rooms conclusively found to lack a Matrix encryption state event are readable; sending requires ticking the explicit plaintext consent checkbox. Close the connection to clear in-memory credentials. There is no authentication/recovery wizard yet.

## Scope and status

| Capability | Current status |
| --- | --- |
| Unified UI and protocol/security badges | Implemented web preview |
| Offline temporary personal notes | Implemented in tab memory |
| DATA via existing Matrix homeserver | Limited unencrypted testing adapter |
| End-to-end encrypted DATA | **Not implemented**; an isolated read-only SDK crypto bootstrap is now test-covered, but no SDK bundle or encrypted send/decrypt path is active |
| RCS (carriers/providers) | **Not implemented**; requires legitimate access |
| MMS and SMS | Native Android preview **delegates text composition** to the installed system messaging app; no GoreeCloud carrier send/receive adapter yet |
| Android/iOS/Windows/Linux/macOS apps | Android native developer preview source added; no on-device acceptance. Other native platforms not implemented |
| Attachments, calls, multi-device, groups admin, backup, AI | **Not implemented** |

See [architecture and gating](docs/ARCHITECTURE.md), [security posture](docs/SECURITY.md), and [the secure DATA acceptance plan](docs/DATA-E2EE-GATE.md).

## Design and integration

The project must ultimately consume the verified [GoreeCloud UI](https://github.com/GoreeCloud/gc-ui) foundations and comply with its shape/surface and accessibility requirements. The web preview now vendors the **exact semantic CSS token export** from the verified first-party [GC UI Foundations 1.0.1](https://github.com/GoreeCloud/gc-ui/releases/tag/foundations-v1.0.1) source tag and maps application colors, shapes and minimum control sizes to those tokens. The [source provenance](docs/GC-UI-TOKEN-PROVENANCE.md) and Apache-2.0 license are included. This does **not** install or support the GC UI JavaScript theme controller or component system, and design-system accessibility/visual acceptance remains **partial**.

Matrix is an independent, open messaging protocol. GoreeCloud Messenger is a first-party application, not a rebranding of the Matrix SDK or its reference clients. Upstream clients and cryptographic libraries must retain attribution and be security-reviewed before incorporation.

## Contributions

No deployment, production account, device permissions, or protected services are modified by this development foundation. Review privacy, consent and encryption-state handling before proposing live messaging changes. Do not add hard-coded access tokens, secrets or unreviewed cryptographic primitives.

## Delivery and drafting (development preview)

The web preview now keeps per-conversation drafts only in browser-tab memory. Matrix room refresh merges server events with pending/uncertain local sends using server-provided event IDs; failures remain visible for manual retry. Accepted-by-homeserver is **not** delivery to the recipient or cryptographic confirmation. Disconnect clears account drafts but retains local notes; refresh and tab close discard all drafts. A cooperative Web Locks lease helper is available for future vetted Matrix Rust E2EE integration; **no E2EE client is integrated**.

### Connection cancellation safeguards

Disconnect now cancels a pending Matrix session and invalidates its authentication and room-list results. Room timeline reads use a separate generation ticket to prevent stale account/room results from mutating the active session. These are browser-preview lifecycle safeguards, not an audited encryption implementation.

## Secure DATA bootstrap checkpoint

An optional [read-only Matrix Rust-crypto initialization boundary](docs/SECURE-DATA-SDK-BOOTSTRAP.md) now lives in `src/secure-data.mjs`. It requires a trusted, externally supplied SDK factory, secure context, persistent IndexedDB and an exclusive browser Web Locks lease, plus matching homeserver user and device identities. It can inspect reported cross-signing/secret-storage/backup trust and peer verification states; **it never authorizes a send and exports no encrypted messaging operations**. The bootstrap has synthetic unit tests, and a **separate CI-only compatibility probe** now installs and initializes the real pinned `matrix-js-sdk@45.0.0` Rust/WASM crypto in Node memory, with a committed integrity-pinned dependency lock and a high/critical dependency audit. The SDK is **not imported by the web UI**, and the web preview remains plaintext-only. Full audited Matrix E2EE with identity verification, key recovery and encrypted multi-device roundtrips is tracked in issue #2.

### Browser Rust/IndexedDB compatibility probe (test-only)

In addition to Node memory-mode Rust crypto, an [isolated pinned browser probe](integration/matrix-sdk-browser/README.md) now exercises real Matrix SDK crypto backed by temporary Chromium IndexedDB, including store reopening across navigation. It is not imported by the web app. The test uses a publicly known synthetic key; no real encryption keys, accounts or encrypted messaging have been implemented. See [E2EE release gates](docs/DATA-E2EE-GATE.md).

## Two required first-party apps: Web and Android

GoreeCloud Messenger maintains **both** its original browser app (`web/`) and its separate, native Android app (`android/`) in this repository. Neither is a substitute for the other.

- **Web app:** responsive GC UI Foundations 1.0.1 interface with memory-only personal notes and explicitly consented plaintext Matrix DATA development rooms. The plaintext adapter now rechecks room encryption state **after** timeline fetch before showing returned messages and rejects control characters in access tokens. This reduces one race but cannot make plaintext confidential or atomic.
- **Native Android app:** first-party Java Activity with native memory-only personal notes and an explicit SMS `ACTION_SENDTO` handoff. Notes are not saved to disk, synced, backed up, or preserved across Activity recreation; SMS/MMS/RCS are **not** sent or received by GoreeCloud. Android does not request dangerous SMS permissions or default-handler role.

Both apps remain development previews. Dedicated web/Android production packaging, native Matrix secure DATA messaging, verified E2EE, default SMS/MMS role and authorized RCS integration are future acceptance milestones, not shipped features.

### Web app home-screen metadata

The web client now serves a same-origin web-app manifest and SVG application icon aligned with the native Android vector. The manifest enables supported browsers to expose the correct GoreeCloud Messenger name/icon/display metadata and a scoped start URL. This is still the **development web app**: no service worker, offline cache, notification delivery, secure-background sync, stored credentials, installed-platform testing or production hosting is claimed. Browser runtime smoke checks the manifest and icon over HTTP. Use an HTTPS origin for remote hosting; the current crypto-less DATA preview remains explicitly plaintext.
