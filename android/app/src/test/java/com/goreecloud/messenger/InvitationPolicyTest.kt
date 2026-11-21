package com.goreecloud.messenger

import org.matrix.rustcomponents.sdk.Membership
import org.junit.Assert.assertThrows
import org.junit.Test

/** No FFI network calls, no user account mutation. */
class InvitationPolicyTest {
    @Test fun acceptsOnlyMatchingPendingRoom() {
        requirePendingRoomInvitation("!test:server", "!test:server", Membership.INVITED)
    }

    @Test fun rejectsJoinedOrLeftRooms() {
        for (state in listOf(Membership.JOINED, Membership.LEFT, Membership.BANNED)) {
            assertThrows(IllegalArgumentException::class.java) {
                requirePendingRoomInvitation("!test:server", "!test:server", state)
            }
        }
    }

    @Test fun refusesWrongOrEmptyRoomIdBeforeMutation() {
        assertThrows(IllegalArgumentException::class.java) {
            requirePendingRoomInvitation("!requested:server", "!other:server", Membership.INVITED)
        }
        assertThrows(IllegalArgumentException::class.java) {
            requirePendingRoomInvitation("", "", Membership.INVITED)
        }
    }
}
