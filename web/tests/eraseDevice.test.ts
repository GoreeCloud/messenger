import { describe, expect, it } from "vitest";
import {
  eraseBrowserCryptoDevice, exactCryptoDeletionTargets,
} from "../src/eraseDevice";
import { persistentDeviceScope, requiredCryptoDatabases, storageKey } from "../src/deviceStore";

const origin = "https://matrix.example.org";
const account = "@alice:example.org";

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, val: string) => { items.set(key, val); },
    removeItem: (key: string) => { items.delete(key); },
    items,
  };
}

function fakeFactory(initial: string[], mode: "ok" | "blocked" | "error" = "ok") {
  const names = new Set(initial);
  const deleted: string[] = [];
  return {
    names, deleted,
    databases: async () => [...names].map(name => ({ name })),
    deleteDatabase(name: string) {
      deleted.push(name);
      const req: {
        onsuccess: (() => void) | null;
        onblocked: (() => void) | null;
        onerror: (() => void) | null;
      } = { onsuccess: null, onblocked: null, onerror: null };
      queueMicrotask(() => {
        if (mode === "blocked") return req.onblocked?.();
        if (mode === "error") return req.onerror?.();
        names.delete(name);
        req.onsuccess?.();
      });
      return req as unknown as IDBOpenDBRequest;
    },
  };
}

function fakeLocks(available = true) {
  let open = false;
  return {
    isOpen: () => open,
    request: async (
      _name: string, _options: unknown,
      callback: (lock: unknown) => Promise<void> | void,
    ) => {
      if (!available) return callback(null);
      open = true;
      try { await callback({ name: "exclusive" }); }
      finally { open = false; }
    },
  };
}

describe("explicit scope-only browser crypto device erasure", () => {
  it("limits deletion targets to known Matrix Rust DBs for one account", async () => {
    const scope = await persistentDeviceScope(origin, account);
    const otherScope = await persistentDeviceScope(origin, "@bob:example.org");
    const allowed = requiredCryptoDatabases(scope);
    expect(exactCryptoDeletionTargets(scope, [
      ...allowed, ...requiredCryptoDatabases(otherScope), "unrelated-app",
    ])).toEqual(allowed);
  });

  it("erases exact crypto DB pair, then nonsecret metadata and releases lock", async () => {
    const scope = await persistentDeviceScope(origin, account);
    const allowed = requiredCryptoDatabases(scope);
    const foreign = requiredCryptoDatabases(await persistentDeviceScope(origin, "@bob:example.org"));
    const store = fakeStorage();
    store.setItem(storageKey(scope), JSON.stringify({ v: 1, id: "EXAMPLE" }));
    const factory = fakeFactory([...allowed, ...foreign, "unrelated-db"]);
    const locks = fakeLocks();
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, factory, locks,
    )).resolves.toBe(2);
    expect(factory.deleted).toEqual(allowed);
    expect([...factory.names]).toEqual([...foreign, "unrelated-db"]);
    expect(store.getItem(storageKey(scope))).toBeNull();
    expect(locks.isOpen()).toBe(false);
  });

  it("never deletes anything without exact typed acknowledgment", async () => {
    const scope = await persistentDeviceScope(origin, account);
    const factory = fakeFactory([...requiredCryptoDatabases(scope)]);
    const store = fakeStorage();
    await expect(eraseBrowserCryptoDevice(
      origin, account, "erase", store, factory, fakeLocks(),
    )).rejects.toThrow("Type ERASE");
    expect(factory.deleted).toEqual([]);
  });

  it("refuses erasure when another tab owns the device lock", async () => {
    const scope = await persistentDeviceScope(origin, account);
    const factory = fakeFactory([...requiredCryptoDatabases(scope)]);
    const store = fakeStorage();
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, factory, fakeLocks(false),
    )).rejects.toThrow(/already open/);
    expect(factory.deleted).toEqual([]);
  });

  it.each(["blocked", "error"] as const)(
    "retains metadata on a %s database failure", async mode => {
      const scope = await persistentDeviceScope(origin, account);
      const store = fakeStorage();
      store.setItem(storageKey(scope), "nonsecret");
      const factory = fakeFactory([...requiredCryptoDatabases(scope)], mode);
      const locks = fakeLocks();
      await expect(eraseBrowserCryptoDevice(
        origin, account, "ERASE", store, factory, locks,
      )).rejects.toThrow();
      expect(store.getItem(storageKey(scope))).toBe("nonsecret");
      expect(locks.isOpen()).toBe(false);
    },
  );

  it("can explicitly clean an orphaned partial store but never other accounts", async () => {
    const scope = await persistentDeviceScope(origin, account);
    const target = requiredCryptoDatabases(scope)[0];
    const store = fakeStorage();
    const factory = fakeFactory([target, "other-app"]);
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, factory, fakeLocks(),
    )).resolves.toBe(1);
    expect(factory.deleted).toEqual([target]);
    expect([...factory.names]).toEqual(["other-app"]);
  });

  it("fails closed on wrong account, missing metadata and missing enumeration", async () => {
    const store = fakeStorage();
    const factory = fakeFactory([]);
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, factory, fakeLocks(),
    )).rejects.toThrow(/No stored/);
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, undefined, fakeLocks(),
    )).rejects.toThrow(/IndexedDB enumeration/);
    await expect(eraseBrowserCryptoDevice(
      origin, "alice", "ERASE", store, factory, fakeLocks(),
    )).rejects.toThrow(/full Matrix ID/);
  });

  it("removes device ID even if both DBs already absent but metadata persisted", async () => {
    const store = fakeStorage();
    const scope = await persistentDeviceScope(origin, account);
    store.setItem(storageKey(scope), "remnant");
    await expect(eraseBrowserCryptoDevice(
      origin, account, "ERASE", store, fakeFactory([]), fakeLocks(),
    )).resolves.toBe(0);
    expect(store.getItem(storageKey(scope))).toBeNull();
  });
});
