import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { leaveSession } from "../src/matrix";

const fakeClient = (logout: () => Promise<unknown>) => {
  const stopClient = vi.fn();
  const auth = { stopClient, logout: vi.fn(logout) };
  return { client: auth as unknown as MatrixClient, ...auth };
};

describe("browser logout truthfulness and bounded disposal", () => {
  afterEach(() => vi.useRealTimers());

  it("confirms remote token revocation only when the server succeeds", async () => {
    const { client, stopClient, logout } = fakeClient(async () => ({}));
    expect(await leaveSession(client, 500)).toBe(true);
    expect(stopClient).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledOnce();
  });

  it("reports unconfirmed server revocation when network logout fails", async () => {
    const { client, stopClient } = fakeClient(async () => { throw new Error("Sensitive bearer token"); });
    expect(await leaveSession(client, 500)).toBe(false);
    expect(stopClient).toHaveBeenCalledOnce();
  });

  it("returns control after a bounded unresolved server logout", async () => {
    vi.useFakeTimers();
    const { client, stopClient } = fakeClient(() => new Promise(() => {}));
    const result = leaveSession(client, 50);
    await vi.advanceTimersByTimeAsync(51);
    expect(await result).toBe(false);
    expect(stopClient).toHaveBeenCalledOnce();
  });

  it("refuses to call a successful local signout a revoked server session after stop failure", async () => {
    const { client, stopClient, logout } = fakeClient(async () => ({}));
    stopClient.mockImplementation(() => { throw new Error("unavailable"); });
    expect(await leaveSession(client, 100)).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });
});
