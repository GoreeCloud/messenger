import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryOutbox, OutboxError } from "../src/outbox.mjs";

const room = { id: "!a:example.org", encrypted: "plaintext" };

test("concurrent sends coalesce to one transport call with stable transaction id", async () => {
  let calls = 0, resolveSend;
  const transport = { sendPlaintext: async (...args) => {
    calls++;
    assert.equal(args[2], "fixed-txn-id");
    return new Promise(resolve => { resolveSend = resolve; });
  }};
  const outbox = new InMemoryOutbox({ transport });
  const args = { room, text: "Hello", txnId: "fixed-txn-id", allowPlaintext: true };
  const first = outbox.dispatch(args);
  const second = outbox.dispatch(args);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveSend({ event_id: "$1" });
  assert.deepEqual(await first, { event_id: "$1" });
  assert.deepEqual(await second, { event_id: "$1" });
  assert.equal(outbox.getStatus(room.id, args.txnId), "sent");
  await outbox.dispatch(args);
  assert.equal(calls, 1, "sent messages must not be transmitted twice");
});

test("failed delivery preserves the original id for explicit retry", async () => {
  const ids = [];
  const transport = { sendPlaintext: async (_, __, id) => {
    ids.push(id);
    if (ids.length === 1) throw new Error("temporary transport failure");
    return { event_id: "$ack" };
  }};
  const outbox = new InMemoryOutbox({ transport });
  const args = { room, text: "retry me", txnId: "retry-id-123", allowPlaintext: true };
  await assert.rejects(outbox.dispatch(args), /temporary/);
  assert.equal(outbox.getStatus(room.id, args.txnId), "failed");
  assert.deepEqual(await outbox.dispatch(args), { event_id: "$ack" });
  assert.deepEqual(ids, ["retry-id-123", "retry-id-123"]);
});

test("message content cannot mutate under an existing transaction id", async () => {
  const transport = { sendPlaintext: async () => ({ event_id: "$ok" }) };
  const outbox = new InMemoryOutbox({ transport });
  await outbox.dispatch({ room, text: "original", txnId: "same-id-123", allowPlaintext: true });
  assert.throws(() => outbox.dispatch(
    { room, text: "tampered", txnId: "same-id-123", allowPlaintext: true }
  ), OutboxError);
});

test("blocked/no-consent sends never touch network", () => {
  let calls = 0;
  const outbox = new InMemoryOutbox({ transport: { sendPlaintext: () => { calls++; } } });
  assert.throws(() => outbox.dispatch({ room, text: "x", txnId: "test-id-123" }), /consent/);
  assert.throws(() => outbox.dispatch({ room: { ...room, encrypted: "encrypted" },
    text: "x", txnId: "test-id-123", allowPlaintext: true }), /not approved/);
  assert.equal(calls, 0);
});

test("session close is idempotent and rejects late writes", async () => {
  const outbox = new InMemoryOutbox({
    transport: { sendPlaintext: async () => ({ event_id: "$x" }) }
  });
  outbox.close(); outbox.close();
  assert.throws(() => outbox.dispatch(
    { room, text: "late", txnId: "late-id-123", allowPlaintext: true }
  ), /closed/);
  assert.equal(outbox.getStatus(room.id, "late-id-123"), "unknown");
});

test("closed session suppresses late acknowledgment", async () => {
  let resolve;
  const outbox = new InMemoryOutbox({
    transport: { sendPlaintext: () => new Promise(done => { resolve = done; }) }
  });
  const pending = outbox.dispatch(
    { room, text: "pending", txnId: "pending-123", allowPlaintext: true });
  await Promise.resolve();
  outbox.close();
  resolve({ event_id: "$late" });
  await assert.rejects(pending, /closed/);
});

test("invalid homeserver acknowledgment remains a retryable unknown delivery", async () => {
  let attempts = 0;
  const outbox = new InMemoryOutbox({
    transport: { sendPlaintext: async () => {
      attempts++;
      return attempts === 1 ? { error: "bad ack" } : { event_id: "$ok" };
    } }
  });
  const args = { room, text: "retry me", txnId: "stable-id-123", allowPlaintext: true };
  await assert.rejects(outbox.dispatch(args), /acknowledge/);
  assert.equal(outbox.getStatus(room.id, args.txnId), "failed");
  assert.deepEqual(await outbox.dispatch(args), { event_id: "$ok" });
  assert.equal(attempts, 2);
});
