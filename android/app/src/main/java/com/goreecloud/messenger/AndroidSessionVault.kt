package com.goreecloud.messenger

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONObject
import org.matrix.rustcomponents.sdk.Session
import org.matrix.rustcomponents.sdk.SlidingSyncVersion
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Single-account encrypted local vault, scoped to app-private, non-backed-up files.
 *
 * The Rust SDK SQLite store is encrypted with a random 256-bit key.
 * The SQLite key and Matrix session tokens are separately wrapped using a
 * non-exportable Android Keystore AES-GCM key. No token or store key is saved
 * as plaintext, nor copied into Android backup.
 *
 * Threat limits: no biometric authentication, no remote/SSSS key backup,
 * no guarantee of hardware-backed Keystore, and no protection against a
 * compromised unlocked process. This is not a complete secure messenger.
 */
internal class AndroidSessionVault(context: Context, testSlot: Boolean = false) {
    private val directory = File(
        context.noBackupFilesDir, if (testSlot) "matrix-rust-instrumentation" else "matrix-rust-v1"
    )
    private val storeKeyFile = AtomicFile(File(directory, "store-key.enc"))
    private val sessionFile = AtomicFile(File(directory, "session.enc"))

    private val alias = "com.goreecloud.messenger.local-store.v1" +
        if (testSlot) ".instrumentation" else ""
    private val marker: Byte = 1
    private val maxFileSize = 16_384L
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    val dataPath: String get() = File(directory, "data").absolutePath
    val cachePath: String get() = File(directory, "cache").absolutePath

    fun hasSession(): Boolean = sessionFile.baseFile.isFile

    private fun ensureDirectory() {
        require(directory.isDirectory || directory.mkdirs()) { "Cannot prepare private storage." }
        require(File(dataPath).isDirectory || File(dataPath).mkdirs()) { "Cannot prepare private storage." }
        require(File(cachePath).isDirectory || File(cachePath).mkdirs()) { "Cannot prepare private storage." }
    }

    private fun keystoreKey(): SecretKey {
        val existing = keyStore.getKey(alias, null)
        if (existing is SecretKey) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun seal(purpose: String, plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, keystoreKey())
        cipher.updateAAD(("goreecloud.messenger.v1|" + purpose).toByteArray(Charsets.UTF_8))
        val encrypted = cipher.doFinal(plaintext)
        val iv = cipher.iv
        require(iv.size == 12) { "Unexpected encryption nonce length." }
        return byteArrayOf(marker) + iv + encrypted
    }

    private fun unseal(purpose: String, ciphertext: ByteArray): ByteArray {
        require(ciphertext.size in 30..maxFileSize.toInt() && ciphertext[0] == marker) {
            "Invalid local vault format."
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE, keystoreKey(),
            GCMParameterSpec(128, ciphertext.copyOfRange(1, 13))
        )
        cipher.updateAAD(("goreecloud.messenger.v1|" + purpose).toByteArray(Charsets.UTF_8))
        return cipher.doFinal(ciphertext.copyOfRange(13, ciphertext.size))
    }

    private fun write(file: AtomicFile, bytes: ByteArray) {
        require(bytes.size <= maxFileSize) { "Vault record exceeds the allowed size." }
        val stream = file.startWrite()
        try {
            stream.write(bytes)
            file.finishWrite(stream)
        } catch (failure: Exception) {
            file.failWrite(stream)
            throw failure
        }
    }

    private fun read(file: AtomicFile): ByteArray {
        require(file.baseFile.length() in 1..maxFileSize) { "Invalid encrypted vault record." }
        return file.openRead().use { it.readBytes() }
    }

    /**
     * Calling this creates a key only on first use. A broken existing key is
     * NEVER silently replaced; doing so could erase access to encrypted data.
     */
    fun storeKey(): ByteArray {
        ensureDirectory()
        if (storeKeyFile.baseFile.exists()) {
            require(keyStore.containsAlias(alias)) { "Keystore key missing for existing encrypted data." }
            val key = unseal("sqlite-key", read(storeKeyFile))
            require(key.size == 32) { "Invalid SQLite encryption key." }
            return key
        }
        // An orphaned data directory might contain keys we cannot recover.
        if (File(dataPath).listFiles()?.isNotEmpty() == true) {
            throw IllegalStateException("Existing encrypted data requires its original key.")
        }
        val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
        try {
            write(storeKeyFile, seal("sqlite-key", key))
            return key
        } catch (failure: Exception) {
            key.fill(0)
            throw failure
        }
    }

    fun saveSession(session: Session) {
        ensureDirectory()
        val safeServer = HomeserverPolicy.requireHttpsOrigin(session.homeserverUrl)
        require(safeServer == session.homeserverUrl.trimEnd('/')) { "Unexpected session homeserver." }
        require(MatrixSessionPolicy.isValidSession(
            session.userId, session.deviceId, session.accessToken
        )) { "Invalid session fields." }
        val json = JSONObject().apply {
            put("v", 1)
            put("accessToken", session.accessToken)
            put("refreshToken", session.refreshToken)
            put("userId", session.userId)
            put("deviceId", session.deviceId)
            put("homeserverUrl", safeServer)
            put("oauthData", session.oauthData)
            put("slidingSyncVersion", session.slidingSyncVersion.name)
        }
        val payload = json.toString().toByteArray(Charsets.UTF_8)
        try { write(sessionFile, seal("session", payload)) }
        finally { payload.fill(0) }
    }

    fun readSession(): Session? {
        if (!hasSession()) return null
        val plaintext = unseal("session", read(sessionFile))
        try {
            val json = JSONObject(String(plaintext, Charsets.UTF_8))
            require(json.getInt("v") == 1) { "Unsupported local session version." }
            val accessToken = json.getString("accessToken")
            val userId = json.getString("userId")
            val deviceId = json.getString("deviceId")
            val origin = HomeserverPolicy.requireHttpsOrigin(json.getString("homeserverUrl"))
            require(MatrixSessionPolicy.isValidSession(userId, deviceId, accessToken)) {
                "Stored session is invalid."
            }
            fun optional(field: String): String? =
                if (json.isNull(field) || !json.has(field)) null else json.getString(field)
            return Session(
                accessToken = accessToken,
                refreshToken = optional("refreshToken"),
                userId = userId,
                deviceId = deviceId,
                homeserverUrl = origin,
                oauthData = optional("oauthData"),
                slidingSyncVersion = SlidingSyncVersion.valueOf(json.getString("slidingSyncVersion")),
            )
        } finally { plaintext.fill(0) }
    }

    /** Explicit destructive sign-out; session and SQLCipher keys become unavailable. */
    fun forget() {
        // Delete the non-exportable key first: any failed file removal remains encrypted
        // and cannot be unlocked again. Never log session file contents.
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
        require(!directory.exists() || directory.deleteRecursively()) {
            "Unable to clear all local encrypted data."
        }
    }
}
