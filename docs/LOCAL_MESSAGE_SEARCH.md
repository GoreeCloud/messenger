# Private search within loaded messages

Both the React web client and Jetpack Compose Android app provide a
device-memory-only search field when viewing a conversation.

- Search terms are matched against sender IDs and visible message bodies,
  case-insensitively, without calling Matrix search endpoints.
- Only messages that the running Matrix SDK has **already loaded** into
  the currently selected conversation can appear in results. Web previews
  keep the last 80 visible events; Android timelines currently show up to
  150 loaded events, with optional pagination.
- Search queries are restricted to 128 characters and kept only in UI
  memory, not LocalStorage, Android preferences, an external API, logs,
  analytics, a browser search service, or an index on the homeserver.
- Switching conversations clears the query; Android and browser fields
  show the on-device/loaded-history limitation explicitly.
- This cannot find content whose encryption keys are unavailable, whose
  event envelope was blocked, or whose history has not been fetched.

This feature does not introduce server-side full-text indexing, identity
verification, global searches, media extraction, cloud AI retrieval,
remote key recovery or an encrypted search index.

The pure search policy is unit-tested independently in TypeScript and
Kotlin for body/sender matching, case-insensitive behavior, stable ordering,
empty/unavailable results, and bounded query length. A passing unit test
does not imply a complete screen-reader or device E2EE acceptance test.

Future search additions should be opt-in and governed by GoreeShield privacy
policies and Wardveil threat controls. Never send decrypted message history
to external indexing or AI services without clear, scoped consent.
