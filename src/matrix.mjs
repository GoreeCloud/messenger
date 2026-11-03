/**
 * Limited, explicitly plaintext Matrix client-server adapter for development use.
 * NO E2EE, device verification, key storage or secret recovery.
 * Room state is rechecked immediately before send/read. The Matrix REST API
 * does not guarantee atomicity between this check and a subsequent send;
 * therefore this adapter is NOT suitable for confidential communications.
 */
export class MatrixError extends Error {
  constructor(message, status = 0) {
    super(message); this.name = "MatrixError"; this.status = status;
  }
}
export function validateHomeserver(value) {
  let url;
  try { url = new URL(value); } catch { throw new MatrixError("Invalid homeserver origin"); }
  if (url.username || url.password || url.search || url.hash) {
    throw new MatrixError("Use a homeserver origin without credentials or query parameters");
  }
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new MatrixError("HTTPS is required for remote homeservers");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new MatrixError("Use the homeserver origin, without a path");
  }
  return url.origin;
}

export class MatrixPlaintextSession {
  #base;
  #token;
  #request;
  #closed = false;
  #controllers = new Set();
  constructor({ homeserver, accessToken, fetchImpl = fetch }) {
    this.#base = validateHomeserver(homeserver);
    if (typeof accessToken !== "string" || !accessToken.trim() ||
        accessToken.length > 8192 || /[\r\n\u0000-\u001f\u007f]/u.test(accessToken)) {
      throw new MatrixError("A valid bounded access token is required");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
    this.#token = accessToken.trim();
    // Browser Window.fetch is an IDL method that requires a Window receiver.
    // Calling it as `this.#request(...)` otherwise passes MatrixPlaintextSession
    // as `this` and may throw "Illegal invocation". Keep injected mocks working.
    this.#request = fetchImpl.bind(globalThis);
  }

  async #call(path, { method = "GET", body } = {}) {
    if (this.#closed) throw new MatrixError("Session closed");
    const controller = new AbortController();
    this.#controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const url = new URL("/_matrix/client/v3/" + path, this.#base);
      const response = await this.#request(url.href, {
        method,
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        headers: {
          Authorization: "Bearer " + this.#token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      if (this.#closed) throw new MatrixError("Session closed");
      if (!response.ok) throw new MatrixError("Matrix request failed (" + response.status + ")", response.status);
      const result = await response.json();
      if (this.#closed) throw new MatrixError("Session closed");
      return result;
    } catch (error) {
      if (this.#closed) throw new MatrixError("Session closed");
      if (error?.name === "AbortError") throw new MatrixError("Matrix request timed out");
      if (error instanceof MatrixError) throw error;
      throw new MatrixError("Could not contact the homeserver over a trusted connection");
    } finally {
      clearTimeout(timer);
      this.#controllers.delete(controller);
    }
  }

  async whoami() {
    const result = await this.#call("account/whoami");
    if (typeof result.user_id !== "string" || !result.user_id.startsWith("@")) {
      throw new MatrixError("The server did not return a valid Matrix account identity");
    }
    return result.user_id;
  }
  async listRooms() {
    const result = await this.#call("joined_rooms");
    if (!Array.isArray(result.joined_rooms)) throw new MatrixError("Invalid homeserver room list");
    return [...new Set(result.joined_rooms.filter(r => typeof r === "string" && r.startsWith("!")))].slice(0, 40);
  }

  async #encryptionState(roomId) {
    if (typeof roomId !== "string" || !roomId.startsWith("!")) throw new MatrixError("Invalid room ID");
    try {
      const event = await this.#call("rooms/" + encodeURIComponent(roomId) + "/state/m.room.encryption");
      return typeof event?.algorithm === "string" && event.algorithm.length > 0
        ? "encrypted" : "unknown";
    } catch (error) {
      // A 404 state event indicates no encryption state present at inspection time.
      if (error instanceof MatrixError && error.status === 404) return "plaintext";
      throw error; // Auth failure, revoked access, bad server, timeout: never assume plaintext.
    }
  }

  async inspectRoom(roomId) {
    const encrypted = await this.#encryptionState(roomId);
    let name = roomId;
    try {
      const event = await this.#call("rooms/" + encodeURIComponent(roomId) + "/state/m.room.name");
      if (typeof event?.name === "string" && event.name.trim()) name = event.name.trim().slice(0, 100);
    } catch (error) {
      if (!(error instanceof MatrixError && error.status === 404)) throw error;
    }
    return { id: roomId, name, encrypted };
  }

  async #requireFreshPlaintext(room) {
    if (!room || room.encrypted !== "plaintext") {
      throw new MatrixError("Room security is encrypted or unknown. Nothing was sent.");
    }
    // Never use the cached room security state as authority on read or send.
    const current = await this.#encryptionState(room.id);
    if (current !== "plaintext") {
      throw new MatrixError("Room encryption changed or cannot be verified. Nothing was sent.");
    }
  }

  async readMessages(room, ownUserId = "") {
    await this.#requireFreshPlaintext(room);
    const result = await this.#call("rooms/" + encodeURIComponent(room.id) + "/messages?dir=b&limit=40");
    // The room may have become encrypted while the timeline request was in
    // flight. Never expose a stale plaintext response without checking again.
    // This remains a non-atomic development-only safeguard, not E2EE.
    await this.#requireFreshPlaintext(room);
    if (!Array.isArray(result.chunk)) throw new MatrixError("Invalid homeserver timeline");
    return result.chunk.filter(e => e.type === "m.room.message" &&
        e.content?.msgtype === "m.text" && typeof e.content.body === "string")
      .slice(0, 40).reverse().map(e => ({
        id: String(e.event_id || ""), sender: String(e.sender || "Unknown"),
        text: e.content.body.slice(0, 16000), protocol: "DATA", encrypted: false,
        timestamp: Number.isFinite(e.origin_server_ts) ? e.origin_server_ts : Date.now(),
        own: e.sender === ownUserId && ownUserId.length > 0
      }));
  }

  async sendPlaintext(room, message, txnId, { allowPlaintext = false } = {}) {
    if (!allowPlaintext) throw new MatrixError("Explicit session consent is required before sending unencrypted DATA");
    if (typeof message !== "string" || !message.trim() || message.length > 16000) {
      throw new MatrixError("Message must contain 1–16,000 characters");
    }
    if (typeof txnId !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(txnId)) {
      throw new MatrixError("Invalid idempotency transaction ID");
    }
    await this.#requireFreshPlaintext(room);
    // Reuse this txnId when retrying. A state change after the check remains
    // a TOCTOU risk: use the Rust E2EE SDK for confidential communications.
    return this.#call("rooms/" + encodeURIComponent(room.id) +
      "/send/m.room.message/" + encodeURIComponent(txnId), {
        method: "PUT", body: { msgtype: "m.text", body: message }
      });
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#token = "";
    for (const controller of this.#controllers) controller.abort();
    this.#controllers.clear();
  }
}
