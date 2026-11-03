# Matrix SDK Rust crypto compatibility probe (CI only)

**Status: experimental dependency compatibility test, not a secure messenger or shipped client.**

This isolated directory probes the actual upstream `matrix-js-sdk@45.0.0` Rust/WASM cryptography API, using only a synthetic Matrix identity and an **ephemeral Node in-memory crypto store** (`useIndexedDB:false`). It does not log in, start sync, send or receive encrypted messages, verify devices, create backups, exercise browser storage or contact an external Matrix homeserver.

The standalone workflow:
1. Resolves the exactly pinned **direct** SDK version and generates a package lock for the probe;
2. Installs dependencies with npm lifecycle scripts disabled;
3. Runs an npm production-dependency audit that fails on high/critical findings;
4. Initializes the real Rust crypto binding and checks the methods needed by `src/secure-data.mjs`;
5. Stores the resolved lockfile for an explicit review and eventual source pinning.

The current dependency tree is **not yet fully pinned in source** until the generated lockfile is reviewed and committed. Do not vendor or copy these packages into the web preview or ship a release based solely on this smoke. A clean audit is time-specific, not proof of a secure supply chain. SDK source: https://github.com/matrix-org/matrix-js-sdk ; official API: https://matrix-org.github.io/matrix-js-sdk/.

## Release blockers

A reviewed and committed lockfile, provenance/known-issue review, audited WASM bundling, Web Locks backed IndexedDB lifecycle, cross-signing and SAS/QR verification, key recovery/restore and true encrypted multi-device roundtrips are needed before E2EE can be enabled. The existing `src/secure-data.mjs` is **read-only** and not used by the web UI.

To run locally from this directory with Node 22+:

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm audit --omit=dev --audit-level=high
npm run smoke
```
