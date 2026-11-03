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
function blocked(reason, extra = {}) {
  return { status: "blocked", canSend: false, reason, ...extra };
}

export class SecureDataBootstrap {
  #client;
  #crypto;
  #lease;
  #closed = false;
  #identity;

  constructor(key, client, crypto, lease) {
    this.#identity = key;
    this.#client = client;
    this.#crypto = crypto;
    this.#lease = lease;
  }

  /**
   * The application must provide the exact vetted SDK createClient factory.
   * No fallback crypto implementation, unsafe in-memory crypto store or
   * long-lived credentials in localStorage is permitted.
   */
  static async open({
    homeserver, accessToken, userId, deviceId, createClient,
    acquireLease = acquireCryptoStoreLease,
    secureContext = globalThis.isSecureContext,
    indexedDB = globalThis.indexedDB
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
    if (typeof createClient !== "function" || typeof acquireLease !== "function") {
      throw fail("SDK_MISSING", "An approved Matrix Rust crypto SDK is required");
    }

    // The Web Locks guard protects the entire Rust WASM/IndexedDB lifetime.
    // It is acquired *before* creating a client so parallel tabs fail closed.
    const lease = await acquireLease();
    if (!lease || typeof lease.release !== "function") {
      throw fail("LEASE_INVALID", "Exclusive crypto-store access was not established");
    }
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
      await client.initRustCrypto({ useIndexedDB: true });
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
        { homeserver: origin, userId: account, deviceId: id }, client, crypto, lease
      );
    } catch (error) {
      try { await client?.stopClient?.(); } catch { /* preserve original failure */ }
      await lease.release();
      if (error instanceof SecureDataGateError) throw error;
      // Do not leak tokens, homeserver errors or crypto-store paths into UI.
      throw fail("INITIALIZATION_FAILED", "Secure DATA crypto initialization failed");
    }
  }

  get closed() { return this.#closed; }
  get identity() { return { ...this.#identity }; }
  get cryptoInitialized() { return !this.#closed; }

  /**
   * Read-only account recovery assessment. Missing or untrusted backup never
   * becomes "ready to send". Secret storage and cross-signing are separate
   * from actual peer/device verification and key recovery demonstrations.
   */
  async inspectRecovery() {
    assertOpen(this);
    try {
      const crossSigning = await this.#crypto.isCrossSigningReady() === true;
      const secretStorage = await this.#crypto.isSecretStorageReady() === true;
      const version = await this.#crypto.getActiveSessionBackupVersion();
      const info = typeof version === "string" && version.length > 0
        ? await this.#crypto.getKeyBackupInfo() : null;
      const trusted = info ? await this.#crypto.isKeyBackupTrusted(info) : null;
      return blocked("Device verification, key recovery and encrypted messaging are not yet accepted", {
        cryptoInitialized: true,
        crossSigning, secretStorage,
        backupTrusted: Boolean(trusted?.trusted && trusted?.matchesDecryptionKey),
        recoveryPrerequisitesPresent: Boolean(crossSigning && secretStorage &&
          version && trusted?.trusted && trusted?.matchesDecryptionKey)
      });
    } catch {
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
    if (typeof roomId !== "string" || !/^![^:\\s]+:[^\\s]+$/u.test(roomId) ||
        roomId.length > 255) {
      return blocked("A valid Matrix room identifier is required");
    }
    try {
      const encryptionReported = await this.#crypto.isEncryptionEnabledInRoom(roomId) === true;
      if (!encryptionReported) {
        return blocked("Room encryption is absent or unknown", { encryptionReported: false });
      }
      const membership = await this.#client.getJoinedRoomMembers(roomId);
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
        const trust = await this.#crypto.getUserVerificationStatus(userId);
        peers.push({
          userId,
          verified: trust?.needsUserApproval !== true &&
            trust?.known === true && trust?.isCrossSigningVerified?.() === true
        });
      }
      const verifiedIdentities = peers.every(x => x.verified);
      return blocked(verifiedIdentities
        ? "Recipient devices and actual encryption/decryption remain unverified"
        : "One or more participant identities are unverified or changed", {
        encryptionReported, verifiedIdentities, peers, roomMemberCount: identities.size + 1
      });
    } catch {
      return blocked("Unable to verify room encryption and joined participant identities");
    }
  }

  // No send/read/backup reset/auto-cross-signing methods intentionally.
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    const client = this.#client;
    const lease = this.#lease;
    this.#client = null;
    this.#crypto = null;
    this.#lease = null;
    try { await client.stopClient(); }
    finally { await lease.release(); }
  }
}
