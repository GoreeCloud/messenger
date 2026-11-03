/**
 * A cooperative, browser Web Locks guard around Matrix Rust crypto IndexedDB.
 * Not E2EE itself; blocks simultaneous GC Messenger crypto instances per origin.
 * Fails closed when exclusive browser lock support is absent. It cannot protect
 * against uncooperative other-origin apps or a compromised browser environment.
 */
const LOCK_NAME = 'goreecloud-messenger:matrix-rust-crypto-store';

export async function acquireCryptoStoreLease({ locks = globalThis.navigator?.locks } = {}) {
  if (!locks || typeof locks.request !== 'function') {
    throw new Error('Secure DATA requires browser Web Locks; crypto store unavailable');
  }
  let notifyReady, notifyFailed, unblock;
  const ready = new Promise((resolve, reject) => {
    notifyReady = resolve;
    notifyFailed = reject;
  });
  const running = Promise.resolve().then(() => locks.request(
    LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) {
        notifyFailed(new Error('Another Messenger tab holds the crypto store'));
        return;
      }
      const hold = new Promise(resolve => { unblock = resolve; });
      notifyReady();
      await hold;
    }
  )).catch(() => {
    notifyFailed(new Error('Could not acquire exclusive Matrix crypto store access'));
  });
  await ready;
  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      unblock?.();
      await running;
    }
  };
}
