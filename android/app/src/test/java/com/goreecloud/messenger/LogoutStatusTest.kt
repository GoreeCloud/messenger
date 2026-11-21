package com.goreecloud.messenger

import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class LogoutStatusTest {
    @Test fun successfulRemoteRevocationStillErasesLocalDevice() = runBlocking {
        var erased = 0
        val confirmed = revokeAndForget(
            revoke = { },
            forget = { erased++ },
        )
        assertTrue(confirmed)
        assertEquals(1, erased)
    }

    @Test fun failedNetworkRevocationReportsUnknownButErasesLocally() = runBlocking {
        var erased = 0
        val confirmed = revokeAndForget(
            revoke = { throw IllegalStateException("untrusted SDK error") },
            forget = { erased++ },
        )
        assertFalse(confirmed)
        assertEquals(1, erased)
    }

    @Test fun unreachableServerTimesOutYetErasesLocalKeys() = runBlocking {
        var erased = 0
        val confirmed = revokeAndForget(
            revoke = { delay(10_000) },
            forget = { erased++ },
            revokeTimeoutMs = 20,
        )
        assertFalse(confirmed)
        assertEquals(1, erased)
    }

    @Test fun callerCancellationStillExecutesConfirmedLocalErase() = runBlocking {
        var erased = 0
        val pending = launch {
            revokeAndForget(
                revoke = { awaitCancellation() },
                forget = { erased++ },
                revokeTimeoutMs = 30_000,
            )
        }
        delay(20)
        pending.cancelAndJoin()
        assertEquals(1, erased)
    }

    @Test fun failedLocalKeyDeletionIsNotMisreportedAsSuccess() = runBlocking {
        var threw = false
        try {
            revokeAndForget(
                revoke = { },
                forget = { throw IllegalStateException("failed erasure") },
            )
        } catch (_: IllegalStateException) {
            threw = true
        }
        assertTrue(threw)
    }
}
