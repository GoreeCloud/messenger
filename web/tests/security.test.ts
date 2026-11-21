import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { reactEncrypted, requireEncryptedRoom, safeMessage, sendEncryptedText } from "../src/security";

function mockClient(options: { room?: boolean; membership?: boolean; crypto?: boolean; persistent?: boolean } = {}) {
  const crypto = { isEncryptionEnabledInRoom: vi.fn(async () => options.persistent !== false) };
  const mock = {
    getRoom: vi.fn(() => options.room === false ? null : {
      getMyMembership: () => options.membership === false ? "invite" : "join",
    }),
    getCrypto: vi.fn(() => options.crypto === false ? undefined : crypto),
    sendTextMessage: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
    sendEvent: vi.fn(async () => ({})),
  };
  return { client: mock as unknown as MatrixClient, mock };
}

describe("Matrix encrypted message enforcement", () => {
  it.each([
    { room: false }, { membership: false }, { crypto: false }, { persistent: false },
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
    const { client, mock } = mockClient({ persistent: false });
    await expect(reactEncrypted(client, "!room:test", "$123", "👍")).rejects.toThrow();
    expect(mock.sendEvent).not.toHaveBeenCalled();
    await expect(reactEncrypted(client, "!room:test", "$123", "🚀")).rejects.toThrow();
  });
  it("never returns arbitrary sensitive server errors to the UI", () => {
    expect(safeMessage(new Error("Bearer super-secret token 123"))).not.toContain("super-secret");
  });
  it("reports only constant, sanitized local-vault errors", () => {
    expect(safeMessage(new Error("This encrypted device is already open in another tab.")))
      .toMatch(/already open/);
    expect(safeMessage(new Error("Bad vault token=secret123")))
      .not.toContain("secret123");
  });
  it.each([
    "Sending is disabled unless the room is joined. token=private",
    "Cryptographic room state is unavailable. Message was not sent. user=@alice:test",
    "Messages must contain 1–4,000 characters. bearer=secret",
    "Unsupported reaction. access_token=XYZ",
    "Cannot reply to an invalid event. /_matrix/client?token=secret",
  ])("redacts malicious lookalike SDK error prefixes: %s", upstream => {
    const userFacing = safeMessage(new Error(upstream));
    expect(userFacing).toBe("Operation failed. Check your connection, homeserver permissions and room state.");
    expect(userFacing).not.toContain("token");
    expect(userFacing).not.toContain("@alice");
  });

  it("still reports exact, trusted local policy errors", () => {
    expect(safeMessage(new Error("Sending is disabled unless the room is joined.")))
      .toBe("Sending is disabled unless the room is joined.");
    expect(safeMessage(new Error("Unsupported reaction."))).toBe("Unsupported reaction.");
  });

  it("rejects rooms missing a real client instance", async () => {
    const { client } = mockClient({ room: false });
    await expect(requireEncryptedRoom(client, "!missing:test")).rejects.toThrow();
  });
});
