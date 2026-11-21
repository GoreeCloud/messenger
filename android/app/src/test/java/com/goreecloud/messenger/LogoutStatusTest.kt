package com.goreecloud.messenger

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
