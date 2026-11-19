package com.goreecloud.messenger

/** Pure checks that run in local JUnit without loading Android Keystore. */
internal object MatrixSessionPolicy {
    fun isValidSession(userId: String, deviceId: String, accessToken: String): Boolean {
        return Regex("^@[^:\\s]{1,255}:[^:\\s]{1,255}$").matches(userId) &&
            userId.length <= 255 &&
            deviceId.length in 1..255 && deviceId.none { it.isWhitespace() || it.isISOControl() } &&
            accessToken.length in 8..8192 &&
            accessToken.none { it.isWhitespace() || it.isISOControl() }
    }
}
