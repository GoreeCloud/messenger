import test from "node:test";
import assert from "node:assert/strict";
import { planRoute, createCapabilities, formatSecurity } from "../src/protocols.mjs";
const caps = createCapabilities({
  DATA: { available: true, encrypted: true, cryptoVerified: true, verified: true },
  RCS: { available: true, verified: true },
  SMS: { available: true, verified: true },
  MMS: { available: true, verified: true }
});

test("synthetic verified secure DATA is preferred by default", () => {
  assert.deepEqual(planRoute({ capabilities: caps }), {
    status: "ready", protocol: "DATA", encrypted: true, cost: "internet-data"
  });
});
test("encrypted DATA flag alone is insufficient for secure route eligibility", () => {
  const c = createCapabilities({
    DATA: { available: true, encrypted: true, verified: true }
  });
  assert.equal(c.DATA.encrypted, false);
  assert.equal(planRoute({ capabilities: c }).status, "blocked");
});
test("falsely advertised SMS/MMS/RCS encryption is never treated as E2EE", () => {
  for (const protocol of ["SMS", "MMS", "RCS"]) {
    const c = createCapabilities({
      [protocol]: { available: true, verified: true, encrypted: true, cryptoVerified: true }
    });
    assert.equal(c[protocol].encrypted, false);
    assert.equal(planRoute({ requested: protocol, capabilities: c }).status, "blocked");
    const forged = { [protocol]: { available: true, verified: true,
      encrypted: true, cryptoVerified: true, cost: "carrier" } };
    assert.equal(planRoute({ requested: protocol, capabilities: forged }).status, "blocked");
  }
});
test("no silent downgrade even if fallback requested", () => {
  const c = createCapabilities({ SMS: { available: true, verified: true } });
  assert.equal(planRoute({ capabilities: c,
    policy: { preferred: ["DATA", "SMS"], requireEncryption: true, allowFallback: true } }).status, "blocked");
});
test("encryption downgrade requires confirmation", () => {
  const result = planRoute({ requested: "SMS", capabilities: caps,
    policy: { requireEncryption: false }, previous: { protocol: "DATA", encrypted: true } });
  assert.equal(result.status, "confirmation-required");
});
test("carrier availability must be verified", () => {
  const c = createCapabilities({ RCS: { available: true, verified: false } });
  assert.equal(planRoute({ requested: "RCS", capabilities: c,
    policy: { requireEncryption: false } }).status, "blocked");
});
test("explicit insecure carrier route remains selectable if permitted", () => {
  const result = planRoute({ requested: "SMS", capabilities: caps,
    policy: { requireEncryption: false } });
  assert.equal(result.protocol, "SMS");
  assert.equal(result.encrypted, false);
});
test("fallback must be enabled", () => {
  const c = createCapabilities({ SMS: { available: true, verified: true } });
  assert.equal(planRoute({ capabilities: c,
    policy: { preferred: ["DATA", "SMS"], requireEncryption: false, allowFallback: false } }).status, "blocked");
  assert.equal(planRoute({ capabilities: c,
    policy: { preferred: ["DATA", "SMS"], requireEncryption: false, allowFallback: true } }).protocol, "SMS");
});
test("unknown protocol fails closed", () => {
  assert.equal(planRoute({ requested: "FAX", capabilities: caps }).status, "blocked");
});
test("security badge requires explicit cryptographic verification", () => {
  assert.equal(formatSecurity("SMS", true), "Not end-to-end encrypted");
  assert.equal(formatSecurity("MMS", true), "Not end-to-end encrypted");
  assert.equal(formatSecurity("RCS", true), "Not end-to-end encrypted");
  assert.equal(formatSecurity("DATA", true), "Encryption reported · identity verification unavailable");
  assert.equal(formatSecurity("DATA", true, true), "E2EE reported by verified crypto adapter");
});
