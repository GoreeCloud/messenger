package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InvitePolicyTest {
    private fun check(
        room: String = "!room:example.org",
        selected: String? = "!room:example.org",
        recipient: String = "@bob:example.org",
        encrypted: Boolean = true,
        joined: Boolean = true,
    ) = InvitePolicy.requireEncryptedInvitation(
        room, selected, recipient, encrypted, joined,
    )

    @Test fun permitsOnlyAnEncryptedJoinedSelectedRoom() {
        assertEquals("@bob:example.org", check())
        assertEquals("@bob:example.org", check(recipient = "  @bob:example.org  "))
    }

    @Test fun blocksUnencryptedOrLeftRooms() {
        assertThrows(IllegalArgumentException::class.java) { check(encrypted = false) }
        assertThrows(IllegalArgumentException::class.java) { check(joined = false) }
    }

    @Test fun blocksStaleOrMissingRoomSelection() {
        assertThrows(IllegalArgumentException::class.java) {
            check(selected = "!old:example.org")
        }
        assertThrows(IllegalArgumentException::class.java) { check(selected = null) }
        assertThrows(IllegalArgumentException::class.java) { check(room = "") }
    }

    @Test fun rejectsMalformedRemoteMatrixIDsAndControls() {
        for (id in listOf(
            "", "bob@example.org", "@bob", "@:example.org",
            "@bob:example.org\nInjected", "@bob:example.org\u0000",
            "@bob:example.org\t", "@bob:" + "x".repeat(300),
        )) {
            assertThrows(IllegalArgumentException::class.java) { check(recipient = id) }
        }
    }

    @Test fun supportsCaseSensitiveMatrixLocalpartWithoutRewriting() {
        assertEquals("@Alice:example.org", check(recipient = "@Alice:example.org"))
    }
}
