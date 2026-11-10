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

test("untrusted Matrix room identifiers never reach the plaintext transport", () => {
  let calls = 0;
  const outbox = new InMemoryOutbox({
    transport: { sendPlaintext: () => { calls++; return { event_id: "$unexpected" }; } }
  });
  for (const id of [
    "not-a-room", "!missing-suffix", "!x:", "!x:server\nname",
    "!x:server\rname", "!x:" + "a".repeat(253), "!x:\u0000",
  ]) {
    assert.throws(() => outbox.dispatch({
      room: { id, encrypted: "plaintext" }, text: "private",
      txnId: "safe-txn-123", allowPlaintext: true,
    }), /not approved/);
  }
  assert.equal(calls, 0);
});

test("missing, control-bearing and oversized event IDs never confirm delivery", async () => {
  for (const eventId of [
    "$", "not-an-event", "$valid\nnot-safe", "$valid\tstill-not-safe",
    "$" + "x".repeat(512), null, 42,
  ]) {
    const outbox = new InMemoryOutbox({
      transport: { sendPlaintext: async () => ({ event_id: eventId }) }
    });
    const args = { room, text: "retry after invalid ack",
      txnId: "stable-ack-123", allowPlaintext: true };
    await assert.rejects(outbox.dispatch(args), /valid event ID/);
    assert.equal(outbox.getStatus(room.id, args.txnId), "failed");
  }
});

test("valid acknowledgments retain only bounded immutable event identity", async () => {
  const response = { event_id: "$event:example.org", unexpected_secret: "not-retained" };
  let calls = 0;
  const outbox = new InMemoryOutbox({
    transport: { sendPlaintext: async () => { calls++; return response; } }
  });
  const args = { room, text: "one send", txnId: "stable-id-345", allowPlaintext: true };
  const receipt = await outbox.dispatch(args);
  assert.deepEqual(receipt, { event_id: "$event:example.org" });
  assert.ok(Object.isFrozen(receipt));
  assert.equal("unexpected_secret" in receipt, false);
  response.event_id = "$forged-late";
  assert.deepEqual(await outbox.dispatch(args), { event_id: "$event:example.org" });
  assert.equal(calls, 1);
});
