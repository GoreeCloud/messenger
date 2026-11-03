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
