/** Accept TLS URLs only; allow unencrypted loopback solely for local development. */
export function normalizeHomeserver(raw: string): string {
  const url = new URL(raw.trim());
  if (url.username || url.password || url.search || url.hash) throw new Error("Use the homeserver origin only.");
  if (url.pathname !== "/") throw new Error("Use the homeserver origin, without a path.");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("A TLS (https://) homeserver is required, except on localhost.");
  }
  return url.origin;
}
export function validMatrixId(value: string): boolean {
  return value.length >= 4 && value.length <= 255 &&
    /^@[^:\s]+:[^:\s]+$/.test(value) &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}
