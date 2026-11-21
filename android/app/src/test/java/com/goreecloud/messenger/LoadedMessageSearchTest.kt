package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class LoadedMessageSearchTest {
    private val loaded = listOf(
        TimelineEntry("one", "@alice:test", "Encrypted Hello", false, null, emptyList()),
        TimelineEntry("two", "@bob:test", "Backup history", false, null, emptyList()),
        TimelineEntry("three", "@alice:test", "Private chat", true, null, emptyList()),
    )

    @Test fun filtersOnlyAlreadyLoadedMessageBodies() {
        assertEquals(listOf("two"), filterLoadedTimeline(loaded, "backup").map { it.id })
    }

    @Test fun senderAndCaseInsensitiveMatchingStayLocal() {
        assertEquals(listOf("one", "three"), filterLoadedTimeline(loaded, "ALICE").map { it.id })
        assertEquals(listOf("one"), filterLoadedTimeline(loaded, "hello").map { it.id })
    }

    @Test fun emptyQueryPreservesExistingTimelineOrder() {
        assertEquals(loaded, filterLoadedTimeline(loaded, "   "))
        assertEquals(listOf("one", "two", "three"), loaded.map { it.id })
    }

    @Test fun unavailableHistoryIsNotFakedAsSearchResult() {
        assertEquals(emptyList<TimelineEntry>(), filterLoadedTimeline(loaded, "not-loaded"))
    }

    @Test fun oversizedSearchIsBlocked() {
        assertThrows(IllegalArgumentException::class.java) {
            filterLoadedTimeline(loaded, "q".repeat(129))
        }
    }
}
