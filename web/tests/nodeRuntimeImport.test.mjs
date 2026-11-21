import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * CI builds the browser with Vite but the disposable Matrix harness runs in
 * Node 24 directly. Only a real Node process can catch extensionless ESM
 * imports that bundler-oriented TypeScript resolves but node:esm cannot.
 */
describe("native Node 24 disposable Matrix harness module imports", () => {
  it("resolves real TypeScript mutation guard modules without a Vite bundler", () => {
    const source = fileURLToPath(new URL("../src/security.ts", import.meta.url));
    const runtime = process.execPath;
    const code =
      "const m = await import(" + JSON.stringify(new URL("../src/security.ts", import.meta.url).href) + ");" +
      "if (typeof m.requireEncryptedRoom !== 'function' || " +
      "typeof m.sendEncryptedText !== 'function') process.exit(2);";
    const outcome = spawnSync(runtime, ["--input-type=module", "-e", code], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(source.endsWith("src/security.ts")).toBe(true);
    expect(outcome.error).toBeUndefined();
    expect(outcome.status, outcome.stderr || outcome.stdout).toBe(0);
  });
});
