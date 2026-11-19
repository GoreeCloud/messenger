import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { reactEncrypted, requireEncryptedRoom, safeMessage, sendEncryptedText } from "../src/security";

function mockClient(options: { room?: boolean; encrypted?: boolean; crypto?: boolean; persistent?: boolean } = {}) {
  const crypto = { isEncryptionEnabledInRoom: vi.fn(async () => options.persistent !== false) };
  const mock = {
    getRoom: vi.fn(() => options.room === false ? null : {}),
    isRoomEncrypted: vi.fn(() => options.encrypted !== false),
    getCrypto: vi.fn(() => options.crypto === false ? undefined : crypto),
    sendTextMessage: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
    sendEvent: vi.fn(async () => ({})),
  };
  return { client: mock as unknown as MatrixClient, mock };
}

describe("Matrix encrypted message enforcement", () => {
  it.each([
    { room: false }, { encrypted: false }, { crypto: false }, { persistent: false },
  ])("blocks messaging when encrypted room/crypto cannot be verified: %j", async options => {
    const { client, mock } = mockClient(options);
    await expect(sendEncryptedText(client, "!room:test", "hello")).rejects.toThrow();
    expect(mock.sendTextMessage).not.toHaveBeenCalled();
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });
  it("sends when SDK state and crypto state both agree", async () => {
    const { client, mock } = mockClient();
    await sendEncryptedText(client, "!room:test", " hello ");
    expect(mock.sendTextMessage).toHaveBeenCalledWith("!room:test", "hello");
  });
  it("rejects empty messages before sending", async () => {
    const { client, mock } = mockClient();
    await expect(sendEncryptedText(client, "!room:test", " ")).rejects.toThrow();
    expect(mock.sendTextMessage).not.toHaveBeenCalled();
  });
  it("sends a Matrix reply with a referenced event", async () => {
    const { client, mock } = mockClient();
    await sendEncryptedText(client, "!room:test", "reply", { id: "$123", sender: "@a:test", body: "first" });
    expect(mock.sendMessage).toHaveBeenCalledOnce();
    expect(JSON.stringify(mock.sendMessage.mock.calls[0])).toContain("$123");
  });
  it("guards reactions behind E2EE and supported emoji", async () => {
    const { client, mock } = mockClient({ encrypted: false });
    await expect(reactEncrypted(client, "!room:test", "$123", "👍")).rejects.toThrow();
    expect(mock.sendEvent).not.toHaveBeenCalled();
    await expect(reactEncrypted(client, "!room:test", "$123", "🚀")).rejects.toThrow();
  });
  it("never returns arbitrary sensitive server errors to the UI", () => {
    expect(safeMessage(new Error("Bearer super-secret token 123"))).not.toContain("super-secret");
  });
  it("rejects rooms missing a real client instance", async () => {
    const { client } = mockClient({ room: false });
    await expect(requireEncryptedRoom(client, "!missing:test")).rejects.toThrow();
  });
});
