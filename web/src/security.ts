import { EventType, MatrixClient, MsgType, RelationType } from "matrix-js-sdk";
import { validMatrixId } from "./config.ts";

/** Never rely on a decorative padlock or a stale room-list flag for send authorization. */
export async function requireEncryptedRoom(client: MatrixClient, roomId: string): Promise<void> {
  const room = client.getRoom(roomId);
  if (!roomId || !room || room.getMyMembership() !== "join") {
    throw new Error("Sending is disabled unless the room is joined.");
  }
  const crypto = client.getCrypto();
  // The synchronous isRoomEncrypted() API is deprecated for Rust crypto.
  // The crypto store tracks encryption even if a compromised server removes
  // the state event (a downgrade attempt).
  if (!crypto || !(await crypto.isEncryptionEnabledInRoom(roomId))) {
    throw new Error("Cryptographic room state is unavailable. Message was not sent.");
  }
}

/** Accept only bounded Matrix event IDs, never arbitrary header/control data. */
export function validRemoteEventId(value: string): boolean {
  return value.startsWith("$") && value.length <= 255 && !/[\u0000-\u001f\u007f\s]/.test(value);
}

/** This preview never invites other users into unencrypted rooms. */
export async function inviteEncryptedUser(
  client: MatrixClient, roomId: string, userId: string,
): Promise<void> {
  const id = userId.trim();
  if (!validMatrixId(id)) throw new Error("Enter a valid Matrix user ID.");
  await requireEncryptedRoom(client, roomId);
  await client.invite(roomId, id);
}

/** Fail closed when the client cannot establish crypto state. */
export async function sendEncryptedText(
  client: MatrixClient, roomId: string, rawBody: string,
  replyingTo?: { id: string; sender: string; body: string },
): Promise<void> {
  const body = rawBody.trim();
  if (body.length < 1 || body.length > 4000) throw new Error("Messages must contain 1–4,000 characters.");
  await requireEncryptedRoom(client, roomId);
  if (replyingTo) {
    if (!validRemoteEventId(replyingTo.id) || !validMatrixId(replyingTo.sender) ||
        typeof replyingTo.body !== "string") {
      throw new Error("Cannot reply to an invalid event.");
    }
    // A malicious homeserver can attach a huge source body. Never let the
    // plaintext fallback quote evade the 4,000-character user input gate.
    const quoted = replyingTo.body.slice(0, 512).replace(/\r\n/g, "\n").split("\n").slice(0, 10)
      .map(line => "> " + line).join("\n");
    const fallback = "> <" + replyingTo.sender + "> " + quoted.replace(/^> /, "") + "\n\n" + body;
    await client.sendMessage(roomId, {
      msgtype: MsgType.Text,
      body: fallback,
      "m.relates_to": { "m.in_reply_to": { event_id: replyingTo.id } },
    });
  } else {
    await client.sendTextMessage(roomId, body);
  }
}

export async function reactEncrypted(
  client: MatrixClient, roomId: string, eventId: string, emoji: string,
): Promise<void> {
  if (!validRemoteEventId(eventId) || !["👍", "❤️", "🎉"].includes(emoji)) {
    throw new Error("Unsupported reaction.");
  }
  await requireEncryptedRoom(client, roomId);
  await client.sendEvent(roomId, EventType.Reaction, {
    "m.relates_to": { rel_type: RelationType.Annotation, event_id: eventId, key: emoji },
  });
}

/** Log no passwords, access tokens, or raw server payloads into the user interface. */
export function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safeMessages = new Set([
    "Use a unique 20–1024 character encryption passphrase without control characters.",
    "Persistent devices require a full Matrix ID (@user:server).",
    "Secure browser cryptography is unavailable.",
    "Local encrypted crypto storage requires IndexedDB enumeration and Web Locks.",
    "Encrypted device database is missing. Existing device keys cannot be safely restored.",
    "Unrecognized encrypted device data found. Login is blocked to protect existing keys.",
    "Saved device metadata is corrupted.",
    "Saved device metadata is invalid.",
    "Web Locks API required for encrypted local device storage.",
    "This encrypted device is already open in another tab.",
    "The homeserver returned a different device identity.",
    "Cannot persist an invalid Matrix device ID.",
    "Sending is disabled unless the room is joined.",
    "Cryptographic room state is unavailable. Message was not sent.",
    "Messages must contain 1–4,000 characters.",
    "Unsupported reaction.",
    "Cannot reply to an invalid event.",
    "Enter a valid Matrix user ID.",
    "Room name must be 1–90 characters.",
    "Type ERASE to confirm irreversible local device deletion.",
    "IndexedDB enumeration is required to erase this device safely.",
    "Encrypted browser data could not be erased.",
    "Close all other Messenger tabs before erasing this device.",
    "No stored encrypted device was found for this account.",
    "Encrypted browser data deletion could not be confirmed.",
  ]);
  // Exact matching only. A malicious/untrusted server error could begin
  // with a familiar prefix and append secrets, URLs, or user identifiers.
  // Never forward arbitrary SDK error suffixes into the visible UI.
  if (safeMessages.has(message)) return message;
  return "Operation failed. Check your connection, homeserver permissions and room state.";
}
