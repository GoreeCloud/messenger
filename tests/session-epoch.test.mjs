import test from "node:test";
import assert from "node:assert/strict";
import { SessionEpoch } from "../src/session-epoch.mjs";

test("new connection invalidates stale authentication result", async () => {
  const gate = new SessionEpoch();
  const old = gate.next();
  const result = Promise.resolve().then(() => gate.isCurrent(old));
  gate.next(); // account switch or disconnect
  assert.equal(await result, false);
});
test("current operation can complete, then becomes stale after cancellation", () => {
  const gate = new SessionEpoch();
  const ticket = gate.next();
  assert.equal(gate.isCurrent(ticket), true);
  gate.next();
  assert.equal(gate.isCurrent(ticket), false);
});
test("unknown/invalid generations cannot be promoted", () => {
  const gate = new SessionEpoch();
  gate.next();
  for (const value of [0, -1, NaN, Infinity, "1", null, 1.5]) {
    assert.equal(gate.isCurrent(value), false);
  }
});
