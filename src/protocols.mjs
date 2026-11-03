/**
 * Pure transport policy. It cannot establish cryptographic trust by itself.
 * Capability flags MUST come from a trusted, live transport adapter after
 * per-recipient session checks. In this phase only DATA may be E2EE, and
 * only with an additional explicit cryptoVerified signal.
 */
export const PROTOCOLS = Object.freeze(["DATA", "RCS", "MMS", "SMS"]);
export const CELLULAR_PROTOCOLS = Object.freeze(["RCS", "MMS", "SMS"]);
export const DEFAULT_POLICY = Object.freeze({
  preferred: ["DATA", "RCS", "MMS", "SMS"],
  requireEncryption: true,
  allowFallback: false
});

function trustedEncryption(protocol, capability) {
  // Carrier transports are not cryptographically integrated. Even an upstream
  // "encrypted" flag must not make them eligible for a secure routing policy.
  return protocol === "DATA" &&
    capability?.encrypted === true && capability?.cryptoVerified === true;
}

export function createCapabilities(overrides = {}) {
  const result = {};
  for (const protocol of PROTOCOLS) {
    const input = overrides[protocol] || {};
    result[protocol] = {
      available: input.available === true,
      encrypted: trustedEncryption(protocol, input),
      cryptoVerified: protocol === "DATA" && input.cryptoVerified === true,
      verified: input.verified === true,
      cost: protocol === "DATA" ? "internet-data" : "carrier"
    };
  }
  return result;
}

export function planRoute({
  requested = "AUTO", capabilities, policy = DEFAULT_POLICY, previous = null
} = {}) {
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
    if (!c?.available || !c.verified) continue;
    const encrypted = trustedEncryption(protocol, c);
    if (requireEncryption && !encrypted) continue;
    if (requested === "AUTO" && protocol !== candidates[0] && !allowFallback) continue;
    if (previous?.encrypted === true && !encrypted) {
      return { status: "confirmation-required", protocol, encrypted: false, cost: c.cost,
        reason: "Changing from an encrypted transport requires explicit consent" };
    }
    return { status: "ready", protocol, encrypted, cost: c.cost };
  }
  return { status: "blocked", reason: requireEncryption
    ? "No verified encrypted route is available. Nothing was sent."
    : "No verified supported route matches the current policy. Nothing was sent." };
}

/**
 * A boolean "encrypted" signal without verified crypto evidence is never
 * sufficient to render an E2EE badge.
 */
export function formatSecurity(protocol, encrypted, cryptoVerified = false) {
  if (protocol === "LOCAL") return "On this device · not encrypted";
  if (!PROTOCOLS.includes(protocol)) return "Security unknown";
  if (protocol === "DATA" && encrypted === true) {
    return cryptoVerified === true
      ? "E2EE reported by verified crypto adapter"
      : "Encryption reported · identity verification unavailable";
  }
  return "Not end-to-end encrypted";
}
