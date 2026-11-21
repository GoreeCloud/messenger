import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { createPrivateEncryptedRoom } from "../src/matrix";
import {
  inviteEncryptedUser, reactEncrypted, safeMessage, sendEncryptedText, validRemoteEventId,
} from "../src/security";

function clientFixture(encrypted = true) {
  const mock = {
    getRoom: vi.fn(() => ({ getMyMembership: () => "join" })),
    getCrypto: vi.fn(() => ({
      isEncryptionEnabledInRoom: vi.fn(async () => encrypted),
    })),
    sendTextMessage: vi.fn(async (_room: string, _body: string) => ({})),
    sendMessage: vi.fn(async (_room: string, _content: unknown) => ({})),
    sendEvent: vi.fn(async (_room: string, _type: string, _content: unknown) => ({})),
    createRoom: vi.fn(async (_options: unknown) => ({ room_id: "!encrypted:test.invalid" })),
    invite: vi.fn(async (_room: string, _id: string) => ({})),
  };
  return { client: mock as unknown as MatrixClient, mock };
}

describe("encrypted Matrix mutations validate hostile payload boundaries", () => {
  it.each(["  ", "x".repeat(91)])("refuses unsafe room names before a server mutation", async name => {
    const { client, mock } = clientFixture();
    await expect(createPrivateEncryptedRoom(client, name)).rejects.toThrow();
    expect(mock.createRoom).not.toHaveBeenCalled();
  });

  it("trims a new room name while retaining its Matrix initial encryption state", async () => {
    const { client, mock } = clientFixture();
    await expect(createPrivateEncryptedRoom(client, "  family  ")).resolves.toBe("!encrypted:test.invalid");
    const options = mock.createRoom.mock.calls[0][0];
    expect(JSON.stringify(options)).toContain("family");
    expect(JSON.stringify(options)).toContain("m.room.encryption");
  });

  it.each(["$valid", "$bad\nInjected: token", "$" + "a".repeat(300), "no-event-id"])(
    "rejects unexpected remote event ID characters/size: %s", id => {
      expect(validRemoteEventId(id)).toBe(id === "$valid");
    });

  it("rejects malformed reply sender IDs without invoking the Matrix SDK", async () => {
    const { client, mock } = clientFixture();
    await expect(sendEncryptedText(client, "!room:test", "answer", {
      id: "$valid", sender: "@a:test\nInjection", body: "quote",
    })).rejects.toThrow();
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("bounds untrusted quote length rather than transmitting remote megabyte content", async () => {
    const { client, mock } = clientFixture();
    await sendEncryptedText(client, "!room:test", "answer", {
      id: "$valid", sender: "@alice:test", body: "Q".repeat(250_000),
    });
    expect(mock.sendMessage).toHaveBeenCalledOnce();
    expect(JSON.stringify(mock.sendMessage.mock.calls[0]).length).toBeLessThan(2000);
  });

  it("refuses invitations into rooms without cryptographic encryption state", async () => {
    const { client, mock } = clientFixture(false);
    await expect(inviteEncryptedUser(client, "!room:test", "@bob:test")).rejects.toThrow();
    expect(mock.invite).not.toHaveBeenCalled();
  });

  it.each([
    "@bob:example.org\n", "\t@bob:example.org",
    "@bob:example.org\u0000", "@bob:example.org\u0085",
  ])("refuses controls even if trim would otherwise remove them: %s", async id => {
    const { client, mock } = clientFixture();
    await expect(inviteEncryptedUser(client, "!room:test", id)).rejects.toThrow();
    expect(mock.invite).not.toHaveBeenCalled();
  });

  it("refuses malformed invite identifiers and allows a validated invite only after crypto gate", async () => {
    const { client, mock } = clientFixture();
    await expect(inviteEncryptedUser(client, "!room:test", "unsafe\nuser")).rejects.toThrow();
    expect(mock.invite).not.toHaveBeenCalled();
    await inviteEncryptedUser(client, "!room:test", "  @bob:test  ");
    expect(mock.invite).toHaveBeenCalledWith("!room:test", "@bob:test");
  });

  it("rejects reaction targets with injected event-ID control characters", async () => {
    const { client, mock } = clientFixture();
    await expect(reactEncrypted(client, "!room:test", "$valid\rBad", "👍")).rejects.toThrow();
    expect(mock.sendEvent).not.toHaveBeenCalled();
  });

  it("surfaces only exact, controlled invite errors with no untrusted server suffix", () => {
    expect(safeMessage(new Error("Enter a valid Matrix user ID.")))
      .toBe("Enter a valid Matrix user ID.");
    expect(safeMessage(new Error("Enter a valid Matrix user ID. token=secret")))
      .not.toContain("secret");
  });
});
