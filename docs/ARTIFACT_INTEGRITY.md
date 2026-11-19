# CI preview SHA-256 integrity checks

Every protected-branch CI run generates a source-built **development preview**
of the React web bundle and an Android **debug-signed** APK. The workflow
stores a per-file SHA-256 manifest named \`SHA256SUMS\` in each respective
GitHub Actions artifact for seven days.

The manifests are generated only after successful compilation and tests, and
the CI jobs verify them in place with \`sha256sum --check SHA256SUMS\`
before upload. When downloading artifacts, verify them from the artifact's
own root directory:

\`\`\`sh
cd downloaded-web-preview
sha256sum --check SHA256SUMS

cd ../downloaded-android-debug-preview
sha256sum --check SHA256SUMS
\`\`\`

GitHub Actions may repackage artifact archives; verify the **extracted files**
relative to their included manifest, not the archive ZIP itself. The web
manifest covers all generated assets, including the Matrix Rust WASM binary.
The Android manifest covers \`app-debug.apk\` only, not unrelated metadata.

### Security boundaries

SHA-256 is a corruption/difference detector when compared with a manifest
whose origin is separately trusted. A checksum stored alongside the artifact
**is not an independently signed supply-chain attestation**: an attacker with
control of the artifact and manifest can replace both. These are *preview*
builds—not reproducible, independently audited, release-signed, deployed, or
safe for sensitive production use.

For provenance, check the exact protected commit and successful GitHub
Actions run, review the build source and upstream license notices, and
independently verify signatures if a future signed release is available.
Do not place credentials or message content inside artifacts or their names.
