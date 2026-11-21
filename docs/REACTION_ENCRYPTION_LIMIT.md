# Why browser emoji reactions are disabled for encrypted rooms

**Evidence:** GitHub-hosted disposable Matrix E2EE run
[44868521029](https://github.com/GoreeCloud/messenger/actions/runs/44868521029)
successfully reached two-user encrypted message and reply exchange, but
the pinned `matrix-js-sdk@45.1.0` client sent the emoji as a plaintext
`m.reaction` event on the Matrix wire. The client SDK source function
`MatrixClient.shouldEncryptEventForRoom` **explicitly bypasses encryption
for `EventType.Reaction`**, even when the room is encrypted. Its rationale
is server-side relation aggregation and the absence of settled encrypted
reaction-key semantics. The initial E2EE test correctly refused to treat
a plaintext reaction event as an authenticated ciphertext envelope.

**Fail-closed action:** Messenger's web client now refuses sending emojis
via `reactEncrypted()` and removes the action buttons from encrypted
rooms. It never calls the SDK's `sendEvent(m.reaction)` API while claiming
that emoji content is end-to-end encrypted. Users see an explicit notice
rather than a misleading “Reaction sent to encrypted room.” Plaintext
server-injected reaction envelopes remain blocked from its encrypted-room
display by the existing `canDisplayReaction` source-envelope gate.

The disposable live E2EE harness verifies encrypted original messages,
decryption on the other account, encrypted reply relations, explicit
refusal to send emoji reaction plaintext, and missing-room plaintext
downgrade refusal. A **PASS of that revised harness does not mean
encrypted reactions are implemented**; it means they are deliberately
blocked until cryptographic semantics are proven.

## Requirements to re-enable

1. Independently verify current Matrix specification and SDK encrypted
   reaction support, including the reaction **emoji key** confidentiality,
   original wire envelope, and relation-binding authenticity.
2. Test two disposable independent devices against an isolated trusted
   HTTPS Matrix homeserver; inspect actual wire events, decrypted content
   and key-sharing/trust behaviors, including adversarial plaintext
   injection and forged relation content.
3. Keep original Matrix event type and SDK encryption distinctions explicit.
   Do not manufacture a custom plaintext `m.reaction`, hide reaction
   content in misleading text bubbles, or merely mask emoji in the UI.
4. Only re-enable behind verified GoreeShield consent/visibility controls,
   Wardveil threat checks, GoreeCloud UI accessibility review, and
   documentation updating tests and release gates.

The native Android Matrix Rust SDK currently has a distinct
`Timeline.toggleReaction` implementation. No Android live wire-envelope
acceptance has proven its reaction confidentiality; evaluate separately
before treating Android reactions as end-to-end private. This report makes
no assertion that the Android SDK has the same JS behavior.

Neither browser nor Android E2EE device identities, cross-signing,
cryptographic key backup, or replacement-device recovery are verified.
