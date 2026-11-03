# SDK-backed secure DATA bootstrap — development milestone

**Status:** Implemented *read-only crypto initialization gate* in `src/secure-data.mjs`, NOT a working E2EE messenger. No encrypted send/decrypt, verification UI, crypto recovery, bundling or live homeserver integration has been shipped.

## Verified upstream boundary

The official maintained `matrix-js-sdk` has a Rust/WASM crypto backend and supports `createClient({baseUrl,accessToken,userId,deviceId})`, `whoami()`, `initRustCrypto()`, `getCrypto()`, `isCrossSigningReady()`, `isSecretStorageReady()`, `getActiveSessionBackupVersion()`, `getKeyBackupInfo()`, `isKeyBackupTrusted()`, `isEncryptionEnabledInRoom()` and `getUserVerificationStatus()`. See the official SDK reference: https://matrix-org.github.io/matrix-js-sdk/ .

- The first-party bootstrap expects a **vetted and pinned** `createClient` factory injected by a future trusted application bundle. It deliberately does **not** load an external CDN, import an unpinned npm dependency or add crypto WASM to the existing plaintext web preview.
- The browser must have a secure context, persistent IndexedDB and an exclusive Web Locks lease. The lease is acquired before the SDK client is created and held for its lifetime; other cooperating tabs are rejected.
- `whoami().user_id` **and** `whoami().device_id` must match the configured Matrix identity before Rust crypto initialization.
- The bootstrap uses persistent IndexedDB and activates the SDK's `globalBlacklistUnverifiedDevices` defense-in-depth setting. It refuses partial SDK interfaces and cleans up the client/lease on failed initialization.
- The read-only `inspectRecovery()` reports whether cross-signing, secret storage and an active trusted matching key backup are reported by the SDK. The read-only `inspectRoom()` can examine reported encryption and cross-signing-verified participant identities, but **neither ever authorizes encrypted sends**.
- The object exports no `send` or `readMessages` method. Even if every SDK status claims success, the response remains `{status:"blocked",canSend:false}` pending audited device verification, recovery and real encrypted communication tests.
- The bootstrap module itself is only unit-tested against synthetic SDK mocks. A **separate test-only** CI workspace now initializes the real pinned Matrix Rust/WASM SDK in Node's ephemeral memory mode; it does not call this bootstrap, provide browser IndexedDB crypto, connect real users or prove E2EE send/decrypt. Do not describe this milestone as genuine cryptographic integration, end-to-end encryption, production protection, or proof of identity.

## Still required (P0 GitHub issue #2)

1. Pin and review the maintained SDK and its transitive dependencies, license, crypto WASM and bundler integrity; verify the compiled package and security headers without fetching code at runtime.
2. Build a secure account login flow that binds a server-issued device ID; implement one-client/one-crypto-store recovery for account and device changes, logout and store lifecycle.
3. Verify cross-signing and device trust through real SAS/QR verification UX. Add participant device enumeration and identity-change warnings; never treat an unverified device as trusted.
4. Establish secret storage, backup version/key trust, recovery key export and **actual restore on a second device**.
5. Implement encrypted send, decrypt, encrypted attachment handling, event shield status, and end-to-end tests against an authorized disposable Matrix homeserver with at least two accounts and devices.
6. Complete threat model, independent security review, browser/CSP/storage hardening and production acceptance. Do not remove the existing plaintext-preview warnings until proven.

Run `npm run check` and `npm test`. The source module is intentionally dormant and cannot initialize without a future approved SDK consumer.

## Pinned SDK probe provenance

`integration/matrix-sdk-smoke/package.json` requires exact `matrix-js-sdk@45.0.0`. Its `package-lock.json` contains 16 transitive/direct installed package records with specific integrity hashes, including `@matrix-org/matrix-sdk-crypto-wasm@18.9.0`. The CI runs `npm ci --ignore-scripts`, `npm audit --omit=dev --audit-level=high` and the Node Rust/WASM API probe. This dependency graph is **test-only**; no browser bundle or live secure messaging integration has been approved.

## Room membership trust boundary

The inspector now reads `getJoinedRoomMembers(roomId)` from the injected official Matrix SDK and checks **all** reported joined user identities, including its own account. Caller-supplied peer lists are explicitly refused so a caller cannot omit unverified users and mislabel the result. Missing/malformed responses or identity changes fail closed. It still does **not** enumerate every device, establish real server honesty, or permit any message to be sent. A malicious server can misreport membership; any production secure path must combine membership, device-key verification, identity pinning and actual encrypted roundtrips.

## Session lifecycle, close races and stale trust data

Concurrent calls to `close()` now await the **same** client shutdown and exclusive-store lease release. In-flight room membership, peer verification and recovery inspection revalidate session liveness after every asynchronous SDK call; if the client closes, the caller receives a generic `SESSION_CLOSED` error rather than stale trust data. The lease is released even if SDK shutdown fails. Synthetic tests reproduce delayed membership and backup responses, concurrent shutdown and failed shutdown. This is a safety boundary for future integration, not an encrypted messaging implementation.

## SDK 45 verification-status compatibility

