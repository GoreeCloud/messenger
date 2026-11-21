# Encrypted event presentation and trust boundary

In rooms whose Matrix state declares encryption, the web timeline
now checks the **raw event wire type**, not merely its decrypted-looking
event type. Only raw `m.room.encrypted` events can have decrypted text
displayed or emoji reactions counted.

A server-injected plaintext `m.room.message` or reaction is **never**
presented as authenticated E2EE content. It is replaced with a clear
blocked-event placeholder; invalid or undecryptable content remains
opaque. Excessively large remote bodies are truncated for UI stability.

The rule is also applied to reactions. For an intentionally unencrypted,
view-only room, ordinary plaintext content remains visible but sending
is disabled by the separate encrypted-room gate.

**Limits:** this is a display-side envelope check, not device identity
verification, cross-signing, trusted senders, sender authentication,
remote key backup, secret recovery, or a live E2EE acceptance test.
Pending local message echoes may show a placeholder until the SDK
reports a ciphertext wire envelope. Do not add plaintext fallback.

Nine offline tests cover ciphertext, plaintext downgrade attempts,
decryption errors, invalid bodies, truncation, reaction filtering,
view-only rooms, and integration through the listRooms display model.
