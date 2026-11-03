import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

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
if (!paths.some(p => p.endsWith(".wasm"))) {
  throw Error("No Rust crypto WASM asset was emitted; fail closed");
}
console.log("Bundled real Matrix Rust/WASM browser probe with self-hosted WASM", paths.length, "outputs");
