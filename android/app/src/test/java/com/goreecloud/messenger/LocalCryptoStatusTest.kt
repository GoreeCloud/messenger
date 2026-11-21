package com.goreecloud.messenger

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.matrix.rustcomponents.sdk.BackupState
import org.matrix.rustcomponents.sdk.RecoveryState
import org.matrix.rustcomponents.sdk.VerificationState

class LocalCryptoStatusTest {
    @Test fun unknownAndDisabledStatesAreLabeledWithoutTrustClaims() {
        val status = LocalCryptoStatus(
            VerificationState.UNKNOWN, RecoveryState.DISABLED, BackupState.UNKNOWN,
        )
        val label = status.display()
        assertTrue(label.contains("identity: UNKNOWN"))
        assertTrue(label.contains("recovery: DISABLED"))
        assertTrue(label.contains("backup: UNKNOWN"))
        assertFalse(label.contains("protected"))
        assertFalse(label.contains("safe"))
    }

    @Test fun evenSdkVerifiedAndBackupEnabledAreNotPresentedAsRestoreGuarantees() {
        val status = LocalCryptoStatus(
            VerificationState.VERIFIED, RecoveryState.ENABLED, BackupState.ENABLED,
        )
        assertTrue(status.display().contains("SDK account identity: VERIFIED"))
        assertFalse(status.display().contains("trusted recipients"))
        assertFalse(status.display().contains("restorable"))
        assertTrue(LocalCryptoStatus.disclaimer.contains("not been tested"))
        assertTrue(LocalCryptoStatus.disclaimer.contains("Other people's devices"))
    }

    @Test fun everySdkEnumValueIsRenderedWithoutExternalMaterialOrExceptions() {
        for (identity in VerificationState.entries) {
            for (recovery in RecoveryState.entries) {
                for (backup in BackupState.entries) {
                    val label = LocalCryptoStatus(identity, recovery, backup).display()
                    assertTrue(label.contains(identity.name))
                    assertTrue(label.contains(recovery.name))
                    assertTrue(label.contains(backup.name))
                    assertFalse(label.contains("token"))
                    assertFalse(label.contains("secret"))
                }
            }
        }
    }
}
