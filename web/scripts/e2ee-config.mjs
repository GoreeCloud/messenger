/** No credentials, session tokens, or message bodies in output. */
export const requiredNames = [
  "MATRIX_TEST_HOMESERVER", "MATRIX_TEST_A_ID", "MATRIX_TEST_A_PASSWORD",
  "MATRIX_TEST_B_ID", "MATRIX_TEST_B_PASSWORD",
  "MATRIX_TEST_DISPOSABLE_ACK",
];
export function readTestEnvironment(env) {
  const missing = requiredNames.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error("Missing isolated test configuration: " + missing.join(", "));
  if (env.MATRIX_TEST_DISPOSABLE_ACK !== "YES") {
    throw new Error("Running a mutating E2EE smoke test requires explicit disposable-account acknowledgement.");
  }
  let base;
  try { base = new URL(env.MATRIX_TEST_HOMESERVER); }
  catch { throw new Error("Invalid test homeserver URL."); }
  if (base.protocol !== "https:" || base.username || base.password || base.search ||
      base.hash || base.pathname !== "/") {
    throw new Error("Test homeserver must be an HTTPS origin without credentials, path or query.");
  }
  const idRe = /^@[^:\s]+:[^:\s]+$/;
  const a = env.MATRIX_TEST_A_ID.trim();
  const b = env.MATRIX_TEST_B_ID.trim();
  if (!idRe.test(a) || !idRe.test(b) || a === b) {
    throw new Error("Provide two distinct valid test Matrix user IDs.");
  }
  const timeoutMs = Number(env.MATRIX_TEST_TIMEOUT_MS || "90000");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 2000 || timeoutMs > 300000) {
    throw new Error("Test timeout must be between 2000 and 300000 ms.");
  }
  return {
    homeserver: base.origin, a, aPassword: env.MATRIX_TEST_A_PASSWORD,
    b, bPassword: env.MATRIX_TEST_B_PASSWORD, timeoutMs,
  };
}
