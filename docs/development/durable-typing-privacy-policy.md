# Durable Typing Privacy Policy Adapter — Development

GoreeCloud Messenger now has a single-node durable adapter for the existing minimized typing-presence privacy preference contract.

## Implemented in this slice

- The file-backed adapter implements both the typing preference store and typing publish/observe policy boundaries.
- Records contain only a schema version plus `publish_typing` and `observe_typing` booleans.
- Conversation and user identifiers are not written into record bodies or filenames; they are reduced to a SHA-256 record key.
- The persistence root is explicit, non-root, and protected with owner-only permissions.
- Writes use a temporary file, flush, close, and rename path rather than in-place record mutation.
- Missing records use the explicitly configured default policy.
- Corrupt or unsupported records fail closed through an error rather than silently reverting to an allow decision.
- Automated tests cover restart persistence, identifier minimization, explicit defaults, corruption handling, and unsafe-root rejection.

## Boundary

This adapter is a Development single-node durability foundation. It is not yet the production Privacy Shield service integration, cross-device preference synchronization, distributed persistence, deployment acceptance, or Stable qualification.
