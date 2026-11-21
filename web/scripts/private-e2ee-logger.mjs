/**
 * Zero-payload logger for disposable E2EE smoke tests.
 *
 * Matrix SDK log messages sometimes contain room IDs, device curve keys,
 * encrypted session identifiers or homeserver response details. The smoke
 * harness only needs fixed stage/result markers; it does not forward raw SDK
 * logs into public GitHub Actions, even for ephemeral synthetic accounts.
 */
const ignore = () => {};
export const privateE2EELogger = Object.freeze({
  trace: ignore,
  debug: ignore,
  info: ignore,
  warn: ignore,
  error: ignore,
  getChild() { return this; },
});
