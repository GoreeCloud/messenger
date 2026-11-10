import test from "node:test";
import assert from "node:assert/strict";
import { MatrixError, MatrixPlaintextSession } from "../src/matrix.mjs";

function response() {
  return {
    ok: true, status: 200,
    async json() { return { user_id: "@fixture:example.org" }; }
  };
}

test("limits one Matrix session to eight outstanding requests without a ninth fetch", async () => {
  let release;
  const pendingNetwork = new Promise(resolve => { release = resolve; });
  let networkCalls = 0;
  const session = new MatrixPlaintextSession({
    homeserver: "https://matrix.example.org",
    accessToken: "disposable-fixture",
    fetchImpl: async () => {
      networkCalls++;
      await pendingNetwork;
      return response();
    }
  });
  const inFlight = Array.from({ length: 8 }, () => session.whoami());
  try {
    await assert.rejects(session.whoami(), error =>
      error instanceof MatrixError && /Too many concurrent Matrix requests/.test(error.message));
    assert.equal(networkCalls, 8, "the refused ninth request must not reach the network");
  } finally {
    release();
  }
  const identities = await Promise.all(inFlight);
  assert.deepEqual(identities, Array(8).fill("@fixture:example.org"));
  assert.equal(await session.whoami(), "@fixture:example.org",
    "finishing pending responses must release all admission slots");
  assert.equal(networkCalls, 9);
  session.close();
});

test("failed Matrix requests always release admission slots", async () => {
  let networkCalls = 0;
  const session = new MatrixPlaintextSession({
    homeserver: "https://matrix.example.org",
    accessToken: "disposable-fixture",
    fetchImpl: async () => {
      networkCalls++;
      throw new Error("private provider failure");
    }
  });
  for (let i = 0; i < 20; i++) {
    await assert.rejects(session.whoami(), error =>
      error instanceof MatrixError &&
      error.message === "Could not contact the homeserver over a trusted connection",
      "provider details must not be reflected into UI errors");
  }
  assert.equal(networkCalls, 20);
  session.close();
});
