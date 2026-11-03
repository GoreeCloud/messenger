/**
 * Isolated browser-only real Matrix SDK crypto persistence test.
 * Synthetic identity & deterministic NON-SECRET test key, ephemeral profile.
 * Not imported by GoreeCloud Messenger web or Android applications.
 */
import { createClient } from "matrix-js-sdk";

const out = document.getElementById("result");
function status(state, message) {
  out.dataset.status = state;
  out.textContent = message;
}
const prefix = "goreecloud-ci-rust-indexeddb-only-v1";
const key = Uint8Array.from({ length: 32 }, (_, n) => n + 1);
const phase = new URL(location.href).searchParams.get("phase") || "first";
const created = [];
async function run() {
  if (!isSecureContext || !indexedDB || !crypto?.subtle || !navigator.locks) {
    throw Error("Secure browser crypto primitives are unavailable");
  }
  if (!["first", "reopen"].includes(phase)) throw Error("Unexpected test phase");
  status("running", phase);
  const client = createClient({
    baseUrl: location.origin,
    accessToken: "synthetic-never-valid-token",
    userId: "@synthetic:localhost",
    deviceId: "BROWSERTEST1"
  });
  let didInitialize = false;
  try {
    await client.initRustCrypto({
      useIndexedDB: true,
      storageKey: key,
      cryptoDatabasePrefix: prefix
    });
    didInitialize = true;
    const engine = client.getCrypto();
    if (!engine || typeof engine.getVersion !== "function") {
      throw Error("Actual Rust crypto engine did not initialize");
    }
    const version = engine.getVersion();
    if (typeof version !== "string" || !version) throw Error("No real Rust crypto version");
    const databases = await indexedDB.databases();
    const matches = databases.map(db => db.name || "").filter(name => name.startsWith(prefix));
    if (!matches.length) throw Error("No persistent Rust crypto IndexedDB database found");
    created.push(...matches);
  } finally {
    await client.stopClient();
    key.fill(0);
  }
  if (!didInitialize) throw Error("Crypto initialization failed");
  if (phase === "first") {
    // A fresh document/JS runtime must unlock the exact same persistent
    // encrypted-store namespace with the same device key.
    status("reloading", "Reopening the Rust IndexedDB store across navigation");
    location.replace("/index.html?phase=reopen");
    return;
  }
  // Cleanup only databases this disposable test itself owns.
  const databases = await indexedDB.databases();
  const matches = databases.map(db => db.name || "").filter(name => name.startsWith(prefix));
  if (!matches.length) throw Error("Reopened crypto store is missing");
  for (const name of matches) {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
      // A pending close may briefly block deletion; the harness timeout
      // enforces a bounded failure rather than hiding the leak.
    });
  }
  status("passed", "Rust crypto IndexedDB opened, reopened and cleaned");
}
run().catch(error => {
  // Synthetic test only. No user credentials or sensitive data are present.
  status("failed", String(error?.message || error).slice(0, 300));
});
