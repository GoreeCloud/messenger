package com.goreecloud.messenger

/**
 * Small, deterministic send policy to keep reaction controls aligned with
 * encrypted-message fail-closed behavior, including on stale UI callbacks.
 */
internal object ReactionPolicy {
    val supportedEmoji = listOf("👍", "❤️", "🎉")

    fun requireEncryptedReaction(
        roomId: String,
        selectedRoomId: String?,
        eventId: String,
        emoji: String,
        encrypted: Boolean,
        joined: Boolean,
    ) {
        require(roomId.isNotBlank() && selectedRoomId == roomId && encrypted && joined) {
            "Reactions are available only in the selected joined encrypted room."
        }
        require(eventId.length in 2..255 && eventId[0] == '$' &&
            eventId.none { it.isWhitespace() || it.isISOControl() }) {
            "Cannot react to an invalid remote event."
        }
        require(emoji in supportedEmoji) { "Unsupported reaction." }
    }
}
