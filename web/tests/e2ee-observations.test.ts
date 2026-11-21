import { describe, expect, it } from "vitest";
import { findEncryptedEvent, observedEncryptedEvent,
  isEncryptedReply, isEncryptedReaction } from "../scripts/e2ee-observations.mjs";

function wireEvent(overrides: Record<string, unknown> = {}) {
  return {
    getWireType: () => "m.room.encrypted",
    getType: () => "m.room.message",
    getSender: () => "@alice:test.example.org",
    getId: () => "$event:test.example.org",
    isDecryptionFailure: () => false,
    getContent: () => ({ body: "nonce" }),
    ...overrides,
  };
}

describe("authenticated Matrix wire-event observations", () => {
  it("requires actual ciphertext on wire, not just decrypted message type", () => {
    const secure = wireEvent();
    expect(observedEncryptedEvent(secure, "m.room.message", "@alice:test.example.org")).toBe(true);
    expect(observedEncryptedEvent(wireEvent({ getWireType: () => "m.room.message" }),
      "m.room.message", "@alice:test.example.org")).toBe(false);
    expect(observedEncryptedEvent(wireEvent({ isDecryptionFailure: () => true }),
      "m.room.message", "@alice:test.example.org")).toBe(false);
  });

  it("rejects unexpected senders or missing event IDs", () => {
    expect(observedEncryptedEvent(wireEvent(), "m.room.message", "@bob:test.example.org")).toBe(false);
    expect(observedEncryptedEvent(wireEvent({ getId: () => undefined }),
      "m.room.message", "@alice:test.example.org")).toBe(false);
  });

  it("finds only decrypted ciphertext envelopes meeting content predicate", () => {
    const plain = wireEvent({ getWireType: () => "m.room.message" });
    const secure = wireEvent();
    expect(findEncryptedEvent([plain, secure], "m.room.message", "@alice:test.example.org",
      (c: {body?: string}) => c.body === "nonce")).toBe(secure);
    expect(findEncryptedEvent([plain], "m.room.message", "@alice:test.example.org",
      () => true)).toBe(null);
  });

  it("requires a server-confirmed reply relation and expected body suffix", () => {
    const content = { body: "> quoted\n\nreply", "m.relates_to": {
      "m.in_reply_to": { event_id: "$source:test.example.org" } } };
    expect(isEncryptedReply(content, "$source:test.example.org", "reply")).toBe(true);
    expect(isEncryptedReply(content, "$other:test.example.org", "reply")).toBe(false);
    expect(isEncryptedReply({ body: "reply" }, "$source:test.example.org", "reply")).toBe(false);
  });

  it("accepts only the requested emoji annotation on the target event", () => {
    const content = { "m.relates_to": {
      rel_type: "m.annotation", event_id: "$source:test.example.org", key: "👍",
    } };
    expect(isEncryptedReaction(content, "$source:test.example.org", "👍")).toBe(true);
    expect(isEncryptedReaction(content, "$source:test.example.org", "❤️")).toBe(false);
    expect(isEncryptedReaction({ "m.relates_to": { ...content["m.relates_to"], rel_type: "m.reference" } },
      "$source:test.example.org", "👍")).toBe(false);
  });
});
