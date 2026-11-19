import { ClientEvent, createClient, EventType, MatrixClient, Preset, RoomEvent, Visibility } from "matrix-js-sdk";
import { normalizeHomeserver } from "./config";

export type MessageView = { id: string; body: string; sender: string; timestamp: number };
export type RoomView = { id: string; name: string; encrypted: boolean; messages: MessageView[] };

/** A deliberately memory-only session: no credentials or bearer tokens in browser storage. */
export async function connect(
  homeserver: string, username: string, password: string, changed: () => void
): Promise<MatrixClient> {
  const baseUrl = normalizeHomeserver(homeserver);
  const unauthenticated = createClient({ baseUrl });
  const login = await unauthenticated.loginWithPassword(username, password);
  if (!login.access_token || !login.user_id) throw new Error("Homeserver did not return a usable session.");
  const client = createClient({
    baseUrl, accessToken: login.access_token, userId: login.user_id,
    deviceId: login.device_id,
  });
  // Abort the entire login if the audited upstream Rust-backed crypto cannot initialize.
  // Never silently fall back to sending plaintext in encrypted conversations.
  await client.initRustCrypto({ useIndexedDB: false });
  client.on(ClientEvent.Sync, changed);
  client.on(RoomEvent.Timeline, changed);
  await client.startClient({ initialSyncLimit: 50 });
  return client;
}

export function listRooms(client: MatrixClient): RoomView[] {
  return client.getRooms()
    .filter(room => room.getMyMembership() === "join")
    .map(room => {
      const encrypted = Boolean(room.currentState.getStateEvents(EventType.RoomEncryption, ""));
      const messages = room.getLiveTimeline().getEvents()
        .filter(event => event.getType() === EventType.RoomMessage)
        .map(event => ({
          id: event.getId() || "",
          body: String(event.getContent().body || ""),
          sender: event.getSender() || "Unknown sender",
          timestamp: event.getTs(),
        }));
      return { id: room.roomId, name: room.name || room.roomId, encrypted, messages: messages.slice(-80) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPrivateEncryptedRoom(client: MatrixClient, name: string): Promise<string> {
  const result = await client.createRoom({
    name: name.trim(),
    preset: Preset.PrivateChat, visibility: Visibility.Private,
    initial_state: [{
      type: EventType.RoomEncryption,
      state_key: "",
      content: { algorithm: "m.megolm.v1.aes-sha2" },
    }],
  });
  return result.room_id;
}

export async function leaveSession(client: MatrixClient): Promise<void> {
  client.stopClient();
  try { await client.logout(); } catch { /* Token still disappears from app memory. */ }
}
