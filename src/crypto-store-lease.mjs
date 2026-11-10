/**
 * A cooperative, browser Web Locks guard around Matrix Rust crypto IndexedDB.
 * Not E2EE itself; blocks simultaneous GC Messenger crypto instances per origin.
 * Fails closed when exclusive browser lock support is absent. It cannot protect
 * against uncooperative other-origin apps or a compromised browser environment.
 */
const LOCK_NAME = 'goreecloud-messenger:matrix-rust-crypto-store';

export async function acquireCryptoStoreLease({
  locks = globalThis.navigator?.locks, timeoutMs = 5000
} = {}) {
  if (!locks || typeof locks.request !== 'function') {
    throw new Error('Secure DATA requires browser Web Locks; crypto store unavailable');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 20 || timeoutMs > 30000) {
    throw new TypeError('Invalid crypto-store lock acquisition deadline');
  }
  let notifyReady, notifyFailed, unblock;
  let abandoned = false;
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
      // A faulty provider may grant after acquisition has timed out.
      // Never hold such a late lock or return an unusable lease.
      if (abandoned) return;
      const hold = new Promise(resolve => { unblock = resolve; });
      notifyReady();
      await hold;
    }
  ));
  // A provider that exits successfully *without ever invoking the callback*
  // must not leave the client awaiting admission indefinitely.
  running.then(
    () => notifyFailed(new Error('Web Locks provider returned without granting access')),
    () => notifyFailed(new Error('Could not acquire exclusive Matrix crypto store access'))
  );
  const timer = setTimeout(() => {
    abandoned = true;
    notifyFailed(new Error('Timed out acquiring exclusive Matrix crypto store access'));
  }, timeoutMs);
  try {
    await ready;
  } catch (error) {
    abandoned = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
  let releasePromise = null;
  return {
    // Every concurrent caller must await the *same* provider completion.
    // Merely requesting unlock does not mean the browser has released it.
    release() {
      if (!releasePromise) {
        unblock?.();
        releasePromise = running;
      }
      return releasePromise;
    }
  };
}
