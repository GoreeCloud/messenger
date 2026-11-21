import {
  acquireCryptoLease, persistentDeviceScope, requiredCryptoDatabases, storageKey,
} from "./deviceStore";
import type { DeviceStorage } from "./deviceStore";

export interface EraseStorage extends DeviceStorage {
  removeItem(key: string): void;
}

/** Match native browser IDB event handler types, not a narrowed mock shape. */
export type EraseDatabaseFactory = Pick<IDBFactory, "databases" | "deleteDatabase">;

type Locks = Parameters<typeof acquireCryptoLease>[1];

/** Never use arbitrary prefix matching to delete other applications' data. */
export function exactCryptoDeletionTargets(
  scope: string, existingNames: Iterable<string | undefined>,
): string[] {
  const found = new Set(existingNames);
  return requiredCryptoDatabases(scope).filter(name => found.has(name));
}

function deleteExactDatabase(factory: EraseDatabaseFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Encrypted browser data could not be erased."));
    request.onblocked = () => reject(
      new Error("Close all other Messenger tabs before erasing this device."),
    );
  });
}

/**
 * Intentionally destructive, explicitly acknowledged *local* erasure only.
 * Token revocation on the homeserver is a separate user/account operation.
 */
export async function eraseBrowserCryptoDevice(
  origin: string,
  accountId: string,
  acknowledgment: string,
  storage: EraseStorage,
  databases: EraseDatabaseFactory | undefined,
  locks: Locks,
): Promise<number> {
  if (acknowledgment !== "ERASE") {
    throw new Error("Type ERASE to confirm irreversible local device deletion.");
  }
  if (!databases || typeof databases.databases !== "function") {
    throw new Error("IndexedDB enumeration is required to erase this device safely.");
  }

  const scope = await persistentDeviceScope(origin, accountId.trim());
  const name = storageKey(scope);
  const lease = await acquireCryptoLease(name, locks);
  try {
    const existing = await databases.databases();
    const targets = exactCryptoDeletionTargets(scope, existing.map(db => db.name));
    if (targets.length === 0 && storage.getItem(name) === null) {
      throw new Error("No stored encrypted device was found for this account.");
    }
    for (const target of targets) {
      await deleteExactDatabase(databases, target);
    }
    const remaining = exactCryptoDeletionTargets(
      scope, (await databases.databases()).map(db => db.name),
    );
    if (remaining.length > 0) {
      throw new Error("Encrypted browser data deletion could not be confirmed.");
    }
    // Remove metadata last. If an IndexedDB deletion failed, retaining the ID
    // prevents silent crypto-device replacement under lost signing keys.
    storage.removeItem(name);
    return targets.length;
  } finally {
    lease.release();
  }
}
