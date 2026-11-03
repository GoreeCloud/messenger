/**
 * Merge a bounded Matrix timeline with unconfirmed local sends.
 * Never infer delivery from matching text/timestamps: only a server event ID
 * returned by the send response can reconcile a local optimistic message.
 * No content is persisted.
 */
export function reconcileTimeline(existing = [], received = [], { limit = 120 } = {}) {
  if (!Array.isArray(existing) || !Array.isArray(received)) {
    throw new TypeError('Timelines must be arrays');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new RangeError('Timeline limit must be an integer between 1 and 1000');
  }

  // The server result is trusted for its own event identity but not for HTML.
  // Rendering must still use textContent for all message content.
  const serverById = new Map();
  for (const entry of received) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.text !== 'string') continue;
    serverById.set(entry.id, entry);
  }
  const localByEvent = new Map();
  for (const entry of existing) {
    if (entry?.own === true && typeof entry.eventId === 'string' && entry.eventId) {
      localByEvent.set(entry.eventId, entry);
    }
  }

  const merged = [];
  for (const event of serverById.values()) {
    const local = localByEvent.get(event.id);
    merged.push(local ? { ...event, id: local.id, eventId: event.id,
      own: true, delivery: 'Confirmed by sync', error: false } : event);
  }

  // Keep optimistic sends even when a bounded /messages page doesn't include
  // their event IDs. The user must not lose a failed/uncertain retry action.
  for (const entry of existing) {
    if (entry?.own !== true || typeof entry.id !== 'string' || !entry.id ||
      typeof entry.delivery !== 'string') continue;
    if (entry.eventId && serverById.has(entry.eventId)) continue;
    if (serverById.has(entry.id)) continue;
    merged.push(entry);
  }

  merged.sort((a, b) => {
    const at = Number.isFinite(a.timestamp) ? a.timestamp : 0;
    const bt = Number.isFinite(b.timestamp) ? b.timestamp : 0;
    return at - bt;
  });

  if (merged.length <= limit) return merged;
  // Prefer preserving pending/uncertain local sends over historic server events.
  const local = merged.filter(m => m.own === true && typeof m.delivery === 'string' &&
    m.delivery !== 'Confirmed by sync');
  const retained = new Set(local.slice(-limit));
  for (let i = merged.length - 1; i >= 0 && retained.size < limit; i--) {
    retained.add(merged[i]);
  }
  return merged.filter(m => retained.has(m));
}
