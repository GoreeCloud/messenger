import { EventType, MatrixClient, MsgType, RelationType } from "matrix-js-sdk";

/** Never rely on a decorative padlock or a stale room-list flag for send authorization. */
export async function requireEncryptedRoom(client: MatrixClient, roomId: string): Promise<void> {
  if (!roomId || !client.getRoom(roomId) || !client.isRoomEncrypted(roomId)) {
    throw new Error("Sending is disabled unless room encryption is confirmed.");
  }
  const crypto = client.getCrypto();
  if (!crypto || !(await crypto.isEncryptionEnabledInRoom(roomId))) {
    throw new Error("Cryptographic room state is unavailable. Message was not sent.");
  }
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
    if (!replyingTo.id.startsWith("$") || replyingTo.sender.length > 255) {
      throw new Error("Cannot reply to an invalid event.");
    }
    const quoted = replyingTo.body.replace(/\r\n/g, "\n").split("\n").slice(0, 10)
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
  if (!eventId.startsWith("$") || !["👍", "❤️", "🎉"].includes(emoji)) {
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
  if (message.startsWith("Sending is disabled") || message.startsWith("Cryptographic room") ||
      message.startsWith("Messages must") || message.startsWith("Unsupported reaction") ||
      message.startsWith("Cannot reply")) return message;
  return "Operation failed. Check your connection, homeserver permissions and room state.";
}
