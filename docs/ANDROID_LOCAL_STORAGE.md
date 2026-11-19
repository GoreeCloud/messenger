# Native Android encrypted device store (experimental)

GoreeCloud Messenger uses the **Matrix Rust SDK** for native messaging, synced
timeline history and Matrix cryptography. Starting in this development branch,
the Android app also uses its SQLite storage backend encrypted with a randomly
generated 256-bit key.

The SQLite key is individually wrapped by a non-exportable Android Keystore
AES-256-GCM key. Authentication session fields (including the access token and
optional refresh token) are serialized as a separate AES-GCM-encrypted record
with purpose-separated authenticated associated data. The app's storage lives
under Android's noBackupFilesDir, not shared media storage; the manifest
disables OS application backups and cleartext traffic.

On the next app launch, the saved Matrix session and identical crypto database
are restored instead of silently creating a new signing device. If restoration
fails, the local keys are preserved; the UI offers a retry and a separately
confirmed irreversible forget action. Signing out explicitly revokes the
current server session where possible and deletes the locally wrapped session,
SQLite crypto store, and Keystore wrapping key. Offline revocation of the
server-side access token is not guaranteed.

## Verified checks

- Local Gradle debug APK assembly and JVM tests pass.
- Six isolated Android instrumentation tests passed on a connected OnePlus
  DE2117 Android 16 handset on November 19, 2026, with zero failures:
  key re-open across a new vault instance, encrypted synthetic session
  re-open, detection of tampered ciphertext, key deletion, missing wrapped
  key refusal, and orphaned session refusal.
- Tests use a **separate Keystore alias and test-only storage directory**,
  never real Matrix credentials or a production user's device account.

## Still incomplete

- Cross-signing, SAS/QR verification, secret storage, trusted server key
  backup, lost-device recovery, and Android-web E2EE interoperability.
- Full network login/logout/restore against an actual Matrix test homeserver.
- Authentication gating (biometric/password) for each local unlock.
- Proving hardware-backed Keystore on all supported devices or attesting
  to resistance against compromise of an unlocked app process.
- Android app distribution signing, long-term lifecycle, process death, and
  comprehensive accessibility acceptance. Installed debug artifacts are NOT
  production-ready releases.

**Never copy raw application database files, Keystore entries or debug
credentials into public repositories, CI artifacts, tickets or logs.** Local
key deletion can make previously encrypted messages permanently unreadable
until a separate verified key-backup mechanism exists.

## Lost or incomplete device records

A wrapped SQLite store key, Keystore alias, saved session, or nonempty Rust
storage directory is treated as existing device data. If the key wrapper is
missing or corrupted, the app does **not** generate a replacement while those
records exist. An explicit confirmation is required to erase an orphaned
device. This is intended to prevent silent old-device-ID reuse and account
mixups, not to recover encrypted history.

A first-login failure can leave an incomplete local crypto database; the app
then requires the user to explicitly clear it before retrying, until safe
first-login transaction rollback is designed and tested. This conservative
behavior is a preview limitation.
