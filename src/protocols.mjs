/**
 * Transport routing is a pure policy decision. UI/network adapters MUST honor it.
 * "available" describes a verified usable transport; "encrypted" describes
 * independently verified E2EE for that specific recipient and session.
 */
export const PROTOCOLS = Object.freeze(["DATA", "RCS", "MMS", "SMS"]);
export const CELLULAR_PROTOCOLS = Object.freeze(["RCS", "MMS", "SMS"]);
export const DEFAULT_POLICY = Object.freeze({
  preferred: ["DATA", "RCS", "MMS", "SMS"],
  requireEncryption: true,
  allowFallback: false
});

export function createCapabilities(overrides = {}) {
  const result = {};
  for (const protocol of PROTOCOLS) {
    const input = overrides[protocol] || {};
    result[protocol] = {
      available: input.available === true,
      encrypted: input.encrypted === true,
      verified: input.verified === true,
      cost: protocol === "DATA" ? "internet-data" : "carrier"
    };
  }
  return result;
}

export function planRoute({ requested = "AUTO", capabilities, policy = DEFAULT_POLICY, previous = null } = {}) {
  if (!capabilities) throw new TypeError("capabilities are required");
  if (requested !== "AUTO" && !PROTOCOLS.includes(requested)) {
    return { status: "blocked", reason: "Unknown protocol; no transport was selected" };
  }
  const preferred = Array.isArray(policy.preferred)
    ? [...new Set(policy.preferred)].filter(p => PROTOCOLS.includes(p))
    : [...PROTOCOLS];
  const candidates = requested === "AUTO" ? preferred : [requested];
  const requireEncryption = policy.requireEncryption !== false;
  const allowFallback = policy.allowFallback === true;
  for (const protocol of candidates) {
    const c = capabilities[protocol];
    // "verified" requires live, per-recipient and per-session capability evidence.
    if (!c?.available || !c.verified) continue;
    if (requireEncryption && !c.encrypted) continue;
    if (requested === "AUTO" && protocol !== candidates[0] && !allowFallback) continue;
    // All changes away from a previously encrypted route need consent.
    if (previous?.encrypted === true && !c.encrypted) {
      return { status: "confirmation-required", protocol, encrypted: false, cost: c.cost,
        reason: "Changing from an encrypted transport requires explicit consent" };
    }
    return { status: "ready", protocol, encrypted: c.encrypted, cost: c.cost };
  }
  return { status: "blocked", reason: requireEncryption
    ? "No verified encrypted route is available. Nothing was sent."
    : "No verified supported route matches the current policy. Nothing was sent." };
}

export function formatSecurity(protocol, encrypted) {
  if (protocol === "LOCAL") return "On this device · not encrypted";
  if (!PROTOCOLS.includes(protocol)) return "Security unknown";
  if (encrypted === true && protocol === "DATA") return "E2EE verified by adapter";
  return "Not end-to-end encrypted";
}
