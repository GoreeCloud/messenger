#!/usr/bin/env node
/**
 * Test-only, loopback-only HTTPS reverse proxy for an ephemeral Synapse server.
 * Never use as a production gateway; real GoreeCloud ingress belongs to Gateway.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const DISALLOWED_HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

/** Only forward safe end-to-end headers, not connection control fields. */
export function forwardedHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !DISALLOWED_HOP_HEADERS.has(name.toLowerCase())),
  );
}

/** Enforce the expected Matrix API path, not an open proxy. */
export function permittedTestPath(path) {
  return typeof path === "string" &&
    path.startsWith("/_matrix/") && path.length <= 8192 &&
    !/[\x00-\x1f\x7f]/.test(path);
}

export function startEphemeralProxy(certFile, keyFile, upstreamPort = 18008) {
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) {
    throw new Error("Invalid disposable Matrix port.");
  }
  const server = https.createServer({
    cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile),
  }, (request, response) => {
    if (!permittedTestPath(request.url)) {
      response.writeHead(404, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: forwardedHeaders(request.headers),
      timeout: 35_000,
    }, (incoming) => {
      response.writeHead(incoming.statusCode || 502, {
        ...forwardedHeaders(incoming.headers), "Cache-Control": "no-store",
      });
      incoming.pipe(response);
    });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502, { "Cache-Control": "no-store" });
      response.end();
    });
    request.pipe(upstream);
  });
  server.listen(18443, "127.0.0.1", () => {
    console.log("Ephemeral test TLS proxy ready on loopback.");
  });
  return server;
}

if (process.argv[1]?.endsWith("ephemeral-tls-proxy.mjs")) {
  if (process.argv.length !== 4) {
    console.error("BLOCKED: a disposable certificate and key are required.");
    process.exit(2);
  }
  startEphemeralProxy(process.argv[2], process.argv[3]);
}
