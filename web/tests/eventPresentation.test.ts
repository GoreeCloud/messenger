import { describe, expect, it } from "vitest";
import { EventType } from "matrix-js-sdk";
import type { MatrixEvent, MatrixClient } from "matrix-js-sdk";
import { blockedPlaintext, canDisplayReaction, displayEventBody, fromEncryptedEnvelope,
  undecryptable, unsupportedMessage } from "../src/eventPresentation";
import { listRooms } from "../src/matrix";

function event(wire: string, body: unknown = "hello", failed = false) {
  return {
    getWireType: () => wire,
    isDecryptionFailure: () => failed,
    getContent: () => ({ body }),
    getType: () => EventType.RoomMessage,
    getId: () => "$event:example.org",
    getSender: () => "@alice:example.org",
    getTs: () => 1000,
  } as unknown as MatrixEvent;
}

describe("fail-closed encrypted timeline rendering", () => {
  it("shows ciphertext-only decrypted messages in encrypted rooms", () => {
    expect(displayEventBody(event("m.room.encrypted", "decrypted"), true)).toBe("decrypted");
  });

  it("blocks plaintext injected into encrypted rooms despite decrypted event type", () => {
    expect(displayEventBody(event(EventType.RoomMessage, "server plaintext"), true))
      .toBe(blockedPlaintext);
    expect(displayEventBody(event(EventType.RoomMessage, "server plaintext"), true))
      .not.toContain("server plaintext");
  });

  it("does not pretend undecryptable ciphertext is readable", () => {
    expect(displayEventBody(event("m.room.encrypted", "sensitive", true), true))
      .toBe(undecryptable);
  });

  it("keeps intentional view-only plaintext room semantics distinct", () => {
    expect(displayEventBody(event(EventType.RoomMessage, "public room"), false))
      .toBe("public room");
  });

  it("does not stringify untrusted objects or malformed event bodies", () => {
    expect(displayEventBody(event("m.room.encrypted", { token: "private" }), true))
      .toBe(unsupportedMessage);
  });

  it("truncates oversized untrusted ciphertext plaintext after successful decryption", () => {
    const body = "x".repeat(20_000);
    const displayed = displayEventBody(event("m.room.encrypted", body), true);
    expect(displayed.length).toBeLessThan(13_000);
    expect(displayed).toContain("[Truncated]");
  });

  it("does not count server-injected plaintext reactions in encrypted rooms", () => {
    expect(canDisplayReaction(event(EventType.Reaction), true)).toBe(false);
    expect(canDisplayReaction(event("m.room.encrypted"), true)).toBe(true);
    expect(canDisplayReaction(event("m.room.encrypted", "x", true), true)).toBe(false);
  });

  it("treats nonencrypted plaintext events as ordinary in view-only public rooms", () => {
    expect(fromEncryptedEnvelope(event(EventType.RoomMessage), false)).toBe(true);
  });

  it("integrates the same wire rule into room list rendering", () => {
    const plaintext = event(EventType.RoomMessage, "server-injected");
    const encrypted = event("m.room.encrypted", "decrypted");
    const client = {
      getRooms: () => [{
        roomId: "!a:example.org", name: "Secret", getMyMembership: () => "join",
        hasEncryptionStateEvent: () => true,
        getLiveTimeline: () => ({ getEvents: () => [plaintext, encrypted] }),
      }],
    } as unknown as MatrixClient;
    const room = listRooms(client)[0];
    expect(room.encrypted).toBe(true);
    expect(room.messages.map(m => m.body)).toEqual([blockedPlaintext, "decrypted"]);
  });
});
