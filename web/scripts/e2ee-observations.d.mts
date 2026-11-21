/** Type surface for the framework-independent encrypted wire-event assertions. */
export interface WireEvent {
  getWireType?(): string;
  getType?(): string;
  getSender?(): string;
  getId?(): string | undefined;
  getContent?(): Record<string, unknown>;
  isDecryptionFailure?(): boolean;
}
export function observedEncryptedEvent(
  event: WireEvent | null | undefined, type: string, sender: string,
): boolean;
export function findEncryptedEvent<T extends WireEvent>(
  events: Iterable<T> | null | undefined,
  type: string,
  sender: string,
  matchContent: (content: Record<string, unknown>, event: T) => boolean,
): T | null;
export function isEncryptedReply(
  content: Record<string, unknown> | null | undefined,
  sourceEventId: string,
  replyText: string,
): boolean;
export function isEncryptedReaction(
  content: Record<string, unknown> | null | undefined,
  sourceEventId: string,
  emoji: string,
): boolean;
