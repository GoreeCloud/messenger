# Test-only real Matrix Rust crypto IndexedDB browser probe

This isolated CI experiment bundles the exact direct `matrix-js-sdk@45.0.0` dependency and `esbuild@0.28.2` into a temporary browser test. It initializes the **actual Rust/WASM crypto** with `useIndexedDB:true`, a static, synthetic 32-byte **non-secret** key and a test-only database prefix in a temporary Chromium profile, stops the SDK, reloads the page and reopens the same store, then deletes only test-prefix databases. The local fixture intentionally does not run a Matrix homeserver, authenticate an account, start sync, send/decrypt messages, verify devices or recover keys.

No generated JS or WASM assets are committed to the public web preview. All dependencies and WASM are locally bundled for the isolated CI test and served from loopback. This experiment is **not approved for production use**, and the static test key must never be reused for real accounts.

The initial PR resolves its npm lockfile in CI. If the probe passes, review the resolved graph and commit the integrity-pinned lockfile, then remove lockfile generation from CI. Failed feasibility work remains isolated on its branch and must not be merged.

No matrix SDK or bundler is introduced into the existing dependency-free web preview. E2EE remains unimplemented.

### Browser WASM packaging note

The upstream browser entrypoint resolves `./pkg/matrix_sdk_crypto_wasm_bg.wasm` relative to its browser JavaScript module via `import.meta.url`. Because esbuild does not emit that runtime URL as a standard imported asset, the test build explicitly copies that **exact file from the pinned npm dependency** into `dist/pkg/` adjacent to the test-only browser entrypoint. It fails if the URL contract or source asset is missing, and checks the copied file length. No remote CDN or replacement WASM is permitted.
