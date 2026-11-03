/**
 * Monotonic session generation tickets. Used to reject stale asynchronous
 * connection, room-load and account-switch results. No global state/storage.
 */
export class SessionEpoch {
  #value = 0;
  next() { return ++this.#value; }
  isCurrent(ticket) { return Number.isSafeInteger(ticket) && ticket === this.#value && ticket > 0; }
}
