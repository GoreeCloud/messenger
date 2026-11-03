import test from "node:test";
import assert from "node:assert/strict";
import { SecureDataBootstrap } from "../src/secure-data.mjs";

const goodIdentity = {
  homeserver: "https://matrix.example.test",
  accessToken: "synthetic-test-token",
  userId: "@alice:example.test",
  deviceId: "ALICE1",
  secureContext: true,
  indexedDB: { open() {} }
};
function fakeSdk(overrides = {}) {
  const calls = [];
  const crypto = {
    globalBlacklistUnverifiedDevices: false,
    async isCrossSigningReady() { calls.push("cross-signing"); return true; },
    async isSecretStorageReady() { calls.push("secret-storage"); return true; },
    async getActiveSessionBackupVersion() { return "1"; },
    async getKeyBackupInfo() { return { version: "1" }; },
    async isKeyBackupTrusted() { return { trusted: true, matchesDecryptionKey: true }; },
    async isEncryptionEnabledInRoom() { return true; },
    async getUserVerificationStatus() {
      return { known: true, needsUserApproval: false, isCrossSigningVerified() { return true; } };
    },
    ...overrides.crypto
  };
  const client = {
    async whoami() { calls.push("whoami"); return { user_id: goodIdentity.userId, device_id: goodIdentity.deviceId }; },
    async initRustCrypto(options) { calls.push(["rust-crypto", options.useIndexedDB]); },
    getCrypto() { calls.push("get-crypto"); return crypto; },
    async stopClient() { calls.push("stop"); },
    ...overrides.client
  };
  let inUse = false;
  const acquireLease = async () => {
    if (inUse) throw Error("Lease already held");
    inUse = true;
    calls.push("lease");
    return { async release() { inUse = false; calls.push("release"); } };
  };
  const createClient = options => { calls.push(["create", options]); return client; };
  return { calls, crypto, client, createClient, acquireLease, isLocked: () => inUse };
}
test("rejects non-secure contexts, absent IndexedDB and invalid identity before requesting a lease", async () => {
  const env = fakeSdk();
  for (const fields of [
    { secureContext: false }, { indexedDB: null },
    { userId: "not-a-Matrix-ID" }, { userId: "@missingdomain" }, { deviceId: "" },
    { accessToken: "bad\nBearer" }, { homeserver: "http://matrix.example.test" }
  ]) {
    await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env, ...fields }));
  }
  assert.deepEqual(env.calls, []);
});
test("binds account and device before opening Rust crypto store", async () => {
  const env = fakeSdk();
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  assert.equal(s.cryptoInitialized, true);
  assert.deepEqual(s.identity, {
    homeserver: goodIdentity.homeserver, userId: goodIdentity.userId, deviceId: goodIdentity.deviceId
  });
  assert.deepEqual(env.calls.slice(0,4).map(x => Array.isArray(x) ? x[0] : x),
    ["lease", "create", "whoami", "rust-crypto"]);
  assert.equal(env.calls[3][1], true, "Rust crypto must use IndexedDB");
  assert.equal(env.crypto.globalBlacklistUnverifiedDevices, true);
  const opts = env.calls[1][1];
  assert.equal(opts.deviceId, goodIdentity.deviceId);
  assert.equal(opts.userId, goodIdentity.userId);
  assert.equal(opts.baseUrl, goodIdentity.homeserver);
  assert.equal(opts.accessToken, goodIdentity.accessToken);
  assert.equal(typeof s.sendEvent, "undefined");
  assert.equal(typeof s.send, "undefined");
  await s.close(); await s.close();
  assert.equal(env.isLocked(), false);
  assert.equal(env.calls.filter(x => x === "stop").length, 1);
});
test("rejects a cross-account or mismatched-device token without initializing crypto", async () => {
  for (const who of [
    { user_id: "@mallory:example.test", device_id: goodIdentity.deviceId },
    { user_id: goodIdentity.userId, device_id: "WRONG" },
    { user_id: goodIdentity.userId }
  ]) {
    const env = fakeSdk({ client: { async whoami() { return who; } } });
    await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env }), /did not match/);
    assert.ok(!env.calls.some(x => Array.isArray(x) && x[0] === "rust-crypto"));
    assert.equal(env.isLocked(), false);
    assert.ok(env.calls.includes("stop"));
  }
});
test("initialization failure stops the SDK and releases the crypto store", async () => {
  const env = fakeSdk({ client: { async initRustCrypto() { throw Error("private token in error"); } } });
  await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env }),
    e => e.code === "INITIALIZATION_FAILED" && !e.message.includes("token"));
  assert.deepEqual(env.calls.slice(-2), ["stop", "release"]);
  assert.equal(env.isLocked(), false);
});
test("missing crypto-security APIs are never accepted as initialized", async () => {
  const env = fakeSdk({ crypto: { isSecretStorageReady: null } });
  await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env }), /required security API/);
  assert.equal(env.isLocked(), false);
});
test("rejects a second crypto session while a first instance holds the lease", async () => {
  const env = fakeSdk();
  const a = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env }), /already held/);
  assert.equal(env.calls.filter(x => Array.isArray(x) && x[0] === "create").length, 1);
  await a.close();
  const b = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  await b.close();
});
test("recovery report never enables messages even if all prerequisites are reported healthy", async () => {
  const env = fakeSdk();
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const status = await s.inspectRecovery();
  assert.deepEqual({
    status: status.status, canSend: status.canSend, cryptoInitialized: status.cryptoInitialized,
    recoveryPrerequisitesPresent: status.recoveryPrerequisitesPresent, backupTrusted: status.backupTrusted
  }, {
    status: "blocked", canSend: false, cryptoInitialized: true,
    recoveryPrerequisitesPresent: true, backupTrusted: true
  });
  await s.close();
});
test("untrusted or missing backups never become recovery-ready", async () => {
  for (const crypto of [
    { getActiveSessionBackupVersion: async () => null },
    { isKeyBackupTrusted: async () => ({ trusted: true, matchesDecryptionKey: false }) },
    { isSecretStorageReady: async () => false },
    { getKeyBackupInfo: async () => { throw Error("untrusted server"); } }
  ]) {
    const env = fakeSdk({ crypto });
    const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
    const state = await s.inspectRecovery();
    assert.equal(state.recoveryPrerequisitesPresent, false);
    assert.equal(state.canSend, false);
    await s.close();
  }
});
test("room inspection fails closed for unencrypted rooms and changed peer identities", async () => {
  const env = fakeSdk({ crypto: {
    async isEncryptionEnabledInRoom(room) { return room !== "!plain:example.test"; },
    async getUserVerificationStatus(user) {
      return { known: true, needsUserApproval: user === "@rotated:example.test",
        isCrossSigningVerified() { return true; } };
    }
  }});
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const plain = await s.inspectRoom("!plain:example.test", ["@bob:example.test"]);
  assert.equal(plain.encryptionReported, false);
  assert.equal(plain.canSend, false);
  const rotated = await s.inspectRoom("!secure:example.test", ["@rotated:example.test"]);
  assert.equal(rotated.encryptionReported, true);
  assert.equal(rotated.verifiedIdentities, false);
  assert.equal(rotated.canSend, false);
  const checked = await s.inspectRoom("!secure:example.test", ["@bob:example.test"]);
  assert.equal(checked.verifiedIdentities, true);
  assert.equal(checked.canSend, false, "Verified user is not enough to attest recipient devices");
  await s.close();
});
test("closing the session prevents further trust or recovery calls", async () => {
  const env = fakeSdk();
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  await s.close();
  await assert.rejects(s.inspectRecovery(), /closed/);
  await assert.rejects(s.inspectRoom("!r:example.test", ["@bob:example.test"]), /closed/);
});
