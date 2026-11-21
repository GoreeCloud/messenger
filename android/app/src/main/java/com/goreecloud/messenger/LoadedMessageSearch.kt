package com.goreecloud.messenger

import java.util.Locale

/**
 * Local-only filtering of the already loaded Matrix timeline snapshot.
 * No network request, external index, token persistence or message upload.
 */
internal fun filterLoadedTimeline(
    loaded: List<TimelineEntry>,
    rawQuery: String,
): List<TimelineEntry> {
    val term = rawQuery.trim().lowercase(Locale.ROOT)
    require(term.length <= 128) { "Search cannot exceed 128 characters." }
    if (term.isEmpty()) return loaded
    return loaded.filter {
        it.body.lowercase(Locale.ROOT).contains(term) ||
            it.sender.lowercase(Locale.ROOT).contains(term)
    }
}
