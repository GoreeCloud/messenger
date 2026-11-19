package com.goreecloud.messenger

/**
 * Pure safety checks for replying to a confirmed remote event using
 * the Rust SDK; never synthesize a plaintext Matrix relation.
 */
internal object ReplyPolicy {
    fun requireEncryptedReply(
        roomId: String,
        selectedRoomId: String?,
        eventId: String,
        body: String,
        encrypted: Boolean,
        joined: Boolean,
    ): String {
        require(roomId.isNotBlank() && selectedRoomId == roomId && joined && encrypted) {
            "Encrypted replies require the selected joined encrypted room."
        }
        require(eventId.length in 2..255 && eventId.startsWith('$') &&
            eventId.none { it.isWhitespace() || it.isISOControl() }) {
            "Replies require a confirmed remote Matrix event ID."
        }
        return MessagePolicy.requireEncryptedMessage(body, encrypted)
    }
}
