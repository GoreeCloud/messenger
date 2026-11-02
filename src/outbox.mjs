/**
 * Per-session volatile DATA outbox.
 *
 * One stable transaction id per logical message. Concurrent requests with the
 * same id coalesce; retries reuse the id. Records are never written to disk.
 * This reduces duplicate sends but cannot guarantee exactly-once delivery
 * across crashes, devices, expired homeserver idempotency windows or outages.
 */
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
    if (!room || typeof room.id !== "string" || room.encrypted !== "plaintext") {
      throw new OutboxError("The selected room is not approved for plaintext");
    }
    if (!allowPlaintext) throw new OutboxError("Session consent is required");
    if (typeof text !== "string" || !text.trim() || text.length > 16000) {
      throw new OutboxError("Invalid message text");
    }
    if (typeof txnId !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(txnId)) {
      throw new OutboxError("Invalid transaction ID");
    }

    const key = JSON.stringify([room.id, txnId]);
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
      record.status = "sending";
      return this.#transport.sendPlaintext(room, text, txnId, { allowPlaintext: true });
    }).then(receipt => {
      if (this.#closed) throw new OutboxError("Outbox session is closed");
      record.status = "sent";
      record.receipt = receipt;
      return receipt;
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
