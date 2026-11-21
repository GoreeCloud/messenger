import type { MatrixEvent } from "matrix-js-sdk";

/**
 * A decrypted-looking event in an encrypted room is not necessarily E2EE.
 * Matrix servers may inject plaintext m.room.message/m.reaction envelopes.
 * The UI must not attribute such content to end-to-end cryptography.
 */
export const blockedPlaintext = "Blocked an unencrypted event in an encrypted room.";
export const undecryptable = "Encrypted message unavailable — check device keys.";
export const unsupportedMessage = "[Unsupported message]";

type WireEvent = Pick<MatrixEvent, "getWireType" | "isDecryptionFailure" | "getContent">;

/** For encrypted rooms, only raw m.room.encrypted wire events qualify. */
export function fromEncryptedEnvelope(event: WireEvent, roomEncrypted: boolean): boolean {
  return !roomEncrypted || event.getWireType() === "m.room.encrypted";
}

export function displayEventBody(event: WireEvent, roomEncrypted: boolean): string {
  if (!fromEncryptedEnvelope(event, roomEncrypted)) return blockedPlaintext;
  if (event.isDecryptionFailure()) return undecryptable;
  const body: unknown = event.getContent()?.body;
  if (typeof body !== "string") return unsupportedMessage;
  // Avoid rendering arbitrarily large attacker-supplied event text at once.
  if (body.length > 12_000) return body.slice(0, 12_000) + "… [Truncated]";
  return body;
}

export function canDisplayReaction(event: WireEvent, roomEncrypted: boolean): boolean {
  return fromEncryptedEnvelope(event, roomEncrypted) && !event.isDecryptionFailure();
}
