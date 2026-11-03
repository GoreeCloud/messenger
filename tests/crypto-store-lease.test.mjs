import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireCryptoStoreLease } from '../src/crypto-store-lease.mjs';
function mockLocks() {
  let locked = false;
  return {
    async request(name, options, callback) {
      assert.equal(name, 'goreecloud-messenger:matrix-rust-crypto-store');
      assert.equal(options.mode, 'exclusive');
      assert.equal(options.ifAvailable, true);
      if (locked) return callback(null);
      locked = true;
      try { return await callback({ name }); }
      finally { locked = false; }
    }
  };
}
test('rejects absent Web Locks API, rather than using an unsafe fallback', async () => {
  await assert.rejects(acquireCryptoStoreLease({ locks: null }), /requires browser Web Locks/);
});
test('allows one active crypto-store owner and releases cleanly', async () => {
  const locks = mockLocks();
  const a = await acquireCryptoStoreLease({ locks });
  await assert.rejects(acquireCryptoStoreLease({ locks }), /Another Messenger tab/);
  await a.release();
  await a.release();
  const b = await acquireCryptoStoreLease({ locks });
  await b.release();
});
test('a lock manager failure is surfaced without leaking implementation internals', async () => {
  await assert.rejects(acquireCryptoStoreLease({ locks: { request() { throw new Error('secret'); } } }),
    error => error.message.includes('Could not acquire') && !error.message.includes('secret'));
});
