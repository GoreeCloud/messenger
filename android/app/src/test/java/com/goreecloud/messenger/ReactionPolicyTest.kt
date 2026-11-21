package com.goreecloud.messenger

import org.junit.Assert.assertThrows
import org.junit.Test

class ReactionPolicyTest {
    private fun check(
        room: String = "!room:server.test",
        selected: String? = "!room:server.test",
        event: String = "\$event:server.test",
        emoji: String = "👍",
        encrypted: Boolean = true,
        joined: Boolean = true,
    ) = ReactionPolicy.requireEncryptedReaction(
        room, selected, event, emoji, encrypted, joined
    )

    @Test fun permitsKnownEmojiOnSelectedJoinedEncryptedRoom() {
        ReactionPolicy.supportedEmoji.forEach { check(emoji = it) }
    }

    @Test fun refusesEvenValidSelectedEncryptedRoomReactionsUntilSdkEncryptsThem() {
        for (emoji in ReactionPolicy.supportedEmoji) {
            check(emoji = emoji)
            val failure = assertThrows(UnsupportedOperationException::class.java) {
                ReactionPolicy.refusePlaintextReactionTransport()
            }
            org.junit.Assert.assertTrue(
                failure.message?.contains("unavailable with this Matrix SDK") == true
            )
        }
    }

    @Test fun blocksPlaintextOrDepartedRooms() {
        assertThrows(IllegalArgumentException::class.java) { check(encrypted = false) }
        assertThrows(IllegalArgumentException::class.java) { check(joined = false) }
    }

    @Test fun blocksStaleRoomSelection() {
        assertThrows(IllegalArgumentException::class.java) { check(selected = "!other:server.test") }
        assertThrows(IllegalArgumentException::class.java) { check(selected = null) }
    }

    @Test fun blocksUnsentAndMalformedEvents() {
        assertThrows(IllegalArgumentException::class.java) { check(event = "transaction") }
        assertThrows(IllegalArgumentException::class.java) { check(event = "\$") }
        assertThrows(IllegalArgumentException::class.java) { check(event = "\$bad\nid") }
    }

    @Test fun blocksArbitraryEmojiOrUnsupportedReactions() {
        assertThrows(IllegalArgumentException::class.java) { check(emoji = "🔥") }
        assertThrows(IllegalArgumentException::class.java) { check(emoji = "") }
    }
}
