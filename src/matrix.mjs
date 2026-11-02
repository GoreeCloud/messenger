/**
 * Minimal Matrix Client-Server transport adapter for explicit plaintext DATA sessions.
 * NOT a cryptographic client. Encrypted rooms fail closed until vetted crypto support
 * and verified device/key handling are integrated.
 */
export class MatrixError extends Error {
  constructor(message, status = 0) { super(message); this.name = "MatrixError"; this.status = status; }
}

export function validateHomeserver(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new MatrixError("Use a homeserver origin without credentials or query parameters");
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new MatrixError("HTTPS is required for remote homeservers");
  }
  if (url.pathname !== "/" && url.pathname !== "") throw new MatrixError("Use the homeserver origin, without a path");
  return url.origin;
}

export class MatrixPlaintextSession {
  #base;
  #token;
  #request;
  constructor({ homeserver, accessToken, fetchImpl = fetch }) {
    this.#base = validateHomeserver(homeserver);
    if (typeof accessToken !== "string" || !accessToken.trim()) throw new MatrixError("An access token is required");
    this.#token = accessToken.trim();
    this.#request = fetchImpl;
  }

  async #call(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const url = new URL("/_matrix/client/v3/" + path, this.#base);
      const response = await this.#request(url.href, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: { Authorization: "Bearer " + this.#token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      if (!response.ok) {
        // Never reveal response bodies or access tokens through UI errors/logs.
        throw new MatrixError("Matrix request failed (" + response.status + ")", response.status);
      }
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") throw new MatrixError("Matrix request timed out");
      if (error instanceof MatrixError) throw error;
      throw new MatrixError("Could not contact the homeserver over a trusted connection");
    } finally {
      clearTimeout(timer);
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
    // Limit to a bounded, explicit list; never fetch whole contact history.
    return result.joined_rooms.filter(r => typeof r === "string").slice(0, 40);
  }

  async inspectRoom(roomId) {
    const id = encodeURIComponent(roomId);
    let encrypted = "unknown";
    try {
      const event = await this.#call("rooms/" + id + "/state/m.room.encryption");
      encrypted = event?.algorithm ? "encrypted" : "unknown";
    } catch (error) {
      if (error instanceof MatrixError && error.status === 404) encrypted = "plaintext";
      else throw error; // never interpret denied or broken requests as plaintext
    }
    let name = roomId;
    try {
      const event = await this.#call("rooms/" + id + "/state/m.room.name");
      if (typeof event?.name === "string" && event.name.trim()) name = event.name.trim().slice(0, 100);
    } catch (error) {
      if (!(error instanceof MatrixError && error.status === 404)) {
        // Room names are optional, but real errors should remain visible.
        throw error;
      }
    }
    return { id: roomId, name, encrypted };
  }

  async readMessages(room) {
    if (room.encrypted !== "plaintext") throw new MatrixError("Encrypted or unknown-security rooms cannot be read by this adapter");
    const id = encodeURIComponent(room.id);
    const result = await this.#call("rooms/" + id + "/messages?dir=b&limit=40");
    if (!Array.isArray(result.chunk)) throw new MatrixError("Invalid homeserver timeline");
    return result.chunk.filter(e => e.type === "m.room.message" &&
        e.content?.msgtype === "m.text" && typeof e.content.body === "string")
      .slice(0, 40).reverse().map(e => ({
        id: String(e.event_id || ""), sender: String(e.sender || "Unknown"),
        text: e.content.body.slice(0, 16000), protocol: "DATA", encrypted: false,
        timestamp: Number.isFinite(e.origin_server_ts) ? e.origin_server_ts : Date.now(),
        own: false
      }));
  }

  async sendPlaintext(room, text, txnId, { allowPlaintext = false } = {}) {
    if (room.encrypted !== "plaintext") throw new MatrixError("The room is encrypted or its security state is unknown. Nothing was sent.");
    if (!allowPlaintext) throw new MatrixError("Explicit session consent is required before sending unencrypted DATA");
    if (typeof text !== "string" || !text.trim() || text.length > 16000) throw new MatrixError("Message must contain 1–16,000 characters");
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(txnId)) throw new MatrixError("Invalid idempotency transaction ID");
    // Reuse the same txnId for manual retries. Matrix uses this for idempotency.
    return this.#call("rooms/" + encodeURIComponent(room.id) +
      "/send/m.room.message/" + encodeURIComponent(txnId),
      { method: "PUT", body: { msgtype: "m.text", body: text } });
  }

  close() { this.#token = ""; }
}
