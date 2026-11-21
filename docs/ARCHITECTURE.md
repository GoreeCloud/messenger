# Messenger technical architecture

Matrix Client-Server APIs and federation form the open messaging protocol. The web app uses matrix-js-sdk 45.1.0 with Matrix Rust crypto via WebAssembly. The native Android app uses the pinned Matrix Rust SDK 26.11.17 Kotlin bindings for authentication, room synchronization, encrypted-room send/receive source, and encrypted SQLite crypto storage. Android wraps its random SQLite key and encrypted session file with Android Keystore. Both clients still require trusted cross-device verification and actual two-user interoperability tests.

~~~text
GoreeCloud web (React + matrix-js-sdk/Rust WASM crypto)
                       | HTTPS
                       v
                 TLS ingress (planned)
                       |
            Synapse Matrix homeserver
                       |
        persistence, events, federation
                       ^
                       | HTTPS (native Rust SDK + crypto)
GoreeCloud Android (Kotlin/Compose)
    | encrypted app-private SQLite + Android Keystore
~~~

The server may observe metadata including accounts, membership, IP addresses, timing and federation routing. Correct client E2EE is necessary to restrict message plaintext, but it does not hide all metadata. This project does not modify the upstream Matrix cryptographic protocol.

Synapse source v1.163.0 is pinned and retained in third_party/synapse. The Compose development service currently uses the matching upstream binary image rather than building the vendored source. A reproducible source build, signed artifacts, PostgreSQL and TLS production deployment remain acceptance gates.

Bridges to Telegram, WhatsApp and Signal are not enabled: cross-network bridging changes privacy and encryption guarantees and must require informed opt-in. MatrixRTC with TURN/LiveKit is a future calling option, not implemented.

The five mandatory GoreeCloud systems remain separate: GoreeCloud UI (visual design), GoreeShield (privacy), Wardveil (cybersecurity), GoreeCloud Mesh (integration), GoreeCloud Identity (authentication/authorization). Current GC UI palette adoption is not proof that any other integration is operational.

## Verified presentation and local privacy boundaries

Both clients expose explicit invitation decisions and device-local text/sender
search limited to loaded room messages. Search terms are never sent to a
separate search service. An invited room does not imply verified encryption:
after an explicit Join, the existing crypto and membership gates continue
to block plaintext sending.

The source-pinned first-party GoreeCloud UI adapter supplies generated web
semantic CSS tokens and native Material 3 Expressive Compose palettes, shapes
and motion. Android uses system appearance; web deliberately retains Iris/dark
in the preview. Neither a design source pin nor build success establishes
physical-device visual and accessibility acceptance.

The manual live E2EE acceptance workflow is gated by an explicit
disposable-account acknowledgment and a protected-branch-only GitHub
environment. The environment currently has no test secrets, and no live
cross-device E2EE roundtrip has been verified.
