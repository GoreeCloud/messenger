/**
 * Test-only: the actual pinned Matrix Rust SDK running through GoreeCloud's
 * read-only secure-DATA bootstrap. All identities, tokens and keys are synthetic
 * in an ephemeral Chromium profile. No live homeserver or message operations.
 */
import { createClient } from "matrix-js-sdk";
import { SecureDataBootstrap } from "../../src/secure-data.mjs";
import { acquireCryptoStoreLease } from "../../src/crypto-store-lease.mjs";

const out = document.getElementById("result");
function status(state, message) {
  out.dataset.status = state;
  out.textContent = message;
}
function insist(condition, message) {
  if (!condition) throw Error(message);
}
const phase = new URL(location.href).searchParams.get("phase") || "first";
const key = Uint8Array.from({ length: 32 }, (_, n) => n + 1);
const owner = "@synthetic:localhost";
const device = "BROWSERTEST1";
const dbPrefix = "goreecloud-messenger-v1-";
const validToken = "synthetic-never-valid-token";
const invalidToken = "synthetic-mismatch-device-token";

async function open(accessToken, onCreate = () => {}, storeKey = key) {
  return SecureDataBootstrap.open({
    homeserver: location.origin, accessToken, userId: owner, deviceId: device,
    storageKey: storeKey, createClient: options => {
      const client = createClient(options);
      onCreate(client);
      return client;
    }
  });
}

async function run() {
  if (!isSecureContext || !indexedDB || !crypto?.subtle || !navigator.locks) {
    throw Error("Secure browser storage prerequisites unavailable");
  }
  if (!["first", "reopen"].includes(phase)) throw Error("Unexpected test phase");
  status("running", phase);

  // The server returns an intentionally mismatched device for this synthetic
  // token. Crypto initialization MUST be rejected before any store opens.
  if (phase === "first") {
    let rejected = false;
    try {
      const impossible = await open(invalidToken);
      await impossible.close();
    } catch (error) {
      rejected = error.code === "IDENTITY_MISMATCH";
    }
    insist(rejected, "The real SDK/bootstrap accepted a mismatched Matrix device");
    const empty = (await indexedDB.databases()).map(x => x.name || "");
    insist(!empty.some(name => name.startsWith(dbPrefix)),
      "Invalid identity must not initialize a crypto-store database");
  }

  if (phase === "reopen") {
    // A wrong key must never silently create a usable view of an existing
    // encrypted crypto database. The original correct key must still work.
    const existing = (await indexedDB.databases()).map(db => db.name || "");
    insist(existing.some(name => name.startsWith(dbPrefix)),
      "Precondition: previous Rust IndexedDB store is missing");
    const wrongKey = Uint8Array.from({ length: 32 }, (_, n) => n + 17);
    let wrongKeyRejected = false;
    try {
      const unexpectedlyOpened = await open(validToken, () => {}, wrongKey);
      await unexpectedlyOpened.close();
    } catch (error) {
      wrongKeyRejected = error?.code === "INITIALIZATION_FAILED";
    } finally {
      wrongKey.fill(0);
    }
    insist(wrongKeyRejected, "The real Rust store accepted an incorrect device key");
    const originalRemains = (await indexedDB.databases()).map(db => db.name || "");
    insist(existing.every(name => originalRemains.includes(name)),
      "Wrong-key probe unexpectedly removed the persistent crypto store");
    // An initialization error must have released the exclusive Web Lock.
    const afterRejection = await acquireCryptoStoreLease();
    await afterRejection.release();
  }

  let sdkClient;
  const session = await open(validToken, client => { sdkClient = client; });
  try {
    insist(session.cryptoInitialized === true, "Secure bootstrap did not initialize Rust");
    insist(session.identity.userId === owner && session.identity.deviceId === device,
      "Secure bootstrap returned the wrong identity");
    insist(typeof session.send === "undefined" &&
      typeof session.sendEvent === "undefined", "Read-only bootstrap exposed sending");
    const cryptoApi = sdkClient?.getCrypto();
    insist(cryptoApi && typeof cryptoApi.getVersion === "function" &&
      typeof cryptoApi.getVersion() === "string", "Actual Rust CryptoApi is unavailable");

    const snapshot = await session.inspectRecovery();
    insist(snapshot.status === "blocked" && snapshot.canSend === false,
      "Recovery assessment must never authorize encrypted messaging");
    const room = await session.inspectRoom("!synthetic:localhost");
    insist(room.status === "blocked" && room.canSend === false,
      "Room assessment must never authorize encrypted messaging");

    const held = await navigator.locks.query();
    insist(held.held.some(x => x.name ===
      "goreecloud-messenger:matrix-rust-crypto-store" && x.mode === "exclusive"),
      "Bootstrap did not hold the exclusive Web Lock");
    let secondDenied = false;
    try {
      const duplicate = await acquireCryptoStoreLease();
      await duplicate.release();
    } catch (error) {
      secondDenied = String(error?.message).includes("Another Messenger tab");
    }
    insist(secondDenied, "A second crypto store owner was allowed");

    const names = (await indexedDB.databases()).map(x => x.name || "");
    insist(names.some(name => name.startsWith(dbPrefix)),
      "The real Rust backend did not create an isolated IndexedDB store");
  } finally {
    try { await session.close(); }
    finally { key.fill(0); }
  }
  const post = await acquireCryptoStoreLease();
  await post.release();
  insist(session.closed && !session.cryptoInitialized,
    "Closed bootstrap still reports active crypto");

  if (phase === "first") {
    status("reloading", "Reopening real Rust crypto via protected SDK bootstrap");
    location.replace("/index.html?phase=reopen");
    return;
  }

  const created = (await indexedDB.databases()).map(x => x.name || "")
    .filter(name => name.startsWith(dbPrefix));
  insist(created.length > 0, "Persistent Rust crypto namespace lost after page reload");
  for (const name of created) {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  }
  status("passed", "Real Rust IndexedDB + GoreeCloud guard opened, reopened, cleaned");
}
run().catch(error => {
  status("failed", String(error?.code || error?.message || error).slice(0, 300));
});
