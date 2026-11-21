# Read-only native Matrix SDK crypto status

The native app now exposes an **on-demand, read-only** snapshot of
`Encryption.verificationState()`, `Encryption.recoveryState()` and
`Encryption.backupState()` from the official source-pinned Matrix Rust
Android SDK. This is a diagnostics view, not a provisioning wizard.

The view is available only after an existing local Matrix device is
connected. The user explicitly requests refresh; no encryption recovery
secrets, cross-signing private keys, device session tokens, other users'
messages, or backups are accessed by this UI. It never creates, rotates,
exports, uploads, imports, resets or deletes recovery keys. It does not
initiate network recovery or identity verification.

The app identifies the source as **SDK state**. An SDK value of
`VERIFIED` refers to the local SDK account-identity state. It must
**never** imply that every other user or device is verified. Similarly,
`BackupState.ENABLED` is not proof that remote backup contents are
complete, decryptable or restorable. Users are told explicitly that an
actual encrypted device/key restore has not been tested.

The snapshot is forgotten from UI state on login/restore/signout, and
the SDK encryption handle is closed after the inspection. Exceptions
are redacted to a fixed message. JVM unit tests exercise all SDK enum
values and block unsupported trust/recovery wording. This does not
constitute a live Matrix E2EE or lifecycle test.

**Release blockers:** actual SAS/QR verification, cross-signing lifecycle,
secure recovery-key UX, independent two-device restore and cryptographic
verification, device revocation and room-key trust boundaries. All require
disposable-account integration testing and security review before
production use.
