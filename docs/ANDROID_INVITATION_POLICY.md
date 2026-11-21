# Fail-closed Android invitation authorization

The native Matrix Rust SDK handles encrypted room membership and invitations,
but the app must also reject obvious invalid UI-side mutations.

`InvitePolicy.requireEncryptedInvitation` now validates a bounded full Matrix
recipient ID (not an email or Matrix alias), refusing embedded whitespace,
control characters and excessive lengths. It requires that the room is
**currently joined and encrypted** and still matches the selected room
before calling the official SDK `Room.inviteUserById`.

There is no plaintext fallback and the validator does not create rooms
or modify server policy. The function is directly JVM-tested for valid
IDs, case-sensitive localparts, stale room selection, missing membership,
unencrypted rooms and malicious control-character inputs. Other clients
and the server must still independently enforce authorization; local
source tests do not prove real Matrix E2EE or prevent all network races.

**Unverified:** verified device identities, SAS/QR trust, cross-signing,
Synapse federation trust, secure backup, recovery, authenticated
end-to-end server interoperability, physical-device accessibility.
