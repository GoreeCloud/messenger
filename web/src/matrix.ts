import { ClientEvent, createClient, EventType, MatrixClient, Preset, RoomEvent, Visibility } from "matrix-js-sdk";
import { normalizeHomeserver } from "./config";
import {
  acquireCryptoLease, persistentDeviceScope, readRememberedDevice, storeRememberedDevice,
  storageKey, validateVaultPassphrase,
} from "./deviceStore";
import type { ExclusiveLock } from "./deviceStore";

export type MessageView = { id: string; body: string; sender: string; timestamp: number; reactions: { emoji: string; count: number }[] };
export type RoomView = { id: string; name: string; encrypted: boolean; messages: MessageView[] };

export type SessionOptions = {
  rememberDevice?: boolean;
  devicePassphrase?: string;
};

const cryptoLeases = new WeakMap<MatrixClient, ExclusiveLock>();

/**
 * Access tokens are always memory-only. The opt-in encrypted IndexedDB Rust
 * crypto store uses a user-entered passphrase and a reused Matrix device ID.
 * Metadata in localStorage contains only that public device ID, never tokens.
 */
export async function connect(
  homeserver: string, username: string, password: string, changed: () => void,
  options: SessionOptions = {},
): Promise<MatrixClient> {
  const baseUrl = normalizeHomeserver(homeserver);
  const rememberDevice = options.rememberDevice === true;
  let scope: string | undefined;
  let savedId: string | null = null;
  let lease: ExclusiveLock | undefined;
  let client: MatrixClient | undefined;
  try {
    if (rememberDevice) {
      validateVaultPassphrase(options.devicePassphrase || "");
      if (typeof indexedDB === "undefined" || !navigator.locks) {
        throw new Error("Local encrypted crypto storage requires IndexedDB and Web Locks.");
      }
      scope = await persistentDeviceScope(baseUrl, username.trim());
      savedId = readRememberedDevice(window.localStorage, scope);
      // Do not open two Rust crypto clients against one IndexedDB at once.
      lease = await acquireCryptoLease(storageKey(scope), navigator.locks);
    }
    const anonymous = createClient({ baseUrl });
    const login = rememberDevice
      ? await anonymous.loginRequest({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: username.trim() },
        password,
        initial_device_display_name: "GoreeCloud Messenger web",
        ...(savedId ? { device_id: savedId } : {}),
      })
      : await anonymous.loginWithPassword(username, password);
    if (!login.access_token || !login.user_id || !login.device_id) {
      throw new Error("Homeserver did not return a usable session.");
    }
    client = createClient({
      baseUrl, accessToken: login.access_token, userId: login.user_id,
      deviceId: login.device_id,
    });
    if (rememberDevice && (login.user_id !== username.trim() ||
        (savedId !== null && savedId !== login.device_id))) {
      throw new Error("The homeserver returned a different device identity.");
    }
    await client.initRustCrypto(rememberDevice
      ? {
        useIndexedDB: true,
        cryptoDatabasePrefix: "goreecloud-messenger-v1-" + scope,
        storagePassword: options.devicePassphrase,
      }
      : { useIndexedDB: false });
    if (!client.getCrypto()) throw new Error("Unable to initialize Matrix cryptography.");
    client.on(ClientEvent.Sync, changed);
    client.on(RoomEvent.Timeline, changed);
    await client.startClient({ initialSyncLimit: 50 });
    // Commit the non-secret ID only after SDK crypto initialization succeeds.
    if (rememberDevice && scope) {
      storeRememberedDevice(window.localStorage, scope, login.device_id);
      if (lease) cryptoLeases.set(client, lease);
      lease = undefined;
    }
    return client;
  } catch (error) {
    client?.stopClient();
    if (client) {
      try { await client.logout(); } catch { /* no secrets in logs */ }
    }
    lease?.release();
    throw error;
  }
}

export function listRooms(client: MatrixClient): RoomView[] {
  return client.getRooms()
    .filter(room => room.getMyMembership() === "join")
    .map(room => {
      const encrypted = room.hasEncryptionStateEvent();
      const timeline = room.getLiveTimeline().getEvents();
      const reactionCounts = new Map<string, Map<string, number>>();
      for (const event of timeline.filter(event => event.getType() === EventType.Reaction)) {
        const relation = event.getContent()["m.relates_to"] as
          | { rel_type?: unknown; event_id?: unknown; key?: unknown } | undefined;
        if (relation?.rel_type !== "m.annotation" || typeof relation.event_id !== "string" ||
            !["👍", "❤️", "🎉"].includes(String(relation.key))) continue;
        const counts = reactionCounts.get(relation.event_id) || new Map<string, number>();
        counts.set(String(relation.key), (counts.get(String(relation.key)) || 0) + 1);
        reactionCounts.set(relation.event_id, counts);
      }
      const messages = timeline
        .filter(event => event.getType() === EventType.RoomMessage)
        .map(event => {
          const id = event.getId() || "";
          const body = event.isDecryptionFailure()
            ? "Encrypted message unavailable — check device keys."
            : String(event.getContent().body || "[Unsupported message]");
          return {
            id, body, sender: event.getSender() || "Unknown sender",
            timestamp: event.getTs(),
            reactions: [...(reactionCounts.get(id) || new Map()).entries()].map(([emoji, count]) => ({ emoji, count })),
          };
        });
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
  try { await client.logout(); } catch { /* App access token is still discarded. */ }
  finally {
    cryptoLeases.get(client)?.release();
    cryptoLeases.delete(client);
  }
}
