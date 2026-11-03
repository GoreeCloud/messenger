/**
 * Isolated, dependency-using compatibility probe for the real matrix-js-sdk.
 * No login, live homeserver, user credentials, encrypted sends, or UI imports.
 * Uses the SDK's documented Node-only, in-memory Rust crypto initialization.
 * This does NOT demonstrate production E2EE or safe device recovery.
 */
import assert from "node:assert/strict";
import * as sdk from "matrix-js-sdk";

assert.equal(typeof sdk.createClient, "function", "matrix-js-sdk createClient missing");
const client = sdk.createClient({
  baseUrl: "http://127.0.0.1:8008",
  accessToken: "synthetic-do-not-use",
  userId: "@test:localhost",
  deviceId: "SYNTHETIC1"
});
try {
  assert.equal(typeof client.initRustCrypto, "function", "Rust crypto initialization missing");
  assert.equal(typeof client.getCrypto, "function", "Rust crypto API getter missing");
  await client.initRustCrypto({ useIndexedDB: false });
  const crypto = client.getCrypto();
  assert.ok(crypto, "Rust crypto did not produce a CryptoApi");
  for (const method of [
    "isEncryptionEnabledInRoom", "isCrossSigningReady",
    "isSecretStorageReady", "getActiveSessionBackupVersion",
    "getKeyBackupInfo", "isKeyBackupTrusted",
    "getUserVerificationStatus"
  ]) assert.equal(typeof crypto[method], "function", "Missing CryptoApi." + method);
  assert.equal(typeof crypto.getVersion, "function");
  const version = crypto.getVersion();
  assert.equal(typeof version, "string");
  assert.ok(version.length > 0);
  console.log("matrix-js-sdk 45.0.0 local Rust crypto API compatibility PASS");
  console.log("No real server, device verification, persistent keys, encryption send or decrypt tested");
} finally {
  await client.stopClient();
}
