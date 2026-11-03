/** Ephemeral tab-only composer drafts. No storage API and no synchronization. */
export class SessionDrafts {
  #values = new Map();
  #closed = false;
  get(key) {
    if (this.#closed) return '';
    return this.#values.get(key) ?? '';
  }
  set(key, value) {
    if (this.#closed) throw new Error('Draft store closed');
    if (typeof key !== 'string' || !key || key.length > 255) {
      throw new TypeError('Invalid conversation identifier');
    }
    if (typeof value !== 'string' || value.length > 16000) {
      throw new TypeError('Draft must be a string up to 16,000 characters');
    }
    if (!value) this.#values.delete(key);
    else if (this.#values.has(key) || this.#values.size < 100) this.#values.set(key, value);
    else throw new Error('Too many drafts in this tab');
  }
  clearOtherAccounts() {
    const note = this.get('notes');
    this.#values.clear();
    if (note) this.#values.set('notes', note);
  }
  close() {
    this.#values.clear();
    this.#closed = true;
  }
}
