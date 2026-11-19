package com.goreecloud.messenger

/**
 * UI policy gate. The Matrix Rust SDK performs the actual encryption.
 * We refuse to generate any message for a room without encryption.
 */
object MessagePolicy {
    fun requireEncryptedMessage(raw: String, isEncrypted: Boolean): String {
        require(isEncrypted) { "This room is not encrypted; sending is blocked." }
        val body = raw.trim()
        require(body.isNotEmpty() && body.length <= 4000) { "Messages must contain 1–4,000 characters." }
        return body
    }
}
