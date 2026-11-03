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

test('concurrent release calls remain pending until Web Locks provider confirms unlock', async () => {
  let finishProvider;
  let providerReached = false;
  const locks = {
    async request(name, options, callback) {
      assert.equal(options.mode, 'exclusive');
      await callback({ name });
      providerReached = true;
      await new Promise(resolve => { finishProvider = resolve; });
    }
  };
  const lease = await acquireCryptoStoreLease({ locks });
  const first = lease.release();
  const second = lease.release();
  assert.equal(first, second, 'Both callers must share the same release completion promise');

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(providerReached, true);
  assert.equal(typeof finishProvider, 'function');

  let early = false;
  second.then(() => { early = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(early, false, 'Unlock must not appear finished while provider is pending');

  finishProvider();
  await Promise.all([first, second]);
  assert.equal(early, true);
  await lease.release();
});
