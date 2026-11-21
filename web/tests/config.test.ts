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
  it.each([
    "@alice:example.org\u0000", "@alice:example.org\u0001",
    "@alice:example.org\u007f", "@alice:example.org\u0085",
    "@alice:example.org\n", "@alice:example.org\t",
    "@a:ex ample.org", "@:example.org", "@alice:",
    "@alice:example.org".padEnd(260, "a"),
  ])("rejects control, whitespace, or malformed Matrix IDs: %s", value => {
    expect(validMatrixId(value)).toBe(false);
  });
});
