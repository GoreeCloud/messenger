package com.goreecloud.messenger

import java.net.URI

/**
 * Explicit HTTPS homeserver origin. URL-based SSRF and hostname policy remain
 * the responsibility of the user's local network and selected homeserver.
 */
object HomeserverPolicy {
    fun requireHttpsOrigin(raw: String): String {
        val uri = try { URI(raw.trim()) } catch (_: Exception) { throw IllegalArgumentException("Invalid homeserver address.") }
        require(uri.scheme.equals("https", ignoreCase = true) &&
            !uri.host.isNullOrBlank() && uri.userInfo == null &&
            uri.query == null && uri.fragment == null &&
            (uri.path.isNullOrEmpty() || uri.path == "/") &&
            uri.port in -1..65535 && uri.port != 0) {
            "Enter an HTTPS homeserver origin without credentials, a path or query."
        }
        return URI("https", null, uri.host, uri.port, null, null, null).toASCIIString()
    }
}
