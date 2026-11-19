import { normalizeHomeserver, validMatrixId } from "./config";

/**
 * Only nonsecret device-ID metadata goes in LocalStorage. Matrix session
 * tokens and unlock phrases MUST NOT be saved by this helper.
 *
 * Rust IndexedDB crypto records are encrypted with a user-entered passphrase,
 * are unique per homeserver/user, and are guarded by an exclusive Web Lock.
 */
export interface DeviceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function validateVaultPassphrase(passphrase: string): void {
  if (passphrase.length < 20 || passphrase.length > 1024 ||
      /[\u0000-\u001f\u007f]/.test(passphrase)) {
    throw new Error("Use a unique 20–1024 character encryption passphrase without control characters.");
  }
}

/** Deliberately do not lowercase Matrix IDs: localparts are case-sensitive. */
export async function persistentDeviceScope(origin: string, account: string): Promise<string> {
  if (!validMatrixId(account)) {
    throw new Error("Persistent devices require a full Matrix ID (@user:server).");
  }
  const host = normalizeHomeserver(origin);
  if (!globalThis.crypto?.subtle) throw new Error("Secure browser cryptography is unavailable.");
  const source = new TextEncoder().encode("goreecloud-messenger.v1\0" + host + "\0" + account);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Matrix JS SDK 45.1.0 names its Rust crypto stores using these suffixes.
 * Check both BEFORE login: reusing a remembered device without its crypto
 * database would silently generate NEW keys under the OLD Matrix device ID.
 */
export function cryptoDatabasePrefix(scope: string): string {
  if (!/^[0-9a-f]{64}$/.test(scope)) throw new Error("Invalid crypto device scope.");
  return "goreecloud-messenger-v1-" + scope;
}

export function requiredCryptoDatabases(scope: string): readonly [string, string] {
  const prefix = cryptoDatabasePrefix(scope);
  return [prefix + "::matrix-sdk-crypto", prefix + "::matrix-sdk-crypto-meta"];
}

export function requireConsistentCryptoDatabases(
  scope: string,
  rememberedDeviceId: string | null,
  existingNames: Iterable<string | undefined>,
): void {
  const expected = requiredCryptoDatabases(scope);
  const existing = new Set(existingNames);
  const present = expected.filter(name => existing.has(name));
  if (rememberedDeviceId !== null && present.length !== expected.length) {
    throw new Error("Encrypted device database is missing. Existing device keys cannot be safely restored.");
  }
  if (rememberedDeviceId === null && present.length > 0) {
    throw new Error("Unrecognized encrypted device data found. Login is blocked to protect existing keys.");
  }
}

export function storageKey(scope: string): string {
  if (!/^[0-9a-f]{64}$/.test(scope)) throw new Error("Invalid crypto device scope.");
  return "goreecloud-messenger-device-v1:" + scope;
}

export function readRememberedDevice(storage: DeviceStorage, scope: string): string | null {
  const raw = storage.getItem(storageKey(scope));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Saved device metadata is corrupted."); }
  if (!value || typeof value !== "object" || !("v" in value) || !("id" in value) ||
      value.v !== 1 || typeof value.id !== "string" ||
      value.id.length < 1 || value.id.length > 255 ||
      /[\u0000-\u001f\u007f\s]/.test(value.id)) {
    throw new Error("Saved device metadata is invalid.");
  }
  return value.id;
}

export function storeRememberedDevice(storage: DeviceStorage, scope: string, id: string): void {
  if (!id || id.length > 255 || /[\u0000-\u001f\u007f\s]/.test(id)) {
    throw new Error("Cannot persist an invalid Matrix device ID.");
  }
  storage.setItem(storageKey(scope), JSON.stringify({ v: 1, id }));
}

export interface ExclusiveLock {
  release(): void;
}

/**
 * Wait only for a lock-acquisition callback, NOT the lifetime of the lease.
 * Fails closed when this origin cannot guarantee exclusive access to IndexedDB.
 */
export async function acquireCryptoLease(
  name: string,
  locks: { request(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown) => Promise<void> | void,
  ): Promise<unknown> } | undefined,
): Promise<ExclusiveLock> {
  if (!locks) throw new Error("Web Locks API required for encrypted local device storage.");
  let finish: (() => void) | undefined;
  const granted = new Promise<ExclusiveLock>((resolve, reject) => {
    void locks.request(name, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) {
        reject(new Error("This encrypted device is already open in another tab."));
        return;
      }
      await new Promise<void>(done => {
        finish = done;
        resolve({ release: () => { finish?.(); finish = undefined; } });
      });
    }).catch(reject);
  });
  return granted;
}
