import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { SecureDataBootstrap } from "../src/secure-data.mjs";

const goodIdentity = {
  homeserver: "https://matrix.example.test",
  accessToken: "synthetic-test-token",
  userId: "@alice:example.test",
  deviceId: "ALICE1",
  secureContext: true,
  indexedDB: { open() {} },
  subtle: webcrypto.subtle,
  // Synthetic input is deterministic for tests ONLY. Real applications must
  // retrieve a stable, high-entropy per-device key from approved secret storage.
  storageKey: Uint8Array.from({ length: 32 }, (_, index) => index + 1)
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
      return { needsUserApproval: false, isCrossSigningVerified() { return true; } };
    },
    ...overrides.crypto
  };
  const client = {
    async whoami() { calls.push("whoami"); return { user_id: goodIdentity.userId, device_id: goodIdentity.deviceId }; },
    async initRustCrypto(options) {
      calls.push(["rust-crypto", options.useIndexedDB, options.storageKey,
        options.cryptoDatabasePrefix]);
    },
    getCrypto() { calls.push("get-crypto"); return crypto; },
    async getJoinedRoomMembers() {
      calls.push("joined-members");
      return { joined: [
        { user_id: goodIdentity.userId }, { user_id: "@bob:example.test" }
      ] };
    },
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
    { accessToken: "bad\nBearer" }, { homeserver: "http://matrix.example.test" },
    { storageKey: null }, { storageKey: "hardcoded-password" },
    { storageKey: new Uint8Array(31) }, { storageKey: new Uint8Array(32) },
    { subtle: null }, { subtle: { digest: null } }
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
  const sdkStoreKey = env.calls[3][2];
  assert.ok(sdkStoreKey instanceof Uint8Array);
  assert.equal(sdkStoreKey.byteLength, 32);
  assert.notStrictEqual(sdkStoreKey, goodIdentity.storageKey,
    "SDK must not receive a mutable caller-owned key buffer");
  assert.deepEqual([...sdkStoreKey], [...goodIdentity.storageKey]);
  const expectedScope = "goreecloud-messenger-v1-" + createHash("sha256")
    .update(JSON.stringify([goodIdentity.homeserver, goodIdentity.userId, goodIdentity.deviceId]))
    .digest("hex");
  assert.equal(env.calls[3][3], expectedScope);
  assert.doesNotMatch(expectedScope, /alice|example[.]test|ALICE1/,
    "IndexedDB name should not contain readable account identifiers");
  assert.equal(env.crypto.globalBlacklistUnverifiedDevices, true);
  const opts = env.calls[1][1];
  assert.equal(opts.deviceId, goodIdentity.deviceId);
  assert.equal(opts.userId, goodIdentity.userId);
  assert.equal(opts.baseUrl, goodIdentity.homeserver);
  assert.equal(opts.accessToken, goodIdentity.accessToken);
  assert.equal(typeof s.sendEvent, "undefined");
  assert.equal(typeof s.send, "undefined");
  await s.close(); await s.close();
  assert.ok(sdkStoreKey.every(byte => byte === 0),
    "Bootstrap's SDK key copy must be cleared after closing");
  assert.equal(goodIdentity.storageKey[0], 1,
    "Caller retains responsibility for their original key buffer");
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
test("room inspection uses SDK membership rather than caller-supplied peer lists", async () => {
  const env = fakeSdk({ crypto: {
    async isEncryptionEnabledInRoom(room) { return room !== "!plain:example.test"; },
    async getUserVerificationStatus(user) {
      return { needsUserApproval: user === "@rotated:example.test",
        isCrossSigningVerified() { return true; } };
    }
  }, client: {
    async getJoinedRoomMembers() {
      return { joined: [
        { user_id: goodIdentity.userId },
        { user_id: "@bob:example.test" },
        { user_id: "@rotated:example.test" }
      ] };
    }
  }});
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  assert.equal((await s.inspectRoom("!plain:example.test")).encryptionReported, false);
  assert.match((await s.inspectRoom("!secure:example.test",
    ["@bob:example.test"])).reason, /Caller-provided/);
  const status = await s.inspectRoom("!secure:example.test");
  assert.equal(status.verifiedIdentities, false,
    "An omitted changed participant must not be excluded from the verified state");
  assert.equal(status.roomMemberCount, 3);
  assert.equal(status.peers.length, 2);
  assert.equal(status.canSend, false);
  await s.close();
});
test("room with fully verified user identities remains send-blocked", async () => {
  const env = fakeSdk();
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const state = await s.inspectRoom("!secure:example.test");
  assert.equal(state.verifiedIdentities, true);
  assert.equal(state.roomMemberCount, 2);
  assert.equal(state.canSend, false, "Peer devices have not been verified");
  await s.close();
});
test("missing or malicious membership, own-user omission and API errors fail closed", async () => {
  for (const joined of [
    null, [], [{ user_id: "@bob:example.test" }, { user_id: "@carol:example.test" }],
    [{ user_id: goodIdentity.userId }, { user_id: "@invalid" }],
    [{ user_id: goodIdentity.userId }]
  ]) {
    const env = fakeSdk({ client: {
      async getJoinedRoomMembers() { return { joined }; }
    }});
    const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
    const status = await s.inspectRoom("!secure:example.test");
    assert.equal(status.canSend, false);
    assert.notEqual(status.verifiedIdentities, true);
    await s.close();
  }
  const env = fakeSdk({ client: {
    async getJoinedRoomMembers() { throw new Error("untrusted server response"); }
  }});
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const state = await s.inspectRoom("!secure:example.test");
  assert.equal(state.canSend, false);
  assert.doesNotMatch(state.reason, /untrusted server/);
  await s.close();
});
test("SDK-shaped user verification does not require unsupported known field", async () => {
  const env = fakeSdk({ crypto: {
    async getUserVerificationStatus() {
      // Real UserVerificationStatus has no "known" member.
      return { needsUserApproval: false, isCrossSigningVerified() { return true; } };
    }
  }});
  const session = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const room = await session.inspectRoom("!secure:example.test");
  assert.equal(room.verifiedIdentities, true);
  assert.equal(room.peers[0].verified, true);
  assert.equal(room.canSend, false, "A verified user is not proof of trusted recipient devices");
  await session.close();
});

test("incomplete or changed SDK user trust status always fails closed", async () => {
  for (const status of [
    null, {}, { isCrossSigningVerified() { return true; } },
    { needsUserApproval: false },
    { needsUserApproval: true, isCrossSigningVerified() { return true; } },
    { needsUserApproval: false, isCrossSigningVerified() { return false; } },
  ]) {
    const env = fakeSdk({ crypto: { async getUserVerificationStatus() { return status; } } });
    const session = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
    const result = await session.inspectRoom("!secure:example.test");
    assert.notEqual(result.verifiedIdentities, true);
    assert.equal(result.canSend, false);
    await session.close();
  }
});

test("closing the session prevents further trust or recovery calls", async () => {
  const env = fakeSdk();
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  await s.close();
  await assert.rejects(s.inspectRecovery(), /closed/);
  await assert.rejects(s.inspectRoom("!r:example.test"), /closed/);
});

test("concurrent close callers wait for the same completed SDK shutdown", async () => {
  let finishStop;
  let stops = 0;
  const env = fakeSdk({ client: {
    async stopClient() {
      stops++;
      await new Promise(resolve => { finishStop = resolve; });
      env.calls.push("stop-finished");
    }
  } });
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const a = s.close();
  const b = s.close();
  assert.equal(s.closed, true);
  assert.equal(s.cryptoInitialized, false);
  let aDone = false, bDone = false;
  a.then(() => { aDone = true; });
  b.then(() => { bDone = true; });
  await Promise.resolve();
  assert.equal(aDone, false);
  assert.equal(bDone, false);
  assert.equal(env.isLocked(), true, "Lease must remain held until client stops");
  finishStop();
  await Promise.all([a, b]);
  assert.equal(stops, 1);
  assert.equal(aDone, true);
  assert.equal(bDone, true);
  assert.equal(env.isLocked(), false);
  assert.equal(env.calls.filter(x => x === "release").length, 1);
});

test("in-flight room membership cannot be reported trusted after close", async () => {
  let finishMembers;
  const env = fakeSdk({ client: {
    async getJoinedRoomMembers() {
      return await new Promise(resolve => { finishMembers = resolve; });
    }
  } });
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const inspection = s.inspectRoom("!encrypted:example.test");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finishMembers, "function");
  await s.close();
  finishMembers({ joined: [
    { user_id: goodIdentity.userId }, { user_id: "@bob:example.test" }
  ] });
  await assert.rejects(inspection, error => error.code === "SESSION_CLOSED");
});

