# Matrix mutating-operation input boundaries

GoreeCloud Messenger intentionally refuses unsafe or unauthenticated
mutations before invoking the Matrix SDK. Server input remains untrusted
even if its event type or UI appearance looks legitimate.

- **Room creation:** validate and trim to 1–90 characters on the
  API helper, not only the HTML form. Always request private encryption.
- **Invitations:** require a bounded, syntactically valid Matrix ID and
  a joined room whose Rust crypto state confirms encryption before
  invoking the SDK invitation endpoint. Unencrypted view-only rooms
  cannot invite users from this browser preview.
- **Replies:** validate remote event IDs and sender IDs; cap quoted
  untrusted remote text at 512 characters before composing the
  Matrix reply fallback. This prevents a remote megabyte message from
  bypassing the local 4,000-character author input limit.
- **Reactions:** require a bounded event ID without whitespace or
  control characters, an allowed emoji, and confirmed room encryption.

Tests use only synthetic Matrix clients and malicious-looking dummy
payloads. The browser never falls back to plaintext sends. Successful
unit tests **do not** prove real encrypted membership changes, device
identity, cross-signing, remote key recovery, or live interoperability.

Error reporting remains a fixed, exact allowlist; untrusted server-side
suffixes and SDK responses are never shown as validation instructions.

### Matrix recipient and reply sender controls

The shared web Matrix ID validation also rejects C0/C1 control characters
(including NUL, DEL and C1 control values) without relying on a whitespace
class. Invitation helpers check the **raw** string for these characters
before trimming ordinary surrounding spaces, so trailing tab/newline
injection cannot be hidden by `trim()`. The same validator protects
remote reply-sender IDs. The tests are synthetic and never invite real users.
