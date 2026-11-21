package com.goreecloud.messenger

/**
 * Reject stale, unauthenticated invitation mutations before invoking the
 * Matrix Rust SDK. No invitations are sent from read-only/unencrypted rooms.
 */
internal object InvitePolicy {
    private val fullId = Regex("^@[^:\\s]+:[^:\\s]+$")

    fun requireEncryptedInvitation(
        roomId: String,
        selectedRoomId: String?,
        rawRecipient: String,
        encrypted: Boolean,
        joined: Boolean,
    ): String {
        require(roomId.isNotBlank() && selectedRoomId == roomId && encrypted && joined) {
            "Invitations require the selected joined encrypted room."
        }
        // Reject controls BEFORE trimming. Trimming a trailing tab/newline
        // would silently change a malicious Matrix identifier into a valid one.
        require(rawRecipient.none { it.isISOControl() }) {
            "Enter a valid Matrix user ID."
        }
        val recipient = rawRecipient.trim()
        require(recipient.length in 4..255 &&
            fullId.matches(recipient) &&
            recipient.none { it.isISOControl() || it.isWhitespace() }) {
            "Enter a valid Matrix user ID."
        }
        return recipient
    }
}
