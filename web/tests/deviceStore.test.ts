import { describe, expect, it } from "vitest";
import {
  acquireCryptoLease, persistentDeviceScope, readRememberedDevice,
  requireConsistentCryptoDatabases, requiredCryptoDatabases,
  storageKey, storeRememberedDevice, validateVaultPassphrase,
} from "../src/deviceStore";

function mockStorage() {
  const saved = new Map<string, string>();
  return {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
    saved,
  };
}

describe("encrypted device metadata policy", () => {
  it("scopes devices by homeserver and exact case-sensitive account", async () => {
    const key = await persistentDeviceScope("https://matrix.example.org/", "@Alice:example.org");
    const different = await persistentDeviceScope("https://matrix.example.org/", "@alice:example.org");
    expect(key).toHaveLength(64);
    expect(key).not.toBe(different);
    expect(key).not.toContain("Alice");
    expect(storageKey(key)).not.toContain("@");
  });

  it("blocks short account aliases for opt-in persistence", async () => {
    await expect(persistentDeviceScope("https://matrix.example.org", "alice")).rejects.toThrow();
  });

  it("never stores access tokens or unlock phrases in remembered metadata", async () => {
    const memory = mockStorage();
    const scope = await persistentDeviceScope("https://matrix.example.org", "@alice:example.org");
    storeRememberedDevice(memory, scope, "DEVICE-123");
    expect(readRememberedDevice(memory, scope)).toBe("DEVICE-123");
    expect([...memory.saved.values()].join("")).not.toContain("access_token");
    expect([...memory.saved.values()].join("")).not.toContain("@alice");
  });

  it("fails closed on corrupt or injected device IDs", async () => {
    const memory = mockStorage();
    const scope = await persistentDeviceScope("https://matrix.example.org", "@alice:example.org");
    memory.setItem(storageKey(scope), "{corrupt");
    expect(() => readRememberedDevice(memory, scope)).toThrow();
    memory.setItem(storageKey(scope), JSON.stringify({ v: 1, id: "BAD\nDEVICE" }));
    expect(() => readRememberedDevice(memory, scope)).toThrow();
    expect(() => storeRememberedDevice(memory, scope, "")).toThrow();
  });

  it("validates passphrase strength proxy, not entropy claims", () => {
    expect(() => validateVaultPassphrase("short")).toThrow();
    expect(() => validateVaultPassphrase("a".repeat(20))).not.toThrow();
    expect(() => validateVaultPassphrase("a".repeat(20) + "\n")).toThrow();
  });

  it("requires Web Locks support and never allows a missing lock", async () => {
    await expect(acquireCryptoLease("crypto:one", undefined)).rejects.toThrow();
    const unavailable = { request: async (_name: string, _options: unknown, cb: (lock: unknown) => void) => cb(null) };
    await expect(acquireCryptoLease("crypto:one", unavailable)).rejects.toThrow();
  });

  it("rejects key loss when only part of remembered Rust store persists", async () => {
    const scope = await persistentDeviceScope("https://matrix.example.org", "@alice:example.org");
    const both = requiredCryptoDatabases(scope);
    expect(both).toHaveLength(2);
    expect(() => requireConsistentCryptoDatabases(scope, "DEVICE", both)).not.toThrow();
    expect(() => requireConsistentCryptoDatabases(scope, "DEVICE", [both[0]])).toThrow(/database is missing/);
    expect(() => requireConsistentCryptoDatabases(scope, "DEVICE", [])).toThrow(/database is missing/);
  });

  it("blocks orphaned crypto records when metadata is missing", async () => {
    const scope = await persistentDeviceScope("https://matrix.example.org", "@alice:example.org");
    const both = requiredCryptoDatabases(scope);
    expect(() => requireConsistentCryptoDatabases(scope, null, [])).not.toThrow();
    expect(() => requireConsistentCryptoDatabases(scope, null, [both[1]])).toThrow(/Unrecognized/);
    expect(() => requireConsistentCryptoDatabases(scope, null, both)).toThrow(/Unrecognized/);
    expect(() => requireConsistentCryptoDatabases(scope, null, ["unrelated-database"])).not.toThrow();
  });

  it("holds the granted lock until the session explicitly releases it", async () => {
    let inside = false;
    const locks = {
      request: async (_name: string, _opts: unknown, callback: (lock: unknown) => Promise<void> | void) => {
        inside = true;
        try { await callback({ name: "locked" }); } finally { inside = false; }
      },
    };
    const lease = await acquireCryptoLease("crypto:test", locks);
    expect(inside).toBe(true);
    lease.release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(inside).toBe(false);
  });
});