test("in-flight recovery completion cannot report prior crypto state after close", async () => {
  let finishBackup;
  const env = fakeSdk({ crypto: {
    async getKeyBackupInfo() {
      return await new Promise(resolve => { finishBackup = resolve; });
    }
  } });
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const inspection = s.inspectRecovery();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finishBackup, "function");
  await s.close();
  finishBackup({ version: "1" });
  await assert.rejects(inspection, error => error.code === "SESSION_CLOSED");
});

test("shutdown releases the lease even if the real SDK stop rejects", async () => {
  const env = fakeSdk({ client: {
    async stopClient() { throw new Error("transport shutdown failed"); }
  } });
  const s = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  const a = s.close(), b = s.close();
  await assert.rejects(a, /shutdown failed/);
  await assert.rejects(b, /shutdown failed/);
  assert.equal(env.isLocked(), false);
  assert.equal(env.calls.filter(x => x === "release").length, 1);
});

test("SDK startup failure wipes the bootstrap's private store-key copy", async () => {
  let capturedKey;
  const env = fakeSdk({ client: {
    async initRustCrypto(options) {
      capturedKey = options.storageKey;
      throw new Error("synthetic startup failure");
    }
  } });
  await assert.rejects(SecureDataBootstrap.open({ ...goodIdentity, ...env }),
    error => error.code === "INITIALIZATION_FAILED");
  assert.ok(capturedKey instanceof Uint8Array);
  assert.ok(capturedKey.every(byte => byte === 0));
  assert.equal(goodIdentity.storageKey[0], 1);
  assert.equal(env.isLocked(), false);
});

