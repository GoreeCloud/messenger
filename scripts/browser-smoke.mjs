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
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
    body: document.body?.innerText?.slice(0, 250) })`).catch(error => ({ error: error.message }));
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
  await evaluate("document.getElementById('themeToggle').click()");
  assert.equal(await evaluate("document.documentElement.dataset.theme"), 'light');

  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.ok(!(await evaluate("document.getElementById('timeline').textContent")).includes(
    'Synthetic test note'), 'Notes must be volatile after refresh');
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"), 'dark');
  await capture('desktop-dark');
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }]
  });
  await call('Page.reload', { ignoreCache: true });
  await until("document.readyState === 'complete' && document.querySelectorAll('#conversationList button').length > 0");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).colorScheme"), 'light');
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
