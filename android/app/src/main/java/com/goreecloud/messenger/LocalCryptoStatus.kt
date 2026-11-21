package com.goreecloud.messenger

import org.matrix.rustcomponents.sdk.BackupState
import org.matrix.rustcomponents.sdk.RecoveryState
import org.matrix.rustcomponents.sdk.VerificationState

/**
 * Read-only status from the official Matrix Rust SDK. Neither enum is a
 * substitute for user-device trust, a verified key backup, or a restore test.
 * No recovery keys, device secrets, account tokens or event content are read.
 */
internal data class LocalCryptoStatus(
    val ownIdentity: VerificationState,
    val recovery: RecoveryState,
    val backup: BackupState,
) {
    fun display(): String =
        "SDK account identity: ${ownIdentity.name} · " +
            "recovery: ${recovery.name} · backup: ${backup.name}"

    companion object {
        const val disclaimer =
            "SDK state is advisory. Other people's devices have not been " +
                "verified here, and a working encrypted key restore has not been tested."
    }
}
