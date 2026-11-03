/**
 * Secure DATA milestone: a strictly read-only Matrix Rust-crypto bootstrap.
 *
 * This does not implement encrypted message sending/receiving. It is a guarded
 * integration boundary for the maintained matrix-js-sdk; dependency import is
 * intentionally injected so the existing dependency-free plaintext preview
 * cannot accidentally download or initialize an unreviewed crypto bundle.
 *
 * A successful initRustCrypto() only establishes that the SDK crypto engine
 * initialized, NOT that device identities, key backups or rooms are trusted.
 */
import { validateHomeserver } from "./matrix.mjs";
import { acquireCryptoStoreLease } from "./crypto-store-lease.mjs";

export class SecureDataGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SecureDataGateError";
    this.code = code;
  }
}

const fail = (code, reason) => new SecureDataGateError(code, reason);
function identity(value, prefix, label) {
  if (typeof value !== "string" || !value.startsWith(prefix) ||
      value.length < 4 || value.length > 255 || /[\s\u0000-\u001f\u007f]/u.test(value) ||
      value.indexOf(":") < 2 || value.endsWith(":")) {
    throw fail("IDENTITY_INVALID", "A valid Matrix " + label + " is required");
  }
  return value;
}
function device(value) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9_.~-]{1,255}$/.test(value)) {
    throw fail("DEVICE_INVALID", "A bound Matrix device identifier is required");
  }
  return value;
}
function assertOpen(session) {
  if (session.closed) throw fail("SESSION_CLOSED", "Secure DATA session is closed");
}
function cryptoMethod(crypto, method) {
  if (!crypto || typeof crypto[method] !== "function") {
    throw fail("CRYPTO_INCOMPLETE", "Rust crypto SDK is missing a required security API");
  }
}
/**
 * Derive a stable opaque IndexedDB namespace from an *authenticated* Matrix
 * identity tuple. This is not a cryptographic secret; it is an origin-local
 * database selector that prevents normal account/device store collisions.
 * The same input must yield the same prefix on every device restart.
 */
async function scopedCryptoDatabase(origin, userId, deviceId, subtle) {
  if (!subtle || typeof subtle.digest !== "function") {
    throw fail("STORE_SCOPE_UNAVAILABLE", "Secure browser hashing is required for crypto-store separation");
  }
  try {
    const source = new TextEncoder().encode(JSON.stringify([origin, userId, deviceId]));
    const digest = new Uint8Array(await subtle.digest("SHA-256", source));
    if (digest.length !== 32) throw new Error("Invalid digest");
    return "goreecloud-messenger-v1-" + [...digest]
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw fail("STORE_SCOPE_UNAVAILABLE", "Cannot establish a device-specific crypto-store namespace");
  }
}

function blocked(reason, extra = {}) {
  return { status: "blocked", canSend: false, reason, ...extra };
}

export class SecureDataBootstrap {
  #client;
  #crypto;
  #lease;
  #closed = false;
  #closing = null;
  #identity;
  #storeKey;

  constructor(key, client, crypto, lease, storeKey) {
    this.#identity = key;
    this.#client = client;
    this.#crypto = crypto;
    this.#lease = lease;
    this.#storeKey = storeKey;
  }

