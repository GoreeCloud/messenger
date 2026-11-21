# Incoming Matrix room invitations

GoreeCloud Messenger handles incoming invitations as **explicit user choices**:
accept (join) or decline (leave). No room is automatically joined, and the
invitation's room name and sender-provided metadata are untrusted input.

**Privacy & consent:** joining may disclose your membership to the room's
homeserver and participants. An invitation's stripped state may not include
the encryption event, so the application does not infer verified encryption
or trusted identities from an invite. The user is warned that encryption
will be checked after joining.

After joining, the existing encryption and membership gates continue to
govern sending: an unencrypted room is **view-only** in this preview.
Declining an invitation does not send an encrypted message to the room.
These features do not introduce federation trust, cross-signing, device
identity verification, password recovery or server-side account backups.

Web acceptance tests use a synthetic MatrixClient and assert pending-only
listing, explicit join/decline SDK calls, refusal for nonpending rooms,
and absence of any trusted-encryption claim in invite metadata. No live
server or personal account was touched by those tests.

Android uses official Matrix Rust SDK native Room.join()/Room.leave()
rather than handwritten HTTP. A joined room still must pass the existing
SDK encryption state before sending messages or inviting new members.
