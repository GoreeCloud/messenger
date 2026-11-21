import type { MatrixClient } from "matrix-js-sdk";

/**
 * A read-only snapshot of current device SDK state, not a key/identity audit.
 * No cryptographic keys, event content, device IDs, version IDs or secrets
 * are returned. Do not conflate this with verified peer devices or recovery.
 */
export interface BrowserCryptoReadiness {
  publicSigningKeysAvailable: boolean;
  privateSigningKeysCached: boolean;
  signingKeysInSecretStorage: boolean;
  automaticBackupEnabled: boolean;
}

export const cryptoReadinessDisclaimer =
  "SDK state is advisory. Other people's devices are not verified here. " +
  "An active key backup is not proof that encrypted history can be restored.";

export async function inspectBrowserCryptoReadiness(
  client: Pick<MatrixClient, "getCrypto">,
): Promise<BrowserCryptoReadiness> {
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("Local crypto SDK status is unavailable.");

  // Read-only SDK methods. Do not call bootstrapCrossSigning,
  // checkKeyBackupAndEnable, restoreKeyBackup or key export APIs.
  const [signing, activeVersion] = await Promise.all([
    crypto.getCrossSigningStatus(),
    crypto.getActiveSessionBackupVersion(),
  ]);

  return {
    publicSigningKeysAvailable: signing.publicKeysOnDevice === true,
    privateSigningKeysCached:
      signing.privateKeysCachedLocally.masterKey === true &&
      signing.privateKeysCachedLocally.selfSigningKey === true &&
      signing.privateKeysCachedLocally.userSigningKey === true,
    signingKeysInSecretStorage: signing.privateKeysInSecretStorage === true,
    automaticBackupEnabled: activeVersion !== null,
  };
}

export function cryptoReadinessSummary(status: BrowserCryptoReadiness): string {
  const indicator = (enabled: boolean): string => enabled ? "yes" : "no";
  return [
    "SDK public signing keys: " + indicator(status.publicSigningKeysAvailable),
    "all local private signing keys cached: " + indicator(status.privateSigningKeysCached),
    "SDK secret storage contains signing keys: " + indicator(status.signingKeysInSecretStorage),
    "automatic backup active: " + indicator(status.automaticBackupEnabled),
  ].join(" · ");
}