  /**
   * The application must provide the exact vetted SDK createClient factory.
   * No fallback crypto implementation, unsafe in-memory crypto store or
   * long-lived credentials in localStorage is permitted.
   */
  static async open({
    homeserver, accessToken, userId, deviceId, createClient, storageKey,
    acquireLease = acquireCryptoStoreLease,
    secureContext = globalThis.isSecureContext,
    indexedDB = globalThis.indexedDB,
    subtle = globalThis.crypto?.subtle
  } = {}) {
    const origin = validateHomeserver(homeserver);
    const account = identity(userId, "@", "user identity");
    const id = device(deviceId);
    if (typeof accessToken !== "string" || !accessToken.trim() ||
        accessToken.length > 8192 || /[\r\n]/u.test(accessToken)) {
      throw fail("TOKEN_INVALID", "A valid bounded access token is required");
    }
    if (secureContext !== true || !indexedDB || typeof indexedDB.open !== "function") {
      throw fail("STORE_UNAVAILABLE",
        "Secure DATA needs a secure browser context and persistent IndexedDB");
    }
    // Matrix Rust's persistent IndexedDB is *unencrypted* if both SDK
    // storageKey and storagePassword are omitted. Require an externally
    // provisioned stable 32-byte key; never derive it from access tokens.
    if (!(storageKey instanceof Uint8Array) || storageKey.byteLength !== 32 ||
        storageKey.every(byte => byte === 0)) {
      throw fail("STORE_KEY_REQUIRED",
        "A protected 32-byte device crypto-store key is required");
    }
    if (typeof createClient !== "function" || typeof acquireLease !== "function") {
      throw fail("SDK_MISSING", "An approved Matrix Rust crypto SDK is required");
    }
    // Hash the exact configured identity before opening any persistent store;
    // the server-issued whoami response is checked before initializing crypto.
    const cryptoDatabasePrefix = await scopedCryptoDatabase(origin, account, id, subtle);

    // The Web Locks guard protects the entire Rust WASM/IndexedDB lifetime.
    // It is acquired *before* creating a client so parallel tabs fail closed.
    const lease = await acquireLease();
    if (!lease || typeof lease.release !== "function") {
      throw fail("LEASE_INVALID", "Exclusive crypto-store access was not established");
    }
    // Never hand the caller-owned buffer directly to the SDK. The clone is
    // cleared on close, after the underlying client has stopped, or on error.
    const storeKey = Uint8Array.from(storageKey);
    let client;
    try {
      client = createClient({
        baseUrl: origin, accessToken: accessToken.trim(),
        userId: account, deviceId: id
      });
      if (!client || typeof client.whoami !== "function" ||
          typeof client.initRustCrypto !== "function" ||
          typeof client.getCrypto !== "function" ||
          typeof client.getJoinedRoomMembers !== "function" ||
          typeof client.stopClient !== "function") {
        throw fail("SDK_INCOMPLETE", "Approved Matrix SDK lifecycle methods are missing");
      }

      // Authentication binds both the requested account and crypto device to
      // the returned token identity. A mismatched token must never initialize
      // this device's crypto database.
      const who = await client.whoami();
      if (who?.user_id !== account || who?.device_id !== id) {
        throw fail("IDENTITY_MISMATCH", "Matrix token did not match the account and device");
      }
      await client.initRustCrypto({
        useIndexedDB: true, storageKey: storeKey,
        cryptoDatabasePrefix
      });
      const crypto = client.getCrypto();
      for (const method of [
        "isEncryptionEnabledInRoom", "isCrossSigningReady",
        "isSecretStorageReady", "getActiveSessionBackupVersion",
        "getKeyBackupInfo", "isKeyBackupTrusted",
        "getUserVerificationStatus"
      ]) cryptoMethod(crypto, method);
      // Library-level defense-in-depth: do not send secrets to unverified
      // devices even if future callers bypass the current read-only facade.
      crypto.globalBlacklistUnverifiedDevices = true;
      return new SecureDataBootstrap(
        { homeserver: origin, userId: account, deviceId: id }, client, crypto, lease, storeKey
      );
    } catch (error) {
      try { await client?.stopClient?.(); } catch { /* preserve original failure */ }
      storeKey.fill(0);
      await lease.release();
      if (error instanceof SecureDataGateError) throw error;
      // Do not leak tokens, homeserver errors or crypto-store paths into UI.
      throw fail("INITIALIZATION_FAILED", "Secure DATA crypto initialization failed");
    }
  }

