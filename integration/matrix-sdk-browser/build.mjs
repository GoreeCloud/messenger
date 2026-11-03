import { build } from "esbuild";
import { mkdir, copyFile, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("dist", { recursive: true });
const result = await build({
  entryPoints: ["browser-probe.mjs"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  outfile: "dist/browser-probe.js",
  assetNames: "rust-[hash]",
  loader: { ".wasm": "file" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
  metafile: true
});
const paths = Object.keys(result.metafile.outputs);
if (!paths.some(p => p.endsWith("browser-probe.js"))) throw Error("Missing browser entrypoint");
// Matrix's browser entrypoint uses:
// new URL("./pkg/matrix_sdk_crypto_wasm_bg.wasm", import.meta.url).
// esbuild does not treat that dynamic relative URL as an import; therefore
// copy the EXACT pinned dependency's WASM beside the browser ESM output.
// Do not embed, download, replace or synthesize another WASM implementation.
const source = resolve("node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm");
const target = resolve("dist/pkg/matrix_sdk_crypto_wasm_bg.wasm");
const input = await stat(source);
if (!input.isFile() || input.size < 1024) throw Error("Pinned Rust WASM is unavailable");
const bundled = await readFile("dist/browser-probe.js", "utf8");
if (!bundled.includes("./pkg/matrix_sdk_crypto_wasm_bg.wasm")) {
  throw Error("Unexpected Matrix SDK WASM asset URL; cannot safely package bundle");
}
await mkdir("dist/pkg", { recursive: true });
await copyFile(source, target);
const output = await stat(target);
if (output.size !== input.size) throw Error("Rust WASM asset length mismatch");
console.log("Bundled local real Matrix Rust/WASM browser probe; asset bytes:", output.size);
