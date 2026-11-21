# Native Matrix Rust SDK emoji reaction privacy boundary

GoreeCloud Messenger prioritizes the **privacy of reactions and their
target-event links**. In encrypted rooms, a server should not receive the
plaintext emoji and reaction relation while the UI promises E2EE.

The pinned Matrix Rust Android SDK's
`Timeline.toggleReaction(EventOrTransactionId, emoji)` delegates through
the upstream Matrix SDK timeline controller to a
`ReactionEventContent` send. In the upstream Matrix Rust SDK source
reviewed at commit `f4a94ad6141846f9ddaa8be5117260d1311196b9`,
`crates/matrix-sdk/src/room/mod.rs` explicitly documents an
`m.reaction` **exception to encryption**. That upstream code is
security-relevant evidence but is not independent packet capture from
the version-pinned Android AAR. We should not assume a safe ciphertext
reaction transport without a live wire-envelope test.

## Fail-closed behavior

- The native UI keeps encrypted text/reply controls and displays a clear
  explanation that emoji reactions are unavailable with this SDK.
- The Android engine's public `toggleReaction` entrypoint validates
  current selected-room, joined membership, SDK room encryption, remote
  event ID and allowed emoji, then **rejects** instead of invoking
  `Timeline.toggleReaction` or sending a custom HTTP event.
- No plaintext reaction fallback is permitted. Previously received
  reaction counts are not displayed within message rows, because a
  plain reaction event may be server-observable or spoofed.
- JVM tests assert every valid emoji still fails closed; offline CI
  inspects the source to block accidental reintroduction of reaction
  sending or unsafe UI action controls.

**Unverified:** an encrypted, interoperable emoji reaction format
between Matrix Rust Android and browser clients. Do not reenable until
a reviewed upstream SDK path emits `m.room.encrypted` on the wire,
the receiving client decrypts/recognizes the relation, downgrade
behavior is tested, and native device identity/recovery gates pass.

This safeguard disables a feature rather than implementing verified
encrypted reactions. It does not affect source-vendored GoreeCloud UI,
encrypted text/replies, stored session keys, or any production server.
No real account data is touched by these offline tests.
