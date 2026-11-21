import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import {
  cryptoReadinessDisclaimer,
  cryptoReadinessSummary,
  inspectBrowserCryptoReadiness,
} from "../src/cryptoReadiness";

function fixture({
  master = false, self = false, user = false, publicKeys = false,
  secretStorage = false, activeVersion = null as string | null,
} = {}) {
  const crypto = {
    getCrossSigningStatus: vi.fn(async () => ({
      publicKeysOnDevice: publicKeys,
      privateKeysInSecretStorage: secretStorage,
      privateKeysCachedLocally: {
        masterKey: master, selfSigningKey: self, userSigningKey: user,
      },
    })),
    getActiveSessionBackupVersion: vi.fn(async () => activeVersion),
    bootstrapCrossSigning: vi.fn(),
    exportRoomKeys: vi.fn(),
    restoreKeyBackup: vi.fn(),
    resetKeyBackup: vi.fn(),
  };
  const client = { getCrypto: () => crypto } as unknown as Pick<MatrixClient, "getCrypto">;
  return { client, crypto };
}

describe("read-only Matrix Rust-backed browser SDK crypto readiness", () => {
  it("rejects missing crypto without fallback, network calls or data mutation", async () => {
    const client = { getCrypto: () => null } as unknown as Pick<MatrixClient, "getCrypto">;
    await expect(inspectBrowserCryptoReadiness(client)).rejects.toThrow(
      "Local crypto SDK status is unavailable.",
    );
  });

  it("describes unavailable keys and no active backup without trust guarantees", async () => {
    const { client, crypto } = fixture();
    const status = await inspectBrowserCryptoReadiness(client);
    expect(status).toEqual({
      publicSigningKeysAvailable: false,
      privateSigningKeysCached: false,
      signingKeysInSecretStorage: false,
      automaticBackupEnabled: false,
    });
    expect(crypto.getCrossSigningStatus).toHaveBeenCalledOnce();
    expect(crypto.getActiveSessionBackupVersion).toHaveBeenCalledOnce();
    expect(crypto.bootstrapCrossSigning).not.toHaveBeenCalled();
    expect(crypto.restoreKeyBackup).not.toHaveBeenCalled();
    expect(crypto.exportRoomKeys).not.toHaveBeenCalled();
  });

  it("requires all three local private signing key flags", async () => {
    const { client } = fixture({ master: true, self: true, user: false });
    expect((await inspectBrowserCryptoReadiness(client)).privateSigningKeysCached).toBe(false);
  });

  it("uses existence of active SDK backup version, never exposes its content", async () => {
    const { client, crypto } = fixture({
      master: true, self: true, user: true, publicKeys: true,
      secretStorage: true, activeVersion: "sensitive-to-account",
    });
    const status = await inspectBrowserCryptoReadiness(client);
    expect(status).toEqual({
      publicSigningKeysAvailable: true,
      privateSigningKeysCached: true,
      signingKeysInSecretStorage: true,
      automaticBackupEnabled: true,
    });
    const rendered = cryptoReadinessSummary(status);
    expect(rendered).not.toContain("sensitive-to-account");
    expect(rendered).not.toMatch(/restorable|verified|secure|guaranteed/i);
    expect(crypto.resetKeyBackup).not.toHaveBeenCalled();
  });

  it("keeps verification and recoverability disclaimers visible even when all flags are true", () => {
    const statement = cryptoReadinessDisclaimer;
    expect(statement).toContain("Other people's devices are not verified");
    expect(statement).toContain("not proof");
    expect(statement).toContain("restored");
  });
});
