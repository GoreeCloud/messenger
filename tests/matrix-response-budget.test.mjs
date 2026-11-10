import test from "node:test";
import assert from "node:assert/strict";
import { MatrixError, MatrixPlaintextSession } from "../src/matrix.mjs";

const sessionFor = fetchImpl => new MatrixPlaintextSession({
  homeserver: "https://matrix.example.org",
  accessToken: "disposable-test-token",
  fetchImpl
});

test("Matrix JSON reader accepts streamed UTF-8 split across chunk boundaries", async () => {
  const encoded = new TextEncoder().encode(JSON.stringify({
    user_id: "@Renée:example.org"
  }));
  const split = encoded.indexOf(0xc3) + 1;
  assert.ok(split > 1);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded.slice(0, split));
      controller.enqueue(encoded.slice(split));
      controller.close();
    }
  });
  const session = sessionFor(async () => new Response(body, { status: 200 }));
  assert.equal(await session.whoami(), "@Renée:example.org");
  session.close();
});

test("Matrix JSON reader refuses an oversized advertised Content-Length", async () => {
  const session = sessionFor(async () => new Response('{"user_id":"@a:example.org"}', {
    status: 200, headers: { "content-length": "1048577" }
  }));
  await assert.rejects(session.whoami(), error =>
    error instanceof MatrixError && /safe size limit/.test(error.message));
  session.close();
});

test("Matrix JSON reader refuses a streamed body over budget even with dishonest header", async () => {
  const session = sessionFor(async () => new Response("A".repeat(1024 * 1024 + 1), {
    status: 200, headers: { "content-length": "1" }
  }));
  await assert.rejects(session.whoami(), error =>
    error instanceof MatrixError && /safe size limit/.test(error.message));
  session.close();
});

test("Matrix JSON reader rejects absent bodies, malformed JSON and invalid UTF-8", async () => {
  const bodies = [
    new Response(null, { status: 200 }),
    new Response('{"user_id":', { status: 200 }),
    new Response(Uint8Array.from([0xc3, 0x28]), { status: 200 })
  ];
  for (const response of bodies) {
    const session = sessionFor(async () => response);
    await assert.rejects(session.whoami(), error =>
      error instanceof MatrixError &&
      /(?:readable JSON body|malformed UTF-8 JSON)/.test(error.message));
    session.close();
  }
});

test("a rejected response frees the bounded Matrix concurrency admission slot", async () => {
  let count = 0;
  const session = sessionFor(async () => {
    count++;
    return count === 1
      ? new Response("no JSON", { status: 200 })
      : Response.json({ user_id: "@safe:example.org" });
  });
  await assert.rejects(session.whoami(), MatrixError);
  assert.equal(await session.whoami(), "@safe:example.org");
  assert.equal(count, 2);
  session.close();
});

test("Matrix JSON reader rejects pathological streams of thousands of tiny chunks", async () => {
  const body = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 4097; i++) controller.enqueue(Uint8Array.of(0x20));
      controller.close();
    }
  });
  const session = sessionFor(async () => new Response(body, { status: 200 }));
  await assert.rejects(session.whoami(), error =>
    error instanceof MatrixError && /safe chunk limit/.test(error.message));
  session.close();
});
