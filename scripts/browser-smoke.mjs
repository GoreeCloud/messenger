/**
 * No-dependency Chromium smoke test for the ACTUAL browser UI.
 * Tests DOM/keyboard interactions and captures a synthetic-content screenshot.
 * No homeserver, SIM, account tokens or external services are contacted.
 * Node 22+ (built-in WebSocket) and local Chrome/Chromium required.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, extname, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(ROOT, 'artifacts', 'browser');
const profile = mkdtempSync(join(tmpdir(), 'goreecloud-browser-'));
const chrome = process.env.CHROME_BIN || (existsSync('/usr/bin/google-chrome')
  ? '/usr/bin/google-chrome' : existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : 'chromium');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

/**
 * Hermetic Matrix Client-Server fixture: synthetic identities only.
 * Accessible only through the ephemeral loopback HTTP server below.
 * It is NOT a Matrix homeserver implementation or a production backend.
 */
const fixture = {
  expectedToken: 'synthetic-test-token', credentialInUrl: false,
  rooms: ['!plain:localhost', '!sealed:localhost'],
  plainEncrypted: false, forbidPlainState: false, failNextPut: false, slowWhoami: false,
  putAttempts: [], seen: [], events: [{
    type: 'm.room.message', event_id: '$inbound', sender: '@peer:localhost',
    content: { msgtype: 'm.text', body: 'Synthetic inbound <img src=x onerror=alert(1)>' },
    origin_server_ts: 1000
  }]
};
function matrixResponse(res, status, body = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function matrixFixtureRequest(req, res, path) {
  fixture.seen.push({ method: req.method, path, authorized:
    req.headers.authorization === 'Bearer ' + fixture.expectedToken });
  if (req.url.includes(fixture.expectedToken)) fixture.credentialInUrl = true;
  if (req.headers.authorization !== 'Bearer ' + fixture.expectedToken) {
    return matrixResponse(res, 401, { errcode: 'M_UNKNOWN_TOKEN' });
  }
  if (path === 'account/whoami' && req.method === 'GET') {
    if (fixture.slowWhoami) await sleep(350);
    return matrixResponse(res, 200, { user_id: '@preview:localhost' });
  }
  if (path === 'joined_rooms' && req.method === 'GET') {
    return matrixResponse(res, 200, { joined_rooms: fixture.rooms });
  }
  const plain = path.startsWith('rooms/!plain:localhost/');
  const sealed = path.startsWith('rooms/!sealed:localhost/');
  if ((plain || sealed) && path.endsWith('/state/m.room.encryption') && req.method === 'GET') {
    if (plain && fixture.forbidPlainState) return matrixResponse(res, 403, { errcode: 'M_FORBIDDEN' });
    if (sealed || fixture.plainEncrypted) {
      return matrixResponse(res, 200, { algorithm: 'm.megolm.v1.aes-sha2' });
    }
    return matrixResponse(res, 404, { errcode: 'M_NOT_FOUND' });
  }
  if ((plain || sealed) && path.endsWith('/state/m.room.name') && req.method === 'GET') {
    return matrixResponse(res, 200, {
      name: plain ? 'Unencrypted test room' : 'Encrypted test room'
    });
  }
  if (plain && path.startsWith('rooms/!plain:localhost/messages') && req.method === 'GET') {
    return matrixResponse(res, 200, { chunk: [...fixture.events] });
  }
  if (plain && path.includes('/send/m.room.message/') && req.method === 'PUT') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString('utf8');
      if (raw.length > 20000) return matrixResponse(res, 413);
    }
    let body;
    try { body = JSON.parse(raw); }
    catch { return matrixResponse(res, 400); }
    const txn = path.split('/').at(-1);
    fixture.putAttempts.push({ txn, text: body.body });
    if (fixture.failNextPut) {
      fixture.failNextPut = false;
      return matrixResponse(res, 503, { errcode: 'M_UNAVAILABLE' });
    }
    if (fixture.plainEncrypted) {
      return matrixResponse(res, 403, { errcode: 'M_FORBIDDEN' });
    }
    const eventId = '$accepted-' + txn;
    if (!fixture.events.some(e => e.event_id === eventId)) {
      fixture.events.unshift({
        type: 'm.room.message', event_id: eventId,
        sender: '@preview:localhost', content: { msgtype: 'm.text', body: body.body },
        origin_server_ts: Date.now()
      });
    }
    return matrixResponse(res, 200, { event_id: eventId });
  }
  return matrixResponse(res, 404, { errcode: 'M_NOT_FOUND' });
}

