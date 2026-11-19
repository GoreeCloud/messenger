package com.goreecloud.messenger

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MatrixSessionPolicyTest {
    @Test fun validSessionFields() {
        assertTrue(MatrixSessionPolicy.isValidSession("@alice:matrix.example.org", "DEVICE_01", "1234567890TOKEN"))
    }

    @Test fun missingOrDangerousFieldsFailClosed() {
        assertFalse(MatrixSessionPolicy.isValidSession("alice", "DEVICE", "1234567890TOKEN"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "", "1234567890TOKEN"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "DEVICE\nA", "1234567890TOKEN"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "DEVICE", "token"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "DEVICE", "1234567890 TOKEN"))
    }

    @Test fun oversizedFieldsAreRejected() {
        assertFalse(MatrixSessionPolicy.isValidSession("@" + "a".repeat(260) + ":s", "DEV", "1234567890TOKEN"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "D".repeat(256), "1234567890TOKEN"))
        assertFalse(MatrixSessionPolicy.isValidSession("@a:s", "DEV", "X".repeat(8193)))
    }
}
