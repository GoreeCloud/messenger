import { createClient, EventType } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { reactEncrypted, safeMessage } from "../src/security";

function isolatedFake() {
  const sdk = {
    getRoom: vi.fn(() => ({ getMyMembership: () => "join" })),
    getCrypto: vi.fn(() => ({ isEncryptionEnabledInRoom: vi.fn(async () => true) })),
    sendEvent: vi.fn(async () => ({ event_id: "$unexpected" })),
    sendMessage: vi.fn(async () => ({ event_id: "$unexpected" })),
    sendTextMessage: vi.fn(async () => ({ event_id: "$unexpected" })),
  };
  return { sdk, client: sdk as unknown as MatrixClient };
}

describe("reaction privacy boundary in pinned Matrix JS SDK", () => {
  it("pinned SDK 45.1.0 exempts even valid reactions from event encryption", async () => {
    const client = createClient({ baseUrl: "https://matrix.example.invalid" });
    // Intentionally inspect the pinned SDK's non-public routing method in
    // a regression test only. App code does not call private SDK APIs.
    const shouldEncrypt = Reflect.get(client, "shouldEncryptEventForRoom") as (
      event: unknown, room: unknown,
    ) => Promise<boolean>;
    const actual = await shouldEncrypt.call(client,
      {
        isEncrypted: () => false,
        getType: () => EventType.Reaction,
      } as never,
      { roomId: "!room:example.invalid", hasEncryptionStateEvent: () => true } as never,
    );
    expect(actual).toBe(false);
    client.stopClient();
  });

  it.each(["👍", "❤️", "🎉"])(
    "refuses a valid %s reaction without calling any plaintext/SDK send method", async emoji => {
      const { sdk, client } = isolatedFake();
      await expect(reactEncrypted(client, "!room:example.invalid", "$remote", emoji))
        .rejects.toThrow("Encrypted reactions are unavailable with this Matrix SDK.");
      expect(sdk.sendEvent).not.toHaveBeenCalled();
      expect(sdk.sendMessage).not.toHaveBeenCalled();
      expect(sdk.sendTextMessage).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid emoji/event IDs without any send attempt", async () => {
    const { sdk, client } = isolatedFake();
    await expect(reactEncrypted(client, "!room:example.invalid", "$event\nInjected", "👍"))
      .rejects.toThrow("Unsupported reaction.");
    await expect(reactEncrypted(client, "!room:example.invalid", "$remote", "🚀"))
      .rejects.toThrow("Unsupported reaction.");
    expect(sdk.sendEvent).not.toHaveBeenCalled();
  });

  it("exact-match redacted user message is allowed, injected suffix is not", () => {
    expect(safeMessage(new Error("Encrypted reactions are unavailable with this Matrix SDK.")))
      .toBe("Encrypted reactions are unavailable with this Matrix SDK.");
    expect(safeMessage(new Error(
      "Encrypted reactions are unavailable with this Matrix SDK. token=synthetic",
    ))).not.toContain("synthetic");
  });
});
