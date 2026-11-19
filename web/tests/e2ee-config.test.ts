import { describe, expect, it } from "vitest";
import { readTestEnvironment, requiredNames } from "../scripts/e2ee-config.mjs";
const config = () => ({
  MATRIX_TEST_HOMESERVER: "https://test.example.org",
  MATRIX_TEST_A_ID: "@alice:test.example.org",
  MATRIX_TEST_A_PASSWORD: "dummy-a",
  MATRIX_TEST_B_ID: "@bob:test.example.org",
  MATRIX_TEST_B_PASSWORD: "dummy-b",
});

describe("live E2EE harness preflight", () => {
  it("rejects absent secrets without printing them", () => {
    expect(() => readTestEnvironment({})).toThrow("Missing isolated test configuration");
  });
  it.each([
    "http://matrix.example.org", "https://alice:secret@matrix.example.org",
    "https://matrix.example.org/_matrix", "https://matrix.example.org/#test",
  ])("refuses unsafe homeserver origins: %s", homeserver => {
    expect(() => readTestEnvironment({ ...config(), MATRIX_TEST_HOMESERVER: homeserver })).toThrow();
  });
  it("requires two separate test identities", () => {
    const input = config();
    expect(() => readTestEnvironment({ ...input, MATRIX_TEST_B_ID: input.MATRIX_TEST_A_ID })).toThrow();
  });
  it("rejects impossible timeouts", () => {
    expect(() => readTestEnvironment({ ...config(), MATRIX_TEST_TIMEOUT_MS: "NaN" })).toThrow();
    expect(() => readTestEnvironment({ ...config(), MATRIX_TEST_TIMEOUT_MS: "1" })).toThrow();
  });
  it("accepts valid isolated HTTPS test configuration", () => {
    const input = readTestEnvironment(config());
    expect(input.a).toBe("@alice:test.example.org");
    expect(input.timeoutMs).toBe(90000);
    expect(requiredNames).toHaveLength(5);
  });
});
