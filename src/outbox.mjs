/**
 * Per-session volatile DATA outbox.
 *
 * One stable transaction id per logical message. Concurrent requests with the
 * same id coalesce; retries reuse the id. Records are never written to disk.
 * This reduces duplicate sends but cannot guarantee exactly-once delivery
 * across crashes, devices, expired homeserver idempotency windows or outages.
 */
// Room/event IDs are opaque but must stay bounded and free of control text.
// Legacy Matrix event IDs may contain a server suffix; modern IDs are opaque.
const ROOM_ID = /^![^:\s\u0000-\u001f\u007f]+:[^\s\u0000-\u001f\u007f]+$/u;
const EVENT_ID = /^\$[\x21-\x7e]{1,511}$/u;

export class OutboxError extends Error {
  constructor(message) { super(message); this.name = "OutboxError"; }
}

export class InMemoryOutbox {
  #transport;
  #entries = new Map();
  #closed = false;
  static MAX_RECORDS = 1000;

  constructor({ transport } = {}) {
    if (!transport || typeof transport.sendPlaintext !== "function") {
      throw new TypeError("A session transport with sendPlaintext() is required");
    }
    this.#transport = transport;
  }

  dispatch({ room, text, txnId, allowPlaintext = false } = {}) {
    if (this.#closed) throw new OutboxError("Outbox session is closed");
    const roomId = room?.id;
    if (typeof roomId !== "string" || roomId.length > 255 ||
        !ROOM_ID.test(roomId) || room.encrypted !== "plaintext") {
      throw new OutboxError("The selected room is not approved for plaintext");
    }
    if (!allowPlaintext) throw new OutboxError("Session consent is required");
    if (typeof text !== "string" || !text.trim() || text.length > 16000) {
      throw new OutboxError("Invalid message text");
    }
    if (typeof txnId !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(txnId)) {
      throw new OutboxError("Invalid transaction ID");
    }

    const key = JSON.stringify([roomId, txnId]);
    let record = this.#entries.get(key);
    if (record && record.text !== text) {
      throw new OutboxError("Transaction ID reuse with changed content was blocked");
    }
    if (record?.status === "sent") return Promise.resolve(record.receipt);
    if (record?.promise) return record.promise;
    if (!record && this.#entries.size >= InMemoryOutbox.MAX_RECORDS) {
      throw new OutboxError("Outbox session is full. Disconnect and reconnect before sending more.");
    }
    if (!record) {
      record = { text, status: "queued", promise: null, receipt: null };
      this.#entries.set(key, record);
    }

    const request = Promise.resolve().then(() => {
      if (this.#closed) throw new OutboxError("Outbox session is closed");
      if (room.id !== roomId || room.encrypted !== "plaintext") {
        throw new OutboxError("Room changed before the plaintext transport could send");
      }
      record.status = "sending";
      // Pass an immutable destination, not the caller's mutable UI room.
      // MatrixPlaintextSession separately checks the server's room state.
      return this.#transport.sendPlaintext(
        Object.freeze({ id: roomId, encrypted: "plaintext" }),
        text, txnId, { allowPlaintext: true }
      );
    }).then(receipt => {
      if (this.#closed) throw new OutboxError("Outbox session is closed");
      // Unconfirmed/invalid acknowledgments remain retriable with the SAME id.
      // The provider may have accepted the send; never invent a new transaction.
      const eventId = receipt?.event_id;
      if (typeof eventId !== "string" || eventId.length > 512 ||
          !EVENT_ID.test(eventId)) {
        throw new OutboxError("Homeserver did not acknowledge a valid event ID");
      }
      record.status = "sent";
      // Keep only the bounded identity required for later reconciliation;
      // discard arbitrary extra provider fields and mutable receipt objects.
      record.receipt = Object.freeze({ event_id: eventId });
      return record.receipt;
    }).catch(error => {
      record.status = "failed";
      throw error;
    }).finally(() => { record.promise = null; });
    record.promise = request;
    return request;
  }

  getStatus(roomId, txnId) {
    return this.#entries.get(JSON.stringify([roomId, txnId]))?.status ?? "unknown";
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#entries.clear();
  }
}
