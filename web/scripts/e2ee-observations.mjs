/**
 * A decrypted room-message type does NOT prove the homeserver transmitted
 * ciphertext. Accept only Matrix events with encrypted raw wire envelopes.
 * This helper has no credentials, network calls or SDK state.
 */
export function observedEncryptedEvent(event, type, sender) {
  return Boolean(event && event.getWireType?.() === "m.room.encrypted" &&
    event.getType?.() === type &&
    event.getSender?.() === sender &&
    !event.isDecryptionFailure?.() &&
    typeof event.getId?.() === "string" && event.getId().startsWith("$"));
}

export function findEncryptedEvent(events, type, sender, matchContent) {
  for (const event of events || []) {
    if (!observedEncryptedEvent(event, type, sender)) continue;
    const content = event.getContent?.();
    if (!content || typeof content !== "object") continue;
    if (matchContent(content, event)) return event;
  }
  return null;
}

export function isEncryptedReply(content, sourceEventId, replyText) {
  return Boolean(content && typeof content.body === "string" &&
    content.body.endsWith(replyText) &&
    content["m.relates_to"]?.["m.in_reply_to"]?.event_id === sourceEventId);
}

export function isEncryptedReaction(content, sourceEventId, emoji) {
  const relation = content?.["m.relates_to"];
  return relation?.rel_type === "m.annotation" &&
    relation.event_id === sourceEventId && relation.key === emoji;
}
