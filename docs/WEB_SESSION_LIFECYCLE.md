# Browser credential and sign-out lifecycle

The web application holds Matrix login passwords and its optional local
crypto passphrase only transiently. On form submission, the React input
states are cleared **before** the async login call starts; no credential is
intentionally saved by GoreeCloud code to LocalStorage or IndexedDB.

On sign-out, the Matrix client stops sync/crypto and attempts the server
logout endpoint for at most eight seconds. The app drops the local client
even if the network is unavailable, and releases any exclusive encrypted
IndexedDB lock.

**Important distinction:** a network failure or timeout means the app has
signed out *locally* only. The server may still accept the previous token.
The UI explicitly warns the user to revoke that device from another trusted
session. It only confirms server-side revocation after a successful response.

The optional encrypted browser crypto database is retained on sign-out,
because deleting it can permanently destroy access to old E2EE history.
No cross-device key backup or secure secret recovery is currently available.

Tests cover successful server logout, network failure, timeout and local
stop failure with synthetic clients and fake timers. These do not replace a
live token-revocation test with a trusted Matrix homeserver, cross-device
device-list verification or independent security review.

Remaining risks: malicious extensions, origin XSS and an unlocked device
could compromise in-memory tokens; a timed-out HTTP request could continue
server-side after the UI reports uncertainty. Browser storage retention is
not a remotely recoverable secret backup.
