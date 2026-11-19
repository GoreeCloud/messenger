# Local encrypted device retention (experimental)

GoreeCloud Messenger's browser client now offers optional encrypted Matrix
crypto persistence. The default remains an in-memory session with no browser
credential storage.

## Enabling persistence

Select **Keep encrypted device keys on this browser** when signing in.
Use a complete Matrix ID such as @alice:matrix.example.org and a separate
unique, high-entropy passphrase of 20+ characters. Keep that passphrase outside
this app in a trusted password manager; the application has **no recovery
mechanism** for it.

The Matrix Rust-backed SDK stores device/room crypto state in an encrypted
IndexedDB store. Its encryption is derived from the user-entered passphrase;
the SDK manages key derivation and persistent record encryption. A stable
namespace is scoped to the homeserver and exact Matrix account. The browser
stores **only a Matrix device ID** as non-secret metadata in LocalStorage.
Access tokens, login passwords, and crypto passphrases are not intentionally
written to browser storage by GoreeCloud code. The app intentionally creates
a new authenticated session on each login using the same Matrix device ID.

The Web Locks API must grant exclusive access to the crypto database; a
second active tab using the same crypto scope is **rejected**, rather than
risking Rust SDK database corruption. Before login, the app checks that both
expected Rust crypto databases are present when a device ID is remembered,
or that neither exists on first use. A partial browser-storage wipe is blocked
rather than silently reusing an old signing device ID with new keys. This
currently requires support for IndexedDB database enumeration
(\`indexedDB.databases()\`). Without that API, secure Web Crypto, IndexedDB,
or Web Locks the opt-in feature fails closed. On sign-out, the account session
token is discarded but the encrypted IndexedDB crypto state remains until
the browser's site data is cleared.

## Tradeoffs and recovery risk

- **Persistent keys are not the same as verified identities.** Another device
  remains untrusted until cross-signing/verification is implemented and tested.
- There is no secret-storage backup, cross-device key recovery, or trusted
  reset workflow. Losing the passphrase, IndexedDB data, server device ID or
  browser profile may make older encrypted messages unreadable.
- This passphrase is entered separately from the Matrix password. Simple
  length checks cannot verify passphrase entropy.
- IndexedDB / LocalStorage are vulnerable if malicious JavaScript is executed
  within the origin (XSS), if the browser/OS is compromised, or if an attacker
  accesses an unlocked session. They are not hardware-backed protection.
- Matrix identifiers, device IDs, account activity, IPs and server metadata
  are not end-to-end encrypted. Device IDs in LocalStorage are readable to
  same-origin scripts. Do not use shared or untrusted computers.
- If your homeserver returns a different device ID for a stored account,
  GoreeCloud refuses to load that device's crypto database rather than
  silently creating conflicting device keys.
- If you clear only LocalStorage but leave the crypto databases, or delete
  a crypto database while keeping its device ID, sign-in is blocked. Preserve
  data for recovery investigation rather than repeatedly attempting a login.
- Clearing browser site data is destructive: it removes any local encrypted
  keys regardless of whether a server-side backup exists. Confirm recovery
  readiness before clearing it.

**Not production ready.** Integration and threat-model acceptance require a
real persistent login → send/receive → reload → unlock → decrypt test, a
wrong-passphrase test, concurrent-tab test on supported browsers, and a real
two-device verification/key-recovery drill. Current unit tests only verify
policy, namespacing, metadata and lease handling.
