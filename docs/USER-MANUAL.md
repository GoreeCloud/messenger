# GoreeCloud Messenger User Manual

## Current availability

GoreeCloud Messenger is in **Active Development**. The repository currently provides messaging-domain, service, authenticated HTTP transport, receipt, persistence, encrypted-attachment, content-free typing-presence, typing-privacy preference, and unified Data runtime-composition foundations. A production-ready end-user Messenger client is **not yet available** from this repository.

This manual therefore explains what current Development builds/services do and which product behaviors must not yet be assumed.

## GoreeCloud Data messaging

GoreeCloud Data is the first-party GoreeCloud messaging transport for authorized GoreeCloud conversations. It is technically distinct from SMS, MMS, and RCS and must not silently downgrade an encrypted GoreeCloud conversation to a carrier transport.

Current source validates encrypted Data envelopes, enforces authenticated sender/conversation authorization, provides deterministic retry protection, and exposes authenticated message transport through the Development HTTP service.

The current HTTP foundation also provides one application-facing Data runtime handler that composes message, receipt, encrypted-attachment, and optional typing-related routes under the same injected authenticator. Typing routes and typing-preference routes remain opt-in runtime composition; constructing the base runtime does not enable them automatically. This is a Development integration boundary, not a production server bootstrap, Identity session implementation, TLS endpoint, or deployment approval.

End-to-end encryption is represented only when the relevant cryptographic state is actually verified. The current repository does not yet establish production device/key lifecycle or complete production cryptographic session establishment.

## Typing presence and privacy controls

The current Development service can represent **content-free** typing presence for an authorized conversation.

A typing signal contains only the conversation/user identity needed for authorization, a monotonic sequence number, and `typing` or `idle` state. Active typing state expires after 10 seconds. The typing API does not accept or return draft text, keystrokes, cursor position, ciphertext, client nonces, device secrets, or client timestamps.

Publishing and observing typing presence have independent privacy gates. The current Development preference API lets an authenticated conversation participant control those two choices for that conversation:

- `publish_typing`: whether that user may publish typing state;
- `observe_typing`: whether that user may receive the current typing projection for other participants.

The preference request body does **not** accept a user ID. Messenger derives the acting identity from the authenticated request and checks conversation membership before reading or updating the preference.

The current preference store is an in-memory Development implementation. It is useful for validating authorization and privacy behavior, but it is **not durable Privacy Shield-backed preference persistence** and it will not survive a service restart. Production persistence, user-facing native controls, cross-device preference consistency, production presence fan-out, and rate-limit/anti-abuse acceptance remain separate milestones.

## Delivery and read state

The current service foundation supports authenticated delivery and read receipts. Receipt state represents authorized application-level state; it is not carrier proof, cryptographic proof that a human read content, or evidence that every planned client has rendered a message.

Later privacy controls for receipt behavior must remain explicit and evidence-backed before user-facing production claims.

## Encrypted attachments

Current GoreeCloud Data attachment transport treats attachment content as opaque ciphertext.

The service can currently:

- accept encrypted attachment bytes through authorized conversation boundaries;
- return bounded attachment metadata;
- fetch ciphertext through JSON/base64 Development transport;
- delete attachments with replay-safe tombstone semantics; and
- download the exact stored ciphertext bytes through a participant-authorized raw transport.

The server does not decrypt attachment media in order to provide this transport. Plaintext filenames, MIME interpretation, client-side decrypt/render behavior, production object storage, and any plaintext security-scanning workflow require separate contracts and acceptance.

## Identity and usernames

GoreeCloud usernames are intended to be first-class Messenger identities and do not have to map one-to-one to phone numbers. Production username resolution and account disclosure must use GoreeCloud Identity-owned contracts rather than turning Messenger into an unrestricted account directory.

The current service does not establish production GoreeCloud Identity sessions or a production consumer username-resolution experience.

## SMS, MMS, RCS, and calls

The domain model keeps Data, SMS, MMS, and RCS transports distinct. Carrier integration is permitted only through legitimate supported platform/carrier APIs. Voice/video calling and carrier calling must remain distinguishable.

Current source does not establish production carrier adapters, voice/video media transport, or complete calling clients.

## Privacy and security expectations

- Message transport must preserve actual transport provenance.
- Encrypted conversations must not claim verified end-to-end protection unless the client has verified that state.
- Attachment services transport ciphertext and must not invent plaintext interpretation.
- Typing presence must remain content-free, authorization-scoped, short-lived, and controlled by explicit publish/observe privacy policy.
- Privacy Shield governs privacy-sensitive messaging behavior and user controls.
- Wardveil Security governs applicable protection, detection, trust, verification, and response boundaries.
- GoreeCloud Identity governs account, device, credential, session, and authorization authority.
- Everkeep governs accepted backup, recovery, preservation, portability, and succession behavior.
- GoreeCloud Mesh governs authenticated cross-service coordination.
- Glaze UI governs approved client-interface design once client surfaces are implemented and accepted.

## Current limitations

The Development repository does not yet establish production identity sessions, complete cryptographic session/key management, distributed delivery/storage, production object storage, push delivery, durable Privacy Shield-backed typing preference persistence, production presence fan-out, carrier adapters, calling media transport, anti-abuse/rate-limit acceptance, complete native clients, Glaze UI client acceptance, production server/bootstrap configuration, deployment, signed release, or Stable qualification.

Until a later release record states otherwise, there is no supported production end-user installation workflow from this repository.

Refer to `README.md`, `SPECIFICATIONS.md`, `FEATURES.md`, and `docs/` for technical and acceptance details.
