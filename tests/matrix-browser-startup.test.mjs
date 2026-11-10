import test from "node:test";
import assert from "node:assert/strict";
import { waitForChromiumDebugPort } from "../integration/matrix-sdk-browser/chromium-startup.mjs";

test("delayed DevTools port becomes ready without unbounded polling", async () => {
  let reads = 0, pauses = 0;
  const port = await waitForChromiumDebugPort({
    profile: "/synthetic-fresh-profile", hasExited: () => false,
    read(path, encoding) {
      assert.match(path, /DevToolsActivePort$/);
      assert.equal(encoding, "utf8");
      reads++;
      if (reads === 1) throw new Error("not ready");
      if (reads === 2) return "incomplete";
      return "49321\n/synthetic-browser-target\n";
    },
    pause: async ms => { assert.equal(ms, 100); pauses++; },
    attempts: 5
  });
  assert.equal(port, 49321);
  assert.equal(reads, 3);
  assert.equal(pauses, 2);
});

test("early Chromium failure stops without reading stale files", async () => {
  let reads = 0;
  await assert.rejects(waitForChromiumDebugPort({
    profile: "/synthetic", hasExited: () => true,
    read: () => { reads++; return "15000\n"; }, pause: async () => {}
  }), /Chromium exited/);
  assert.equal(reads, 0);
});

test("zero, over-range, malformed and partial ports cannot pass", async () => {
  let reads = 0, pauses = 0;
  const values = ["0\n", "65536\n", "123abc\n", "123", "99999\n"];
  await assert.rejects(waitForChromiumDebugPort({
    profile: "/synthetic", hasExited: () => false, attempts: values.length,
    read: () => values[reads++],
    pause: async () => { pauses++; }
  }), /bounded window/);
  assert.equal(reads, values.length);
  assert.equal(pauses, values.length - 1);
});

test("startup polling has bounded, validated configuration", async () => {
  for (const options of [{ attempts: 0 }, { attempts: 301 },
    { intervalMs: 0 }, { intervalMs: Infinity }, { profile: "" }]) {
    await assert.rejects(waitForChromiumDebugPort({
      profile: "/synthetic", hasExited: () => false,
      read: () => "1234\n", ...options
    }), TypeError);
  }
});