const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.startsWith('/_matrix/client/v3/')) {
      await matrixFixtureRequest(req, res, name.slice('/_matrix/client/v3/'.length));
      return;
    }
    const path = resolve(ROOT, '.' + (name.endsWith('/') ? name + 'index.html' : name));
    if (!path.startsWith(ROOT + sep) || !Object.hasOwn(mime, extname(path))) {
      res.writeHead(403); res.end(); return;
    }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch (error) { console.error('Static test server:', req.url, error.message); res.writeHead(404); res.end(); }
});
let browser, socket;
const pending = new Map();
let nextId = 1;
function call(method, params = {}) {
  return new Promise((accept, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id); reject(new Error('CDP command timed out: ' + method));
    }, 10000);
    pending.set(id, { accept, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const reply = await call('Runtime.evaluate', { expression, returnByValue: true,
    awaitPromise: true });
  if (reply.exceptionDetails) {
    throw new Error('Browser JS exception: ' +
      (reply.exceptionDetails.text || JSON.stringify(reply.exceptionDetails)));
  }
  return reply.result.value;
}
async function until(expression, expected = true) {
  for (let n = 0; n < 90; n++) {
    try { if ((await evaluate(expression)) === expected) return; }
    catch { /* document may be navigating */ }
    await sleep(100);
  }
  const diagnostics = await evaluate(`({ url: location.href,
    ready: document.readyState, title: document.title,
    buttons: document.querySelectorAll('#conversationList button').length,
    body: document.body?.innerText?.slice(0, 250),
    connection: document.getElementById('connectionStatus')?.textContent,
    toast: document.getElementById('toast')?.textContent })`).catch(error => ({ error: error.message }));
  throw new Error('Browser condition not met: ' + expression +
    '; diagnostics=' + JSON.stringify(diagnostics));
}
async function capture(name) {
  mkdirSync(artifacts, { recursive: true });
  const result = await call('Page.captureScreenshot', { format: 'png',
    captureBeyondViewport: false });
  writeFileSync(join(artifacts, name + '.png'), Buffer.from(result.data, 'base64'));
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-allow-origins=*',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

  let cdpPort = 0;
  for (let n = 0; n < 100; n++) {
    try { cdpPort = Number(readFileSync(join(profile, 'DevToolsActivePort'),
      'utf8').split('\n')[0]); if (cdpPort) break; }
    catch { /* Chrome still starting */ }
    if (browser.exitCode !== null) throw new Error('Chrome exited before debug port was ready');
    await sleep(100);
  }
  assert.ok(cdpPort > 0, 'Chrome debug port was not available');
  const targets = await (await fetch('http://127.0.0.1:' + cdpPort + '/json/list')).json();
  const tab = targets.find(t => t.type === 'page');
  assert.ok(tab?.webSocketDebuggerUrl, 'Chromium page target missing');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('CDP WebSocket refused'));
  });
  socket.onmessage = event => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('CHROME RUNTIME ERROR:', JSON.stringify(msg.params?.exceptionDetails));
    }
    if (!pending.has(msg.id)) return;
    const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.accept(msg.result || {});
  };
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:' + port + '/web/' });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.match(await evaluate("document.querySelector('#securityText').textContent"), /not encrypted/i);
  assert.equal(await evaluate("document.querySelectorAll('[data-filter]').length"), 5);

  // This is a browser interaction, not a synthetic policy test.
  const notes = await evaluate(`(() => {
    const input = document.getElementById('messageInput');
    input.value = 'Synthetic test note — no private data';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('composeForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    return document.getElementById('timeline').textContent;
  })()`);
  assert.match(notes, /Synthetic test note/);
  assert.equal(await evaluate(`(() => {
    const select = document.getElementById('transportSelect');
    select.value = 'SMS'; select.dispatchEvent(new Event('change', { bubbles: true }));
    return document.getElementById('sendButton').disabled;
  })()`), true, 'Unsupported SMS route must be blocked');

  assert.match(await evaluate(`(() => {
    document.querySelector('[data-filter="RCS"]').click();
    return document.getElementById('conversationList').textContent;
  })()`), /No conversations match/);
  await evaluate("document.querySelector('[data-filter=\"ALL\"]').click()");
  assert.equal(await evaluate(`(() => {
    document.getElementById('connectToggle').click();
    const panel = document.getElementById('connection');
    const open = !panel.hidden;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return open && panel.hidden;
  })()`), true, 'Connection panel opens and Escape closes it');
  const initialGCMode = await evaluate("document.documentElement.dataset.gcMode");
  assert.ok(initialGCMode === 'light' || initialGCMode === 'dark');
  await evaluate("document.getElementById('themeToggle').click()");
  const nextGCMode = await evaluate("document.documentElement.dataset.gcMode");
  assert.notEqual(nextGCMode, initialGCMode, 'Theme toggle must change visible color mode');
  assert.equal(await evaluate("document.documentElement.dataset.theme"), nextGCMode);

  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.ok(!(await evaluate("document.getElementById('timeline').textContent")).includes(
    'Synthetic test note'), 'Notes must be volatile after refresh');

  // Real UI → loopback Matrix REST integration with synthetic data.
  // No external homeserver and no real credentials/carrier network calls.
  const homeserver = 'http://127.0.0.1:' + port;
  await evaluate(`(() => {
    document.getElementById('connectToggle').click();
    const origin = document.getElementById('homeserverInput');
    origin.value = ${JSON.stringify(homeserver)};
    document.getElementById('tokenInput').value = 'synthetic-test-token';
    document.getElementById('connectForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  try {
    await until("document.getElementById('sidebarStatus').textContent.includes('Connected to Matrix')");
  } catch (error) {
    console.error('Synthetic fixture request sequence:', JSON.stringify(fixture.seen));
    throw error;
  }
  assert.equal(await evaluate("document.activeElement?.id"), "connectToggle",
    'Connection success must restore keyboard focus');
  await until("document.getElementById('timeline').textContent.includes('Synthetic inbound')");
  assert.equal(await evaluate("document.querySelector('#timeline img') === null"), true,
    'Matrix message bodies must be treated as text, never HTML');
  assert.equal(await evaluate("document.getElementById('tokenInput').value"), '',
    'Token input must be cleared after authentication');
  assert.equal(await evaluate("document.getElementById('sendButton').disabled"), true,
    'Plaintext sending must be blocked until per-session consent');

  await evaluate(`(() => {
    const checkbox = document.getElementById('plaintextConsent');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await evaluate("document.getElementById('sendButton').disabled"), false);
  fixture.failNextPut = true;
  await evaluate(`(() => {
    document.getElementById('messageInput').value = 'Synthetic uncertain DATA send';
    document.getElementById('composeForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await until("document.querySelector('#timeline button.retry') !== null");
  assert.equal(fixture.putAttempts.length, 1, 'Only one send attempt before retry');
  const originalTxn = fixture.putAttempts[0].txn;
  await evaluate("document.querySelector('#timeline button.retry').click()");
  await until("document.getElementById('timeline').textContent.includes('Accepted by homeserver')");
  assert.equal(fixture.putAttempts.length, 2);
  assert.equal(fixture.putAttempts[1].txn, originalTxn,
    'Retry must use original Matrix transaction ID');
  await evaluate("document.getElementById('refreshButton').click()");
  await until("document.getElementById('timeline').textContent.includes('Confirmed by sync')");
  assert.equal(fixture.putAttempts.length, 2, 'Read/refresh must not duplicate sends');

  await evaluate(`(() => {
    const sealed = [...document.querySelectorAll('#conversationList button')]
      .find(b => b.textContent.includes('Encrypted test room'));
    if (!sealed) throw new Error('Encrypted room not listed');
    sealed.click();
  })()`);
  assert.equal(await evaluate("document.getElementById('sendButton').disabled"), true,
    'Encrypted Matrix rooms must remain locked');
  assert.match(await evaluate("document.getElementById('timeline').textContent"),
    /locked/);
  assert.match(await evaluate("document.getElementById('securityText').textContent"),
    /Encryption reported · locked/);
  assert.doesNotMatch(await evaluate("document.getElementById('securityText').textContent"),
    /E2EE room/);
  await evaluate(`(() => {
    [...document.querySelectorAll('#conversationList button')]
      .find(b => b.textContent.includes('Unencrypted test room')).click();
  })()`);
  await until("document.getElementById('sendButton').disabled === false");
  fixture.plainEncrypted = true;
  await evaluate(`(() => {
    document.getElementById('messageInput').value = 'Must not send after encryption';
    document.getElementById('composeForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await until("document.getElementById('securityText').textContent.includes('unknown')");
  assert.equal(fixture.putAttempts.length, 2,
    'Encrypting a room before a subsequent send must block the PUT');

  await evaluate(`(() => {
    document.getElementById('connectToggle').click();
    document.getElementById('disconnectButton').click();
  })()`);
  assert.equal(await evaluate("document.getElementById('tokenInput').value"), '');
  assert.equal(await evaluate("document.getElementById('sidebarStatus').textContent.includes('no DATA session')"), true);
  assert.equal(await evaluate("document.getElementById('plaintextConsent').checked"), false);

  // Reconnect to a plaintext room, then simulate a revoked state lookup:
  // cached access must become "unknown" and all subsequent sends disabled.
  fixture.plainEncrypted = false;
  await evaluate(`(() => {
    document.getElementById('connectToggle').click();
    document.getElementById('homeserverInput').value = ${JSON.stringify(homeserver)};
    document.getElementById('tokenInput').value = 'synthetic-test-token';
    document.getElementById('connectForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await until("document.getElementById('timeline').textContent.includes('Synthetic inbound')");
  fixture.forbidPlainState = true;
  await evaluate("document.getElementById('refreshButton').click()");
  await until("document.getElementById('securityText').textContent.includes('unknown')");
  assert.equal(await evaluate("document.getElementById('sendButton').disabled"), true,
    'A forbidden room-state recheck must lock cached plaintext');
  assert.match(await evaluate("document.getElementById('timeline').textContent"), /locked/);
  fixture.forbidPlainState = false;
  await evaluate(`(() => {
    document.getElementById('connectToggle').click();
    document.getElementById('disconnectButton').click();
  })()`);

  // Invalid authentication must not silently recover a previous session.
  await evaluate(`(() => {
    document.getElementById('homeserverInput').value = ${JSON.stringify(homeserver)};
    document.getElementById('tokenInput').value = 'invalid-token';
    document.getElementById('connectForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await until("document.getElementById('connectionStatus').textContent.includes('401')");
  assert.equal(await evaluate("document.getElementById('sidebarStatus').textContent.includes('no DATA session')"), true);

  // A delayed successful whoami must not reconnect after a user disconnects.
  fixture.slowWhoami = true;
  await evaluate(`(() => {
    document.getElementById('tokenInput').value = 'synthetic-test-token';
    document.getElementById('connectForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    document.getElementById('disconnectButton').click();
  })()`);
  await sleep(500);
  assert.equal(await evaluate("document.getElementById('sidebarStatus').textContent.includes('no DATA session')"), true,
    'Cancelled authentication must not restore a Matrix session');
  assert.equal(fixture.credentialInUrl, false, 'Credentials must not be exposed in request URLs');
  assert.equal(fixture.putAttempts.length, 2);
  console.log('Matrix browser integration PASSED: consent, XSS, retry, sync, encrypted lock, cancellation');

  // Real browser integration of the *unused* crypto-store Web Locks guard.
  // This uses no Matrix identity, crypto keys, or external data.
  const primitives = await evaluate(`(async () => {
    const { acquireCryptoStoreLease } =
      await import('/src/crypto-store-lease.mjs');
    if (!isSecureContext || !navigator.locks || !indexedDB) {
      return { secure: false };
    }
    const first = await acquireCryptoStoreLease();
    try {
      let refused = false;
      try {
        const duplicate = await acquireCryptoStoreLease();
        await duplicate.release();
      } catch (error) {
        refused = error.message.includes('Another Messenger tab');
      }
      const held = await navigator.locks.query();
      const exclusiveHeld = held.held.some(lock =>
        lock.name === 'goreecloud-messenger:matrix-rust-crypto-store' &&
        lock.mode === 'exclusive');
      return { secure: true, refused, exclusiveHeld };
    } finally {
      await first.release();
    }
  })()`);
  assert.deepEqual(primitives,
    { secure: true, refused: true, exclusiveHeld: true },
    'Web Locks must reject concurrent crypto-store owners in real Chromium');
  const lockReleased = await evaluate(`(async () => {
    const { acquireCryptoStoreLease } =
      await import('/src/crypto-store-lease.mjs');
    const another = await acquireCryptoStoreLease();
    try {
      const held = await navigator.locks.query();
      return held.held.some(lock =>
        lock.name === 'goreecloud-messenger:matrix-rust-crypto-store');
    } finally {
      await another.release();
    }
  })()`);
  assert.equal(lockReleased, true, 'Released crypto store must be reusable');

  // A disposable IndexedDB database proves that Chromium storage can persist
  // across a navigation. This does NOT test Matrix Rust's crypto database.
  const dbWritten = await evaluate(`(async () => {
    const request = indexedDB.open('goreecloud-ci-crypto-primitives', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('synthetic');
    };
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const txn = db.transaction('synthetic', 'readwrite');
      txn.objectStore('synthetic').put('synthetic-only', 'lifecycle');
      await new Promise((resolve, reject) => {
        txn.oncomplete = resolve;
        txn.onerror = () => reject(txn.error);
        txn.onabort = () => reject(txn.error);
      });
      return true;
    } finally {
      db.close();
    }
  })()`);
  assert.equal(dbWritten, true);
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  const dbReloaded = await evaluate(`(async () => {
    const request = indexedDB.open('goreecloud-ci-crypto-primitives', 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const txn = db.transaction('synthetic', 'readonly');
      const finished = new Promise((resolve, reject) => {
        txn.oncomplete = resolve;
        txn.onerror = () => reject(txn.error);
        txn.onabort = () => reject(txn.error);
      });
      const record = txn.objectStore('synthetic').get('lifecycle');
      const value = await new Promise((resolve, reject) => {
        record.onsuccess = () => resolve(record.result);
        record.onerror = () => reject(record.error);
      });
      // db.close() does not abort ongoing transactions. Wait for completion
      // before requesting deletion to avoid an IndexedDB onblocked race.
      await finished;
      return value;
    } finally {
      db.close();
      const deletion = indexedDB.deleteDatabase('goreecloud-ci-crypto-primitives');
      await new Promise((resolve, reject) => {
        deletion.onsuccess = resolve;
        deletion.onerror = () => reject(deletion.error);
        // onblocked only notifies about a closing connection; success may
        // still follow. The CDP command timeout bounds this test.
      });
    }
  })()`);
  assert.equal(dbReloaded, 'synthetic-only',
    'A same-origin IndexedDB value must persist across navigation');
  console.log('Chromium crypto primitives PASSED: exclusive Web Locks, release, disposable IndexedDB persistence');

  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"), 'dark');
  assert.equal(await evaluate("document.documentElement.dataset.gcMode"), 'dark');
  assert.match(await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--gc-v1-color-primary')"), /#/);
  await capture('desktop-dark');
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"), 'light');
  assert.equal(await evaluate("document.documentElement.dataset.gcMode"), 'light');
  await capture('desktop-light');

  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await call('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  const layout = await evaluate(`({ width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasComposer: !!document.getElementById('composeForm'),
    hasSecurityStatus: !!document.getElementById('securityText') })`);
  assert.equal(layout.hasComposer, true);
  assert.equal(layout.hasSecurityStatus, true);
  assert.ok(layout.scrollWidth <= layout.width + 2,
    'Mobile page has horizontal overflow: ' + JSON.stringify(layout));
  await capture('mobile-dark');
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"), 'light');
  await capture('mobile-light');
  await call('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-contrast', value: 'more' }
    ]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("document.documentElement.dataset.gcContrast"), 'high');
  assert.equal(await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--gc-v1-color-canvas').trim().toLowerCase()"), '#000000');
  console.log('Browser smoke PASSED: notes, routing, filter, keyboard, theme, reload, 390px layout');
} finally {
  if (socket) socket.close();
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser terminated')); }
  pending.clear();
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill('SIGTERM');
    await Promise.race([exited, sleep(1500)]);
    if (browser.exitCode === null && browser.signalCode === null) {
      browser.kill('SIGKILL');
      await Promise.race([exited, sleep(1500)]);
    }
  }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  // Chrome may still flush profile journal files briefly after terminating.
  // Cleanup errors must not mask the result of browser interaction checks.
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 100 });
  } catch (error) {
    console.warn('Could not fully clean temporary Chrome profile:', error.code);
  }
}