The read-only inspector now uses exactly the supported `UserVerificationStatus` contract: `needsUserApproval === false` and `isCrossSigningVerified() === true`. It does **not** invent or require a `known` property. Missing SDK methods or undefined approval fields fail closed. This only describes **user identity** verification, not per-device trust; all sends remain disabled. The isolated real-SDK smoke also validates `getJoinedRoomMembers` and the writable `globalBlacklistUnverifiedDevices` property. See https://matrix-org.github.io/matrix-js-sdk/classes/crypto-api.UserVerificationStatus.html and https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html .

## Real browser primitive checks

The existing Chromium smoke now imports the **unused** `acquireCryptoStoreLease` helper in a secure loopback origin and exercises the browser's actual `navigator.locks` manager: one exclusive owner holds the lock, a concurrent request is refused, and the lock becomes available again after release. It also writes a **synthetic marker only** to a disposable IndexedDB database, reloads the page, verifies persistence, and deletes the database. This verifies browser primitives and cleanup, **not** the actual Matrix Rust IndexedDB crypto store, encryption or recovery. The future SDK browser-bundle integration and device acceptance remain open.

## Independent browser-tab contention

The Chromium test now creates a **separate Chrome DevTools Protocol page target** using the same browser profile and origin, acquires the exclusive crypto-store Web Lock in that tab, verifies the first tab is denied, releases the second tab and verifies the first can acquire it. This tests actual per-origin cross-tab Web Locks coordination, not a deployed multi-device Matrix client or actual Rust encrypted key persistence.

## Mandatory encrypted-at-rest crypto store key

The official Matrix SDK explicitly states that persistent Rust IndexedDB is **unencrypted** if neither `storageKey` nor `storagePassword` is supplied. The read-only bootstrap now **refuses initialization** unless a 32-byte, nonzero `Uint8Array storageKey` is provided by a future trusted device-secret manager. It passes a separate copy as `initRustCrypto({useIndexedDB:true,storageKey})`, clears that copy after SDK shutdown or failed initialization, and does not modify the caller-owned key buffer. The caller must arrange high-entropy generation, secure per-device persistence, backup/recovery and safe unlocking; none of those capabilities is implemented by this module. The same key must be supplied whenever that device's encrypted crypto store is reopened; an ephemeral random key generated per login would destroy recovery. Encrypted-at-rest crypto storage is a separate property from **end-to-end encrypted messaging**, which is still disabled. Reference: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#initRustCrypto .

## Per-homeserver/account/device IndexedDB isolation

The SDK accepts a `cryptoDatabasePrefix`; without an explicit value, it defaults to a shared name. Before acquiring the Web Locks lease, the bootstrap now derives a **deterministic opaque namespace** from the exact Matrix homeserver origin, user ID and device ID using browser `crypto.subtle.digest('SHA-256', ...)`. All three must match again on subsequent sessions for that device. Missing/subverted hashing fails closed before the client or store is opened. This namespace is **not secret** and is not a substitute for the separate 32-byte database-encryption key. It is versioned `goreecloud-messenger-v1-...`; changing the algorithm/prefix without a tested migration could orphan keys or cause a new device identity. Device-key and account migration/recovery remain release gates.

## First real persistent browser crypto-store feasibility checkpoint

A separate **test-only** browser workspace `integration/matrix-sdk-browser/` now uses pinned `matrix-js-sdk@45.0.0`, `esbuild@0.28.2`, and an integrity-hashed 43-package npm lockfile to bundle the official Rust/WASM library for a disposable local Chromium test. It initializes the real Rust crypto with `useIndexedDB:true`, a deterministic **synthetic** 32-byte key and synthetic namespace, stops the client, reloads the page, reopens the same IndexedDB store using the same key and deletes only its test databases. The CI job requires a clean high/critical npm audit and serves the exact WASM asset from the pinned npm package locally. This establishes test-browser **persistent SDK store reopen**, not genuine encrypted communication, independently assessed storage confidentiality, secure end-user key custody, identity verification, or key recovery. No browser bundle or static key enters the existing Messenger preview.

## Actual browser integration (test-only)

The `integration/matrix-sdk-browser/` CI fixture now links the real pinned Matrix Rust/WASM SDK into the **actual read-only `SecureDataBootstrap`** on a disposable Chromium loopback origin. It asserts fail-closed `whoami` mismatched-device rejection before opening a crypto database, exclusive Web Locks ownership, blocked recovery and room inspection, release after shutdown, and persistent per-device IndexedDB store reopen across navigation. It uses synthetic data and a test-only key, never a real account or real message. The resulting third-party browser JS/WASM bundle is temporary and is not imported or deployed by GoreeCloud Messenger. Actual user key custody, device verification, key recovery and encrypted multi-device messaging remain P0 release gates.

## Fail-closed unverified-device policy enforcement

The secure-DATA bootstrap now reads back `globalBlacklistUnverifiedDevices` immediately after setting it on the actual Matrix CryptoApi; if the SDK fails to report a strict `true`, initialization stops with `CRYPTO_POLICY_UNAVAILABLE` and releases the crypto-store lock and private key copy through its failure cleanup. A regression uses a mock SDK with a silent no-op setter. This is defense-in-depth only: enabling this SDK property does not independently prove recipient-device verification, secure message delivery, or E2EE readiness.
