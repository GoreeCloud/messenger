# Native Android sign-out and server revocation

The explicit Android action **Erase local device** destroys the app's
Android Keystore key and private Matrix session/SQLite storage after trying
the official Matrix Rust SDK's token-revocation logout.

The UI now distinguishes these outcomes:

- A **successful** server logout call: the local device was erased and
  the homeserver acknowledged token revocation for this session.
- A **failed or unavailable** server call: the local device was erased,
  but the old server token's revocation cannot be confirmed. The UI tells
  the user to revoke that device using a separate trusted client.

A user-confirmed erasure is irreversible without independent, verified
server-side E2EE key backups. Such recovery is not yet implemented.
Device identity, cross-signing and Matrix E2EE cross-device tests remain open.

JVM tests verify the three important transitions: successful remote
revocation and local erase, failed remote revocation still erasing locally,
and local erasure errors never reported as success. They use only synthetic
injected callbacks; they do not contact a homeserver or erase physical
user data. No non-test Android Keystore alias is used in these tests.

Caveat: the native SDK network logout is not guaranteed to finish quickly
when unreachable. A timeout and retry-safe token revocation mechanism
requires separate SDK lifecycle acceptance. This change does not claim
a bounded server logout in the Android implementation.
