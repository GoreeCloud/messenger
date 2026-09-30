# GoreeCloud Messenger Privacy

## Status

GoreeCloud Messenger remains in Development and is not production accepted. This record describes the verified privacy boundary of the current source line; accepted Privacy Shield runtime policy and production privacy validation remain open.

## Communication data

- GoreeCloud Data message content is represented as encrypted envelopes; server-side message handling does not treat ciphertext as plaintext content.
- Encrypted attachment transport is opaque. The attachment service transports ciphertext and metadata required for the Development contract without decrypting user media.
- Delivery/read receipts are authenticated communication state and are not treated as carrier or cryptographic proof.
- Typing presence is content-free, short-lived, participant-authorized, and independently gated for publishing and observing.
- The current typing-preference storage is Development behavior and is not accepted durable Privacy Shield preference persistence.

## Android client boundary

The native Android client remains disconnected and fail closed. It has no production account, live message transport, durable message store, active E2EE provider, or Send control. Android backup is disabled for the Development shell, and the client boundary validator rejects unauthorized network, database, credential, message, or cryptographic persistence authority.

The only bounded Android preference storage currently permitted is first-use guidance metadata. It does not store message content, conversation identifiers, account identifiers, reusable credentials, plaintext, ciphertext, or cryptographic state.

## Diagnostics and retention

Development runtime diagnostics are minimized to categorical operational state and must not expose configured storage paths, message/receipt/attachment content, conversation data, reusable credentials, or cryptographic material. Ephemeral typing presence must not become durable export or recovery state.

## Production boundary

Production Identity/session/device binding, privacy consent/policy authority, durable preference behavior, connected transport, accepted E2EE lifecycle, distributed storage, notification delivery, backup/restore, telemetry, retention, export, and deletion controls require separate implementation and acceptance before they may be represented as production behavior.
