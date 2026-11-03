/**
 * Dependency-free Node 22+ / Chromium DevTools harness. The browser profile
 * and HTTP server are temporary and loopback-only; no external Matrix traffic.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "dist");
const profile = mkdtempSync(join(tmpdir(), "goreecloud-rust-idb-"));
const chrome = process.env.CHROME_BIN || (existsSync("/usr/bin/google-chrome")
  ? "/usr/bin/google-chrome" : existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : "chromium");
const types = { ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (name === "/_matrix/client/v3/account/whoami" && req.method === "GET") {
      const token = req.headers.authorization;
      if (token !== "Bearer synthetic-never-valid-token" &&
          token !== "Bearer synthetic-mismatch-device-token") {
        res.writeHead(401, { "Content-Type": "application/json",
          "Cache-Control": "no-store" });
        res.end(JSON.stringify({ errcode: "M_UNKNOWN_TOKEN" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify({
        user_id: "@synthetic:localhost",
        device_id: token.includes("mismatch") ? "WRONGDEVICE" : "BROWSERTEST1"
      }));
      return;
    }
    if (name.startsWith("/_matrix/")) {
      res.writeHead(404, { "Cache-Control": "no-store" }); res.end(); return;
    }
    const path = resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!path.startsWith(root + sep) || !Object.hasOwn(types, extname(path))) {
      res.writeHead(403); res.end(); return;
    }
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)],
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; object-src 'none'" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end();
  }
});
let browser, socket;
const pending = new Map();
let nextId = 1;
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timeout = setTimeout(() => {
      pending.delete(id); reject(new Error("CDP timeout: " + method));
    }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const answer = await call("Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true });
  if (answer.exceptionDetails) throw Error("Browser exception: " + answer.exceptionDetails.text);
  return answer.result.value;
}
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu",
    "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*",
    "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
  let debugPort = 0;
  for (let n = 0; n < 100; n++) {
    try { debugPort = Number(readFileSync(join(profile, "DevToolsActivePort"),
      "utf8").split("\n")[0]); if (debugPort) break; }
    catch { /* starting Chromium */ }
    if (browser.exitCode !== null) throw Error("Chromium terminated before debug connection");
    await sleep(100);
  }
  assert.ok(debugPort, "Chromium remote debugging did not start");
  const targets = await (await fetch("http://127.0.0.1:" + debugPort + "/json/list")).json();
  const page = targets.find(x => x.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "No Chromium page target");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(Error("CDP connection refused"));
  });
  socket.onmessage = event => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.method === "Runtime.exceptionThrown") {
      console.error("Browser exception:", msg.params?.exceptionDetails?.text);
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id); clearTimeout(p.timeout);
    if (msg.error) p.reject(Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result || {});
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate", { url: "http://127.0.0.1:" + port + "/" });
  let last = null;
  for (let tries = 0; tries < 240; tries++) {
    try {
      last = await evaluate(`({
        state: document.getElementById("result")?.dataset.status || null,
        message: document.getElementById("result")?.textContent || null,
        location: location.pathname + location.search
      })`);
    } catch { /* navigation briefly drops execution context */ }
    if (last?.state === "passed") break;
    if (last?.state === "failed") throw Error("Rust browser probe: " + last.message);
    await sleep(150);
  }
  assert.equal(last?.state, "passed", "Browser crypto persistence did not pass: " +
    JSON.stringify(last));
  assert.equal(last.location, "/index.html?phase=reopen");
  console.log("PASS: real matrix-js-sdk 45.0.0 + GoreeCloud SecureDataBootstrap; mismatched whoami denied; encrypted IndexedDB opened/reopened/cleaned");
  console.log("No live server, encrypted message, identity verification or key recovery was tested");
} finally {
  if (socket) socket.close();
  for (const p of pending.values()) {
    clearTimeout(p.timeout);
    p.reject(Error("Browser terminated"));
  }
  pending.clear();
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    const exited = new Promise(resolve => browser.once("exit", resolve));
    browser.kill("SIGTERM");
    await Promise.race([exited, sleep(1500)]);
    if (browser.exitCode === null && browser.signalCode === null) {
      browser.kill("SIGKILL");
      await Promise.race([exited, sleep(1500)]);
    }
  }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
  catch (err) { console.warn("Temp Chrome profile cleanup:", err.code); }
}
