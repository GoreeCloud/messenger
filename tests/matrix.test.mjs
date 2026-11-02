import test from "node:test";
import assert from "node:assert/strict";
import { MatrixPlaintextSession, MatrixError, validateHomeserver } from "../src/matrix.mjs";
function fake(status, payload = {}) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}
test("rejects insecure origins, embedded secrets, paths, and unsupported schemes", () => {
  for (const url of [
    "http://example.org", "https://user:pass@example.org", "https://example.org/p",
    "https://example.org/?token=a", "javascript:alert(1)", "garbage"
  ]) assert.throws(() => validateHomeserver(url));
  assert.equal(validateHomeserver("https://example.org"), "https://example.org");
  assert.equal(validateHomeserver("http://localhost:8008"), "http://localhost:8008");
});
test("auth stays in a header, caching/redirects disabled, tokens never placed in URLs", async () => {
  let seen;
  const session = new MatrixPlaintextSession({
    homeserver: "https://matrix.example.org", accessToken: "supersecret",
    fetchImpl: async (url, opts) => { seen = { url, opts }; return fake(200, { user_id: "@a:example.org" }); }
  });
  assert.equal(await session.whoami(), "@a:example.org");
  assert.ok(!seen.url.includes("supersecret"));
  assert.equal(seen.opts.headers.Authorization, "Bearer supersecret");
  assert.equal(seen.opts.redirect, "error");
  assert.equal(seen.opts.cache, "no-store");
  assert.equal(seen.opts.referrerPolicy, "no-referrer");
  session.close();
  await assert.rejects(session.whoami(), /Session closed/);
});
test("rejects unreasonable access-token length", () => {
  assert.throws(() => new MatrixPlaintextSession({
    homeserver: "https://example.org", accessToken: "a".repeat(8193)
  }), /bounded/);
});
test("encrypted or unknown rooms are blocked before any send or read", async () => {
  let calls = 0;
  const session = new MatrixPlaintextSession({
    homeserver: "https://matrix.example.org", accessToken: "x",
    fetchImpl: async () => { calls++; return fake(200, { algorithm: "m.megolm.v1.aes-sha2" }); }
  });
  const room = { id: "!r:example.org", encrypted: "encrypted" };
  await assert.rejects(session.readMessages(room), MatrixError);
  await assert.rejects(session.sendPlaintext(room, "hello", "12345678", { allowPlaintext: true }), MatrixError);
  assert.equal(calls, 0);
});
test("plaintext send requires explicit opt-in and a current plaintext state", async () => {
  const calls = [];
  const session = new MatrixPlaintextSession({
    homeserver: "https://matrix.example.org", accessToken: "x",
    fetchImpl: async (url, opts) => {
      calls.push({ url, method: opts.method });
      return url.endsWith("/state/m.room.encryption")
        ? fake(404) : fake(200, { event_id: "$e" });
    }
  });
  const room = { id: "!r:example.org", encrypted: "plaintext" };
  await assert.rejects(session.sendPlaintext(room, "hi", "12345678"), MatrixError);
  assert.equal(calls.length, 0);
  await session.sendPlaintext(room, "hi", "12345678", { allowPlaintext: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].method, "PUT");
  assert.ok(calls[1].url.endsWith("12345678"));
});
test("room transitioning to E2EE blocks plaintext PUT with cached plaintext status", async () => {
  const calls = [];
  const session = new MatrixPlaintextSession({
    homeserver: "https://example.org", accessToken: "x",
    fetchImpl: async (url, opts) => {
      calls.push(opts.method);
      return fake(200, { algorithm: "m.megolm.v1.aes-sha2" });
    }
  });
  await assert.rejects(session.sendPlaintext(
    { id: "!r:example.org", encrypted: "plaintext" }, "private", "12345678",
    { allowPlaintext: true }), /changed/);
  assert.deepEqual(calls, ["GET"]);
});
test("a forbidden state lookup is never interpreted as plaintext", async () => {
  const session = new MatrixPlaintextSession({
    homeserver: "https://example.org", accessToken: "x",
    fetchImpl: async () => fake(403)
  });
  await assert.rejects(session.inspectRoom("!r:example.org"), MatrixError);
  await assert.rejects(session.sendPlaintext(
    { id: "!r:example.org", encrypted: "plaintext" },
    "hi", "12345678", { allowPlaintext: true }), MatrixError);
});
test("read messages rechecks room state, filters text, and identifies own messages", async () => {
  const calls = [];
  const session = new MatrixPlaintextSession({
    homeserver: "https://example.org", accessToken: "x",
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith("m.room.encryption")) return fake(404);
      return fake(200, { chunk: [
        { type: "m.room.message", event_id: "$a", sender: "@self:example.org",
          content: { msgtype: "m.text", body: "hello" }, origin_server_ts: 1000 },
        { type: "m.room.encrypted", content: { ciphertext: "xxx" } },
        { type: "m.room.message", event_id: "$b", sender: "@else:example.org",
          content: { msgtype: "m.text", body: "world" }, origin_server_ts: 2000 }
      ]});
    }
  });
  const events = await session.readMessages(
    { id: "!r:example.org", encrypted: "plaintext" }, "@self:example.org"
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].text, "world");
  assert.equal(events[0].own, false);
  assert.equal(events[1].text, "hello");
  assert.equal(events[1].own, true);
  assert.equal(calls.length, 2);
});
test("closing rejects new requests and aborts in-flight requests", async () => {
  let fired = false, capturedSignal;
  const session = new MatrixPlaintextSession({
    homeserver: "https://example.org", accessToken: "x",
    fetchImpl: async (_url, opts) => {
      capturedSignal = opts.signal;
      return new Promise(resolve => {
        opts.signal.addEventListener("abort", () => {
          fired = true;
          resolve(fake(200, { user_id: "@self:example.org" }));
        }, { once: true });
      });
    }
  });
  const pending = session.whoami();
  session.close(); session.close();
  await assert.rejects(pending, /Session closed/);
  assert.equal(fired, true);
  assert.equal(capturedSignal.aborted, true);
});
