# Explicit erasure of browser Matrix encrypted device keys

The browser's default crypto session is in-memory. If users opt in to
passphrase-protected Matrix Rust IndexedDB storage, device metadata contains
only a scoped public Matrix device ID; local encrypted crypto records remain
in two SDK-named browser databases. **Ordinary Matrix logout does not remove
these databases**, and is intentionally separate from irreversible deletion.

After signing out, the user can explicitly select **Erase this browser's
encrypted device**, enter the exact full Matrix user ID and current
homeserver origin, and type **ERASE**. No password or encryption passphrase
is required for deletion. Deleting the local keys may make old encrypted
history permanently unreadable because cross-device key recovery is not
implemented or verified.

The action:

1. Validates a full account ID, TLS homeserver and exactly typed ERASE.
2. Derives a non-reversible SHA-256 device scope; never enumerates all
   account names, saved passwords or authentication tokens.
3. Requires the same **exclusive Web Locks** scope used by the SDK.
   When another tab holds this encrypted device open, deletion fails
   without changing data. No auto-close of another tab is attempted.
4. Enumerates IndexedDB and targets **only** the two SDK database names
   for that specific account and homeserver; unrelated browser databases
   are never removed. Orphaned/partial stores can be cleared only with
   explicit confirmation.
5. Rejects deletion failures and blocked events, re-enumerates databases,
   and removes scoped nonsecret device metadata **last**, only when no
   matching databases remain.
6. Clears typed acknowledgment and account input on success and tells
   the user that this did not revoke any remaining server tokens.

The deletion operation is deliberately opt-in and never runs in tests
against real IndexedDB or personal accounts. Unit tests inject fake
in-memory databases and fake Web Locks, including deletion errors,
unknown accounts, cross-account isolation, orphan stores and blocked
sessions. The browser SDK may still hold an IndexedDB connection
after logout; if it does, deletion will fail with a close-tab message
rather than pretending erasure succeeded.

## Limitations

Deletion targets only these two version-pinned Matrix Rust SDK crypto
databases and a scoped local device-ID record on the current browser
origin. It does not erase website caches, HTTP caches, other sites,
other Matrix clients, OS backups, browser profiles or homeserver tokens.
It is not a substitute for secure account removal or server revocation.
Without a trusted E2EE key backup, this can cause **irreversible loss** of
decryptable history and trusted device continuity.

Test a browser engine with a disposable account and successful reconnect,
orphan recovery, and actual database-close behavior before Stable release.
The open recovery and device-verification release gates remain unchanged.
