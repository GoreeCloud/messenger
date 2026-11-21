import { createClient } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { privateE2EELogger } from "../scripts/private-e2ee-logger.mjs";

describe("disposable Matrix test logging privacy", () => {
  it("suppresses mock session/room-key payloads through all logger severities", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const level of ["trace", "debug", "info", "warn", "error"]) {
        privateE2EELogger[level]("synthetic JWT, device key, encryption session");
        privateE2EELogger.getChild("crypto")[level]("fake signing key");
      }
      expect(log).not.toHaveBeenCalled();
      expect(err).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(privateE2EELogger.getChild("crypto")).toBe(privateE2EELogger);
    } finally {
      log.mockRestore(); err.mockRestore(); warn.mockRestore();
    }
  });

  it("is accepted as the pinned JS SDK MatrixClient test logger", () => {
    const client = createClient({
      baseUrl: "https://matrix.example.invalid",
      logger: privateE2EELogger,
    });
    expect(Reflect.get(client, "logger")).toBe(privateE2EELogger);
    client.stopClient();
  });
});
