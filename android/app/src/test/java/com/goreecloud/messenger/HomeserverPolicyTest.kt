package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class HomeserverPolicyTest {
    @Test fun acceptsHttpsOrigin() {
        assertEquals("https://matrix.example.org", HomeserverPolicy.requireHttpsOrigin("https://matrix.example.org/"))
        assertEquals("https://matrix.example.org:8448", HomeserverPolicy.requireHttpsOrigin("https://matrix.example.org:8448"))
    }
    @Test fun rejectsUnsafeOrigins() {
        for (url in listOf(
            "http://matrix.example.org", "https://alice:pw@example.org",
            "https://example.org/api", "https://example.org/?token=abc",
            "https://example.org/#fragment", "javascript:alert(1)", "https://example.org:0"
        )) {
            assertThrows(IllegalArgumentException::class.java) { HomeserverPolicy.requireHttpsOrigin(url) }
        }
    }
}
