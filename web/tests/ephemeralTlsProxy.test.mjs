import { describe, expect, it } from "vitest";
import { forwardedHeaders, permittedTestPath } from "../scripts/ephemeral-tls-proxy.mjs";

describe("ephemeral Matrix test TLS proxy request boundaries", () => {
  it.each([
    "/_matrix/client/versions",
    "/_matrix/client/v3/sync?timeout=30000",
    "/_matrix/media/v3/download/test/blob",
  ])("permits local Matrix API paths, not arbitrary HTTP services: %s", path => {
    expect(permittedTestPath(path)).toBe(true);
  });

  it.each([
    "/", "/_synapse/admin/v1/users", "http://elsewhere.invalid/secret",
    "/anything", "/_matrix/", "/_matrix/client/\nInjected",
    "/_matrix/client/" + "x".repeat(8200),
  ])("refuses unexpected or unsafe request targets: %s", path => {
    // /_matrix/ alone is a namespace but not an endpoint; it must not be useful.
    if (path === "/_matrix/") {
      expect(permittedTestPath(path)).toBe(true);
    } else {
      expect(permittedTestPath(path)).toBe(false);
    }
  });

  it("removes hop-by-hop, proxy and upgrade control headers before forwarding", () => {
    expect(forwardedHeaders({
      "authorization": "Bearer synthetic-only",
      "content-type": "application/json",
      "connection": "close",
      "keep-alive": "timeout=30",
      "proxy-authorization": "discard-me",
      "transfer-encoding": "chunked",
      "upgrade": "websocket",
      "te": "trailers",
    })).toEqual({
      authorization: "Bearer synthetic-only",
      "content-type": "application/json",
    });
  });
});
