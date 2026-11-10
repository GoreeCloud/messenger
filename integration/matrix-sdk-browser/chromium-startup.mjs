/**
 * Bounded first-party Chromium startup gate for the disposable Matrix browser probe.
 * Never reads browser data, inherits no secrets, and exposes no raw Chrome stderr.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function waitForChromiumDebugPort({
  profile, hasExited, read = readFileSync, pause = delay,
  attempts = 240, intervalMs = 100
}) {
  if (typeof profile !== "string" || !profile ||
      typeof hasExited !== "function" || typeof read !== "function" ||
      typeof pause !== "function" ||
      !Number.isInteger(attempts) || attempts < 1 || attempts > 300 ||
      !Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 1000) {
    throw new TypeError("Invalid Chromium startup parameters");
  }
  const path = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (hasExited()) throw new Error("Chromium exited before DevTools became ready");
    try {
      const raw = read(path, "utf8");
      // A private fresh profile avoids stale port-file reuse. Only accept a
      // complete, literal TCP port, never partially written or malformed data.
      const match = typeof raw === "string" && /^([1-9][0-9]{0,4})\r?\n/.exec(raw);
      if (match) {
        const port = Number(match[1]);
        if (port >= 1 && port <= 65535) return port;
      }
    } catch {
      // A missing/partial DevToolsActivePort is expected during startup.
    }
    if (attempt + 1 < attempts) await pause(intervalMs);
  }
  throw new Error("Chromium remote debugging did not start within the bounded window");
}
