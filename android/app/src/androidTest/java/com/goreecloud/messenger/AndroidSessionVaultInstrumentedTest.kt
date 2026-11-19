package com.goreecloud.messenger

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.matrix.rustcomponents.sdk.Session
import org.matrix.rustcomponents.sdk.SlidingSyncVersion
import java.io.File

/**
 * Test-only Keystore slot, separate from any user's app data.
 * No network, server credentials, Matrix messages or personal files are used.
 */
@RunWith(AndroidJUnit4::class)
class AndroidSessionVaultInstrumentedTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private fun vault() = AndroidSessionVault(context, testSlot = true)
    private fun root() = File(context.noBackupFilesDir, "matrix-rust-instrumentation")

    @Before fun clearBefore() { vault().forget() }
    @After fun clearAfter() { vault().forget() }

    @Test fun keystoreWrappedSqliteKeySurvivesVaultRecreation() {
        val first = vault().storeKey()
        assertEquals(32, first.size)
        val reloaded = vault().storeKey()
        assertArrayEquals(first, reloaded)
        val encoded = File(root(), "store-key.enc").readBytes()
        assertFalse(encoded.contentEquals(first))
        assertEquals(1, encoded[0].toInt())
        first.fill(0)
        reloaded.fill(0)
    }

    @Test fun encryptedSessionSurvivesRestartAndDoesNotContainTokenInFile() {
        val first = vault()
        first.storeKey().fill(0)
        val fakeToken = "fake-test-access-token-should-not-be-plaintext"
        first.saveSession(Session(
            accessToken = fakeToken,
            refreshToken = null,
            userId = "@synthetic:test.invalid",
            deviceId = "INSTRUMENTATION123",
            homeserverUrl = "https://matrix.test.invalid",
            oauthData = null,
            slidingSyncVersion = SlidingSyncVersion.NONE,
        ))
        val bytes = File(root(), "session.enc").readBytes()
        assertFalse(String(bytes, Charsets.ISO_8859_1).contains(fakeToken))
        val reloaded = vault().readSession()
        assertEquals(fakeToken, reloaded?.accessToken)
        assertEquals("@synthetic:test.invalid", reloaded?.userId)
        assertEquals("INSTRUMENTATION123", reloaded?.deviceId)
    }

    @Test fun corruptedCiphertextNeverCreatesReplacementKey() {
        val instance = vault()
        instance.storeKey().fill(0)
        val filename = File(root(), "store-key.enc")
        val original = filename.readBytes()
        filename.writeBytes(original.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() })
        assertThrows(Exception::class.java) { vault().storeKey() }
        assertTrue(filename.exists())
    }

    @Test fun deletingLocalDeviceRemovesKeyAndEncryptedSession() {
        val instance = vault()
        instance.storeKey().fill(0)
        assertTrue(root().isDirectory)
        instance.forget()
        assertFalse(root().exists())
        assertFalse(vault().hasSession())
    }
}
