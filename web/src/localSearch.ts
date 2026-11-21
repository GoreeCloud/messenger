/** Device-memory-only filtering of messages already loaded by the Matrix SDK. */
export function filterLoadedMessages<T extends { body: string; sender: string }>(
  messages: readonly T[], rawQuery: string,
): T[] {
  const term = rawQuery.trim().toLowerCase();
  if (term.length > 128) throw new Error("Local search is limited to 128 characters.");
  if (!term) return [...messages];
  return messages.filter(message =>
    message.body.toLowerCase().includes(term) || message.sender.toLowerCase().includes(term),
  );
}
