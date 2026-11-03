package com.goreecloud.messenger;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Temporary local notes for the native Android preview.
 * Never persisted, logged, synchronized, backed up, or sent to a provider.
 * An Activity recreation intentionally creates a new empty collection.
 */
public final class VolatileNotes {
    public static final int MAX_NOTES = 50;
    public static final int MAX_LENGTH = 16000;
    private final ArrayDeque<String> entries = new ArrayDeque<>();

    public void add(String raw) {
        if (raw == null || raw.length() > MAX_LENGTH || raw.trim().isEmpty()) {
            throw new IllegalArgumentException("Enter a note of 1–16,000 characters");
        }
        if (entries.size() >= MAX_NOTES) entries.removeLast();
        entries.addFirst(raw.trim());
    }

    public int count() { return entries.size(); }

    public List<String> snapshot() {
        return Collections.unmodifiableList(new ArrayList<>(entries));
    }

    public void clear() { entries.clear(); }
}
