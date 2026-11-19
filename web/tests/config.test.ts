import { describe, expect, it } from "vitest";
import { normalizeHomeserver, validMatrixId } from "../src/config";
describe("homeserver URL safety", () => {
  it("accepts HTTPS", () => expect(normalizeHomeserver("https://matrix.example.org/")).toBe("https://matrix.example.org"));
  it("accepts local HTTP development", () => expect(normalizeHomeserver("http://localhost:8008")).toBe("http://localhost:8008"));
  it.each(["http://example.com", "https://user:secret@example.com", "https://example.com/api", "javascript:alert(1)"])("rejects %s", (url) => {
    expect(() => normalizeHomeserver(url)).toThrow();
  });
});
describe("Matrix ID validation", () => {
  it("accepts a valid ID", () => expect(validMatrixId("@alice:example.org")).toBe(true));
  it("rejects malformed IDs", () => expect(validMatrixId("alice@example.org")).toBe(false));
});
