#!/usr/bin/env node
/**
 * Opt-in acceptance harness with two independent Matrix Rust crypto clients.
 * Requires two disposable accounts on an isolated, authorized test server.
 * Creates and leaves a room (homeserver event history persists).
 */
import { randomUUID } from "node:crypto";
import { EventType, Preset, Visibility, createClient } from "matrix-js-sdk";
import { readTestEnvironment, requiredNames } from "./e2ee-config.mjs";
import { requireEncryptedRoom, sendEncryptedText } from "../src/security.ts";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeoutMs, purpose) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await sleep(400);
  }
  throw new Error("Timed out: " + purpose);
}
async function bounded(task, timeoutMs, purpose) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timed out: " + purpose)), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
async function connect(homeserver, userId, password, timeoutMs) {
  const anonymous = createClient({ baseUrl: homeserver });
  const login = await bounded(anonymous.loginWithPassword(userId, password), timeoutMs, "login");
  if (!login.access_token || !login.user_id || !login.device_id) {
    throw new Error("Homeserver did not create a test device.");
  }
  const client = createClient({
    baseUrl: homeserver, userId: login.user_id,
    accessToken: login.access_token, deviceId: login.device_id,
  });
  try {
    // Never persist ephemeral smoke-test access tokens or crypto keys.
    await bounded(client.initRustCrypto({ useIndexedDB: false }), timeoutMs, "crypto init");
    if (!client.getCrypto()) throw new Error("Rust crypto unavailable.");
    client.startClient({ initialSyncLimit: 15 });
    await until(() => client.isInitialSyncComplete(), timeoutMs, "initial sync");
    return client;
  } catch (e) {
    client.stopClient();
    try { await bounded(client.logout(), 5000, "failed-login cleanup"); } catch {}
    throw e;
  }
}
async function cleanup(client) {
  if (!client) return;
  client.stopClient();
  try { await bounded(client.logout(), 5000, "session cleanup"); } catch {}
}
async function main() {
  if (process.argv.includes("--help") || !requiredNames.every(name => process.env[name])) {
    console.log("Opt-in two-account Matrix encrypted message acceptance.");
    console.log("Requires trusted HTTPS test server and two disposable accounts.");
    console.log("Required: " + requiredNames.join(", "));
    console.log("Optional: MATRIX_TEST_TIMEOUT_MS (2000–300000).");
    console.log("Test creates/leaves a room. Do not use private personal accounts.");
    if (!process.argv.includes("--help")) process.exitCode = 2;
    return;
  }
  const env = readTestEnvironment(process.env);
  let first, second, roomId = "";
  const nonce = "gc-e2ee-smoke-" + randomUUID();
  console.log("Testing two-account Matrix E2EE round trip using disposable devices.");
  try {
    const sessions = await Promise.allSettled([
      connect(env.homeserver, env.a, env.aPassword, env.timeoutMs),
      connect(env.homeserver, env.b, env.bPassword, env.timeoutMs),
    ]);
    first = sessions[0].status === "fulfilled" ? sessions[0].value : null;
    second = sessions[1].status === "fulfilled" ? sessions[1].value : null;
    if (!first || !second) throw new Error("One test account failed to connect.");
    roomId = (await bounded(first.createRoom({
      name: "Ephemeral GoreeCloud encryption acceptance",
      preset: Preset.PrivateChat, visibility: Visibility.Private,
      invite: [second.getUserId()],
      initial_state: [{
        type: EventType.RoomEncryption, state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      }],
    }), env.timeoutMs, "create encrypted room")).room_id;
    await until(() => second.getRoom(roomId)?.getMyMembership() === "invite",
      env.timeoutMs, "recipient invitation");
    await bounded(second.joinRoom(roomId), env.timeoutMs, "join room");
    await until(() => first.getRoom(roomId)?.getMyMembership() === "join" &&
      second.getRoom(roomId)?.getMyMembership() === "join",
    env.timeoutMs, "joined room state");
    await until(async () =>
      Boolean(await first.getCrypto()?.isEncryptionEnabledInRoom(roomId)) &&
      Boolean(await second.getCrypto()?.isEncryptionEnabledInRoom(roomId)),
    env.timeoutMs, "both crypto states confirmed");
    await requireEncryptedRoom(first, roomId);
    await requireEncryptedRoom(second, roomId);
    await bounded(sendEncryptedText(first, roomId, nonce), env.timeoutMs, "encrypted send");
    await until(() => {
      const events = second.getRoom(roomId)?.getLiveTimeline().getEvents() || [];
      return events.some(event => event.getType() === EventType.RoomMessage &&
        !event.isDecryptionFailure() && event.getSender() === first.getUserId() &&
        event.getContent().body === nonce);
    }, env.timeoutMs, "recipient decrypted payload");
    let blocked = false;
    try { await sendEncryptedText(first, "!missing:invalid.example", nonce); }
    catch { blocked = true; }
    if (!blocked) throw new Error("Plaintext downgrade gate unexpectedly allowed sending.");
    console.log("PASS: encrypted send, recipient decryption, and missing-room downgrade prevention.");
    console.log("Not covered: trusted identities, cross-signing, key recovery or Android devices.");
  } catch {
    // Never print upstream error strings; providers may put tokens or payloads there.
    console.error("FAIL: round trip incomplete. Debug only with disposable data and redacted logs.");
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([
      first && roomId ? bounded(first.leave(roomId), 5000, "room cleanup") : Promise.resolve(),
      second && roomId ? bounded(second.leave(roomId), 5000, "room cleanup") : Promise.resolve(),
    ]);
    await Promise.all([cleanup(first), cleanup(second)]);
  }
}
await main();
