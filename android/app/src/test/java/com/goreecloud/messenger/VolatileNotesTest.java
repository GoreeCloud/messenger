package com.goreecloud.messenger;

import org.junit.Test;
import java.util.List;
import static org.junit.Assert.*;

public class VolatileNotesTest {
    @Test public void storesNewestFirstWithoutPersistentState() {
        VolatileNotes notes = new VolatileNotes();
        notes.add("first");
        notes.add(" second ");
        assertEquals(2, notes.count());
        assertEquals(List.of("second", "first"), notes.snapshot());
        assertEquals(0, new VolatileNotes().count());
    }

    @Test public void enforcesEntryAndLengthBounds() {
        VolatileNotes notes = new VolatileNotes();
        for (String invalid : new String[]{ "", "  ", "\n\t", "x".repeat(VolatileNotes.MAX_LENGTH + 1) }) {
            try {
                notes.add(invalid);
                fail("Accepted invalid note");
            } catch (IllegalArgumentException expected) { /* fail closed */ }
        }
        notes.add("x".repeat(VolatileNotes.MAX_LENGTH));
        assertEquals(1, notes.count());
    }

    @Test public void evictsOldestAfterBound() {
        VolatileNotes notes = new VolatileNotes();
        for (int index = 0; index < VolatileNotes.MAX_NOTES + 3; index++) {
            notes.add("note-" + index);
        }
        assertEquals(VolatileNotes.MAX_NOTES, notes.count());
        assertEquals("note-52", notes.snapshot().get(0));
        assertEquals("note-3", notes.snapshot().get(VolatileNotes.MAX_NOTES - 1));
    }

    @Test public void snapshotsCannotMutateLiveStateAndClearWorks() {
        VolatileNotes notes = new VolatileNotes();
        notes.add("one");
        List<String> snapshot = notes.snapshot();
        try {
            snapshot.add("injection");
            fail("Returned a mutable snapshot");
        } catch (UnsupportedOperationException expected) { /* correct */ }
        notes.clear();
        assertEquals(0, notes.count());
        assertEquals(List.of("one"), snapshot);
        assertTrue(notes.snapshot().isEmpty());
    }

    @Test(expected = IllegalArgumentException.class)
    public void nullIsRejected() { new VolatileNotes().add(null); }
}
