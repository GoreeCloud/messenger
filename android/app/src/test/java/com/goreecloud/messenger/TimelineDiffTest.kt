package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import org.matrix.rustcomponents.sdk.NoHandle
import org.matrix.rustcomponents.sdk.TimelineDiff
import org.matrix.rustcomponents.sdk.TimelineItem

/** Synthetic SDK diffs; this does NOT exercise a network or actual E2EE. */
class TimelineDiffTest {
    @Test fun appendInsertReplaceAndRemove() {
        val a = TimelineItem(NoHandle)
        val b = TimelineItem(NoHandle)
        val c = TimelineItem(NoHandle)
        val items = mutableListOf<TimelineItem>()
        applyTimelineDiff(items, listOf(
            TimelineDiff.Append(listOf(a, b)),
            TimelineDiff.Insert(1u, c),
        ))
        assertEquals(3, items.size)
        assertSame(c, items[1])
        applyTimelineDiff(items, listOf(
            TimelineDiff.Set(0u, c),
            TimelineDiff.Remove(2u),
        ))
        assertEquals(2, items.size)
        assertSame(c, items[0])
    }

    @Test fun rejectsOverflowIndicesRatherThanCrashing() {
        val a = TimelineItem(NoHandle)
        val items = mutableListOf(a)
        applyTimelineDiff(items, listOf(
            TimelineDiff.Insert(UInt.MAX_VALUE, a),
            TimelineDiff.Set(UInt.MAX_VALUE, a),
            TimelineDiff.Remove(UInt.MAX_VALUE),
            TimelineDiff.Truncate(UInt.MAX_VALUE),
        ))
        assertEquals(1, items.size)
        assertSame(a, items[0])
    }

    @Test fun resetPopClearAreSafeWhenAlreadyEmpty() {
        val a = TimelineItem(NoHandle)
        val items = mutableListOf<TimelineItem>()
        applyTimelineDiff(items, listOf(
            TimelineDiff.PopBack, TimelineDiff.PopFront,
            TimelineDiff.Reset(listOf(a)),
            TimelineDiff.PopBack, TimelineDiff.Clear,
        ))
        assertEquals(0, items.size)
    }
}