test("simultaneous shutdown wipes the key even if stopClient throws", async () => {
  let capturedKey;
  const env = fakeSdk({ client: {
    async initRustCrypto(options) { capturedKey = options.storageKey; },
    async stopClient() { throw new Error("synthetic stop rejection"); }
  } });
  const session = await SecureDataBootstrap.open({ ...goodIdentity, ...env });
  await assert.rejects(session.close(), /stop rejection/);
  assert.ok(capturedKey.every(byte => byte === 0));
  assert.equal(env.isLocked(), false);
});

test("crypto IndexedDB namespace is stable within a device and isolated across identities", async () => {
  const scopeFor = async (override = {}) => {
    const identity = { ...goodIdentity, ...override };
    const env = fakeSdk({ client: {
      async whoami() {
        return { user_id: identity.userId, device_id: identity.deviceId };
      }
    } });
    const session = await SecureDataBootstrap.open({ ...identity, ...env });
    const scope = env.calls.find(c => Array.isArray(c) && c[0] === "rust-crypto")[3];
    await session.close();
    return scope;
  };
  const original = await scopeFor();
  assert.equal(await scopeFor(), original);
  for (const changes of [
    { homeserver: "https://other.example.test" },
    { userId: "@bob:example.test" },
    { deviceId: "ALICE2" }
  ]) {
    assert.notEqual(await scopeFor(changes), original,
      "Different server, user or device must never share the same crypto-store prefix");
  }
});

test("hashing failures cannot fall back to the SDK's shared default crypto store", async () => {
  const env = fakeSdk();
  await assert.rejects(SecureDataBootstrap.open({
    ...goodIdentity, ...env,
    subtle: { async digest() { throw Error("private source details"); } }
  }), error => error.code === "STORE_SCOPE_UNAVAILABLE" &&
    !error.message.includes("private source"));
  assert.deepEqual(env.calls, [], "Client and Web Locks must not be touched");
});
