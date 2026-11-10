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

// Apply the same bounded room-identifier grammar to discovery, state reads,
// timelines and sends. Untrusted server room IDs are not API path templates.
const validRoomId = value => typeof value === "string" && value.length <= 255 &&
  /^![^:\s]+:[^\s]+$/u.test(value);

const validUserId = value => typeof value === "string" && value.length <= 255 &&
  /^@[^:\s]+:[^\s]+$/u.test(value) &&
  !/[\u0000-\u001f\u007f]/u.test(value);

// Admission is local to one session. Rejected requests never acquire a network slot.
const MAX_CONCURRENT_MATRIX_REQUESTS = 8;
// The development preview requests at most 40 text messages per page. Bound
// decoded, streamed response bytes before UTF-8 decoding or JSON.parse, not
// merely a server-declared Content-Length (which may be absent or dishonest).
const MAX_MATRIX_JSON_BYTES = 1024 * 1024;
const MAX_MATRIX_JSON_CHUNKS = 4096; // refuse pathological tiny-fragment streams

async function readBoundedMatrixJson(response) {
  const declared = response?.headers?.get?.("content-length");
  if (typeof declared === "string" && /^[0-9]+$/.test(declared) &&
      Number(declared) > MAX_MATRIX_JSON_BYTES) {
    throw new MatrixError("Homeserver response exceeds the safe size limit");
  }
  if (!response?.body || typeof response.body.getReader !== "function") {
    throw new MatrixError("Homeserver response is missing a readable JSON body");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new MatrixError("Homeserver returned an invalid response stream");
      }
      if (chunks.length >= MAX_MATRIX_JSON_CHUNKS) {
        throw new MatrixError("Homeserver response exceeds the safe chunk limit");
      }
      bytes += value.byteLength;
      if (bytes > MAX_MATRIX_JSON_BYTES) {
        throw new MatrixError("Homeserver response exceeds the safe size limit");
      }
      chunks.push(value);
    }
  } catch (error) {
    // Cancel without awaiting an uncooperative stream; the parent AbortSignal
    // remains subject to the existing 12-second request deadline.
    try { void Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
    throw error;
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new MatrixError("Homeserver returned malformed UTF-8 JSON");
  }
  // Matrix client endpoints handled by this preview require JSON objects.
  // A valid primitive or array must not escape as a raw TypeError in callers.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MatrixError("Homeserver returned an invalid JSON object");
  }
  return parsed;
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
    if (this.#controllers.size >= MAX_CONCURRENT_MATRIX_REQUESTS) {
      throw new MatrixError("Too many concurrent Matrix requests. Retry shortly.");
    }
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
      const result = await readBoundedMatrixJson(response);
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
    if (!validUserId(result.user_id)) {
      throw new MatrixError("The server did not return a valid Matrix account identity");
    }
    return result.user_id;
  }
  async listRooms() {
    const result = await this.#call("joined_rooms");
    if (!Array.isArray(result.joined_rooms)) throw new MatrixError("Invalid homeserver room list");
    return [...new Set(result.joined_rooms.filter(validRoomId))].slice(0, 40);
  }

  async #encryptionState(roomId) {
    if (!validRoomId(roomId)) throw new MatrixError("Invalid room ID");
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

  #plaintextRoomId(room) {
    if (!room || room.encrypted !== "plaintext" ||
        !validRoomId(room.id)) {
      throw new MatrixError("Room security or identity is invalid. Nothing was sent.");
    }
    return room.id;
  }

  async #requireFreshPlaintext(room, expectedRoomId) {
    if (!room || room.id !== expectedRoomId) {
      throw new MatrixError("Room identity changed during security check. Nothing was sent.");
    }
    if (room.encrypted !== "plaintext") {
      throw new MatrixError("Room encryption changed or cannot be verified. Nothing was sent.");
    }
    // Check one immutable destination across every awaited request. A mutable
    // UI room object must not redirect a send or mix unrelated timelines.
    const current = await this.#encryptionState(expectedRoomId);
    if (!room || room.id !== expectedRoomId) {
      throw new MatrixError("Room identity changed during security check. Nothing was sent.");
    }
    if (room.encrypted !== "plaintext" || current !== "plaintext") {
      throw new MatrixError("Room encryption changed or cannot be verified. Nothing was sent.");
    }
  }

  async readMessages(room, ownUserId = "") {
    const roomId = this.#plaintextRoomId(room);
    await this.#requireFreshPlaintext(room, roomId);
    const result = await this.#call("rooms/" + encodeURIComponent(roomId) + "/messages?dir=b&limit=40");
    // The room may have become encrypted or switched while its timeline was
    // in flight. Never expose that response without rechecking the same room.
    // This remains a non-atomic development-only safeguard, not E2EE.
    await this.#requireFreshPlaintext(room, roomId);
    if (!Array.isArray(result.chunk)) throw new MatrixError("Invalid homeserver timeline");
    return result.chunk.filter(e => e !== null && typeof e === "object" &&
        e.type === "m.room.message" &&
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
    const roomId = this.#plaintextRoomId(room);
    await this.#requireFreshPlaintext(room, roomId);
    // Send only to the checked room. A server-side encryption-state change
    // after this request remains non-atomic: use E2EE for confidential DATA.
    return this.#call("rooms/" + encodeURIComponent(roomId) +
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
