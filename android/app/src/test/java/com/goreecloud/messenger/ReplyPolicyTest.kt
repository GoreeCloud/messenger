package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ReplyPolicyTest {
    private fun check(
        room: String = "!room:server.test",
        selected: String? = "!room:server.test",
        event: String = "\$event:server.test",
        text: String = " Hello, encrypted reply ",
        encrypted: Boolean = true,
        joined: Boolean = true,
    ) = ReplyPolicy.requireEncryptedReply(
        room, selected, event, text, encrypted, joined
    )

    @Test fun trimsBodyOnlyForJoinedEncryptedRoom() {
        assertEquals("Hello, encrypted reply", check())
    }

    @Test fun refusesPlaintextAndLeftRooms() {
        assertThrows(IllegalArgumentException::class.java) { check(encrypted = false) }
        assertThrows(IllegalArgumentException::class.java) { check(joined = false) }
    }

    @Test fun refusesStaleOrMissingTimelineSelection() {
        assertThrows(IllegalArgumentException::class.java) { check(selected = null) }
        assertThrows(IllegalArgumentException::class.java) { check(selected = "!other:server.test") }
    }

    @Test fun refusesLocalTransactionAndMalformedIds() {
        assertThrows(IllegalArgumentException::class.java) { check(event = "transaction:1") }
        assertThrows(IllegalArgumentException::class.java) { check(event = "\$") }
        assertThrows(IllegalArgumentException::class.java) { check(event = "\$foo\nbar") }
    }

    @Test fun refusesBlankAndUnboundedBody() {
        assertThrows(IllegalArgumentException::class.java) { check(text = "   ") }
        assertThrows(IllegalArgumentException::class.java) { check(text = "x".repeat(70_000)) }
    }
}
