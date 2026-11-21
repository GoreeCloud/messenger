import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { acceptInvitation, declineInvitation, listInvitations } from "../src/matrix";

function setup() {
  const rooms = [
    { roomId: "!pending:test", name: "Family", getMyMembership: () => "invite" },
    { roomId: "!joined:test", name: "Joined", getMyMembership: () => "join" },
    { roomId: "!pending2:test", name: "Friends", getMyMembership: () => "invite" },
  ];
  const mock = {
    getRooms: vi.fn(() => rooms),
    getRoom: vi.fn((id: string) => rooms.find(r => r.roomId === id) || null),
    joinRoom: vi.fn(async (id: string) => ({ roomId: id })),
    leave: vi.fn(async (_id: string) => ({})),
  };
  return { client: mock as unknown as MatrixClient, mock };
}

describe("explicit user-initiated Matrix invitation flow", () => {
  it("shows only pending invitations, never joined rooms", () => {
    const { client } = setup();
    expect(listInvitations(client)).toEqual([
      { id: "!pending:test", name: "Family" },
      { id: "!pending2:test", name: "Friends" },
    ]);
  });
  it("accepts the selected pending room using the official Matrix SDK", async () => {
    const { client, mock } = setup();
    await acceptInvitation(client, "!pending:test");
    expect(mock.joinRoom).toHaveBeenCalledExactlyOnceWith("!pending:test");
    expect(mock.leave).not.toHaveBeenCalled();
  });
  it("declines pending invitation without joining", async () => {
    const { client, mock } = setup();
    await declineInvitation(client, "!pending:test");
    expect(mock.leave).toHaveBeenCalledExactlyOnceWith("!pending:test");
    expect(mock.joinRoom).not.toHaveBeenCalled();
  });
  it.each(["!joined:test", "!not-found:test", ""])(
    "refuses mutations to a nonpending or unknown room: %s", async roomId => {
      const { client, mock } = setup();
      await expect(acceptInvitation(client, roomId)).rejects.toThrow();
      await expect(declineInvitation(client, roomId)).rejects.toThrow();
      expect(mock.joinRoom).not.toHaveBeenCalled();
      expect(mock.leave).not.toHaveBeenCalled();
    },
  );
  it("never infers encryption/trust from invited-room metadata", () => {
    const { client } = setup();
    expect(JSON.stringify(listInvitations(client))).not.toContain("encrypted");
    expect(JSON.stringify(listInvitations(client))).not.toContain("trusted");
  });
});
