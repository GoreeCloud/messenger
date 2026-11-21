# On-demand browser Matrix SDK crypto status

While signed into GoreeCloud Messenger, the web app can inspect four
**read-only** fields from the pinned Matrix JS SDK 45.1.0 Rust crypto API:

- Public cross-signing keys available on this device.
- All three private cross-signing keys cached locally.
- Private cross-signing keys present in configured Matrix secret storage.
- Automatic session key backup currently enabled in the SDK.

The source calls only `getCrossSigningStatus()` and
`getActiveSessionBackupVersion()`. Only booleans are kept in React
memory; not the returned backup version, device IDs, keys, messages,
access tokens, passphrases or server responses. No recovery or
cross-signing operation is initiated; no encrypted history is exported.

Status is explicitly **on demand**, not checked on every message render.
It is forgotten on login and signout, is not stored or transmitted to an
external service, and SDK failures are surfaced via the existing
fixed-message error handling. The UI retains the original GoreeCloud
source-pinned web design tokens.

**Interpretation matters:** public signing keys do not prove they have
been authenticated; even locally cached signing keys do not verify another
person or device. An active SDK backup version does **not** prove that its
room keys are complete, decryptable or recoverable on a new device.
The screen must keep these warnings visible even if all SDK flags
return true.

Synthetic, no-network TypeScript tests cover missing crypto, partial
private keys, active backup version redaction, API nonmutation and warning
wording. This is a diagnostics improvement, not successful E2EE device
verification, cross-signing/recovery provisioning, or a restore test.
