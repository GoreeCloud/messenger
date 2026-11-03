# Test-only real Matrix Rust crypto IndexedDB browser probe

This isolated CI experiment bundles the exact direct `matrix-js-sdk@45.0.0` dependency and `esbuild@0.28.2` into a temporary browser test. It initializes the **actual Rust/WASM crypto** with `useIndexedDB:true`, a static, synthetic 32-byte **non-secret** key and a test-only database prefix in a temporary Chromium profile, stops the SDK, reloads the page and reopens the same store, then deletes only test-prefix databases. The local fixture intentionally does not run a Matrix homeserver, authenticate an account, start sync, send/decrypt messages, verify devices or recover keys.

No generated JS or WASM assets are committed to the public web preview. All dependencies and WASM are locally bundled for the isolated CI test and served from loopback. This experiment is **not approved for production use**, and the static test key must never be reused for real accounts.

The dependency graph is now **committed as a reviewed npm v3 lockfile** with 43 package records, SHA-512 integrity hashes, HTTPS registry URLs, and exact direct versions. CI runs `npm ci --ignore-scripts --no-fund` and `npm audit --audit-level=high` without regenerating the lockfile. The first successful browser Rust/IndexedDB probe was run on November 2, 2026 (America/Chicago); rerun the final pinned job before treating this checkpoint as verified.

No matrix SDK or bundler is introduced into the existing dependency-free web preview. E2EE remains unimplemented.

### Browser WASM packaging note

The upstream browser entrypoint resolves `./pkg/matrix_sdk_crypto_wasm_bg.wasm` relative to its browser JavaScript module via `import.meta.url`. Because esbuild does not emit that runtime URL as a standard imported asset, the test build explicitly copies that **exact file from the pinned npm dependency** into `dist/pkg/` adjacent to the test-only browser entrypoint. It fails if the URL contract or source asset is missing, and checks the copied file length. No remote CDN or replacement WASM is permitted.

## Real-SDK integration with GoreeCloud's fail-closed bootstrap

This test-only Chromium fixture now imports `src/secure-data.mjs` and runs it against the actual pinned `matrix-js-sdk@45.0.0` factory. A synthetic loopback `/_matrix/client/v3/account/whoami` stub returns either the expected device or a mismatched device. Tests verify that the mismatched device is denied **before** a crypto database opens, while the authenticated synthetic device initializes persistent Rust crypto with the externally supplied non-secret test key. The bootstrap holds the exclusive Web Lock throughout its SDK lifetime, denies competing owners, never authorizes a send, closes and releases the lock, and reopens the same IndexedDB store across a fresh page navigation. No access token outside the disposable fixture is used; the web preview and Android application still do not import the SDK.

The fixture also uses a same-origin restrictive CSP with `wasm-unsafe-eval`, permitting Rust WASM compilation while preventing external scripts, cross-origin fetches, and untrusted inline code. Passing this test proves SDK/bootstrap compatibility in an ephemeral browser, **not production E2EE, encrypted messages, real accounts, device verification, or recovery**.

### Wrong-key tamper/recovery safety check

In the reopened document, the fixture deliberately passes a different synthetic 32-byte crypto-store key to the real Rust SDK through `SecureDataBootstrap`. The bootstrap must fail closed, the previously initialized test database must remain present, the exclusive Web Lock must be released, and the original key must still reopen the same persistent store afterward. This test does not prove a user-facing key custody/recovery flow or protect a real account; incorrect-key and missing-key conditions must remain blocked in production until recovery is independently verified.

## Real HTTP login-cancellation regression

The isolated Chromium fixture now delays a synthetic `whoami` response, confirms the request has reached the local HTTP server, aborts `SecureDataBootstrap.open({signal})`, and verifies the pending login **never opens a Rust crypto database** and leaves the exclusive Web Lock releasable. The real Matrix SDK, loopback HTTP request, and GoreeCloud bootstrap are used together. No real credentials, user interaction, production state or encrypted messages are involved. The bootstrap still awaits a pending SDK operation before releasing its lock; this test does not assert instantaneous cancellation of an SDK HTTP request.