  get closed() { return this.#closed; }
  get identity() { return { ...this.#identity }; }
  get cryptoInitialized() { return !this.#closed && this.#crypto !== null; }

  // Operations may await SDK network/store calls while another event closes
  // the client. Never allow results obtained after close to become trust data.
  async #checked(promise) {
    const result = await promise;
    assertOpen(this);
    return result;
  }

  /**
   * Read-only account recovery assessment. Missing or untrusted backup never
   * becomes "ready to send". Secret storage and cross-signing are separate
   * from actual peer/device verification and key recovery demonstrations.
   */
  async inspectRecovery() {
    assertOpen(this);
    const crypto = this.#crypto;
    try {
      const crossSigning = await this.#checked(crypto.isCrossSigningReady()) === true;
      const secretStorage = await this.#checked(crypto.isSecretStorageReady()) === true;
      const version = await this.#checked(crypto.getActiveSessionBackupVersion());
      const info = typeof version === "string" && version.length > 0
        ? await this.#checked(crypto.getKeyBackupInfo()) : null;
      const trusted = info ? await this.#checked(crypto.isKeyBackupTrusted(info)) : null;
      assertOpen(this);
      return blocked("Device verification, key recovery and encrypted messaging are not yet accepted", {
        cryptoInitialized: true,
        crossSigning, secretStorage,
        backupTrusted: Boolean(trusted?.trusted && trusted?.matchesDecryptionKey),
        recoveryPrerequisitesPresent: Boolean(crossSigning && secretStorage &&
          version && trusted?.trusted && trusted?.matchesDecryptionKey)
      });
    } catch {
      assertOpen(this);
      return blocked("Cannot verify secure DATA recovery prerequisites", {
        cryptoInitialized: true, crossSigning: false,
        secretStorage: false, backupTrusted: false, recoveryPrerequisitesPresent: false
      });
    }
  }

  /**
   * An encrypted-state flag and a verified user identity are observations,
   * not a permission to send. Unknown/changed identities remain blocked.
   */
  async inspectRoom(roomId, ...unexpectedPeerLists) {
    assertOpen(this);
    // A caller must not supply an incomplete peer list and thereby omit
    // unverified recipients. Discover joined members from the SDK instead.
    if (unexpectedPeerLists.length) {
      return blocked("Caller-provided recipient lists are not accepted");
    }
    if (typeof roomId !== "string" || !/^![^:\s]+:[^\s]+$/u.test(roomId) ||
        roomId.length > 255) {
      return blocked("A valid Matrix room identifier is required");
    }
    const crypto = this.#crypto;
    const client = this.#client;
    try {
      const encryptionReported = await this.#checked(crypto.isEncryptionEnabledInRoom(roomId)) === true;
      if (!encryptionReported) {
        return blocked("Room encryption is absent or unknown", { encryptionReported: false });
      }
      const membership = await this.#checked(client.getJoinedRoomMembers(roomId));
      if (!Array.isArray(membership?.joined) || membership.joined.length < 2 ||
          membership.joined.length > 80) {
        return blocked("Room membership is missing, incomplete or too large", { encryptionReported });
      }
      const identities = new Set();
      for (const member of membership.joined) {
        identities.add(identity(member?.user_id, "@", "room member identity"));
      }
      if (!identities.has(this.#identity.userId)) {
        return blocked("Our authenticated account is not listed as joined", { encryptionReported });
      }
      identities.delete(this.#identity.userId);
      if (!identities.size) {
        return blocked("No other Matrix participant was found", { encryptionReported });
      }
      const peers = [];
      for (const userId of identities) {
        const trust = await this.#checked(crypto.getUserVerificationStatus(userId));
        peers.push({
          userId,
          // SDK UserVerificationStatus has needsUserApproval plus methods,
          // not a "known" property. Missing shape must still fail closed.
          verified: trust?.needsUserApproval === false &&
            trust?.isCrossSigningVerified?.() === true
        });
      }
      assertOpen(this);
      const verifiedIdentities = peers.every(x => x.verified);
      return blocked(verifiedIdentities
        ? "Recipient devices and actual encryption/decryption remain unverified"
        : "One or more participant identities are unverified or changed", {
        encryptionReported, verifiedIdentities, peers, roomMemberCount: identities.size + 1
      });
    } catch {
      assertOpen(this);
      return blocked("Unable to verify room encryption and joined participant identities");
    }
  }

  // No send/read/backup reset/auto-cross-signing methods intentionally.
  async close() {
    if (this.#closing) return this.#closing;
    this.#closed = true;
    const client = this.#client;
    const lease = this.#lease;
    const storeKey = this.#storeKey;
    this.#client = null;
    this.#crypto = null;
    this.#lease = null;
    this.#storeKey = null;
    // One shared shutdown promise: concurrent close callers must both wait
    // for stopClient AND lease release before opening another crypto store.
    this.#closing = (async () => {
      try { await client.stopClient(); }
      finally {
        storeKey.fill(0);
        await lease.release();
      }
    })();
    return this.#closing;
  }
}
