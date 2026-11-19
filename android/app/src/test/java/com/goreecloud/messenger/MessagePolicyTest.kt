package com.goreecloud.messenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MessagePolicyTest {
    @Test fun encryptionIsMandatoryBeforeSending() {
        assertThrows(IllegalArgumentException::class.java) {
            MessagePolicy.requireEncryptedMessage("do not leak me", false)
        }
    }

    @Test fun validEncryptedMessageIsTrimmed() {
        assertEquals("private", MessagePolicy.requireEncryptedMessage(" private ", true))
    }

    @Test fun emptyOrOversizedMessagesAreRejected() {
        for (raw in listOf("", "   ", "x".repeat(4001))) {
            assertThrows(IllegalArgumentException::class.java) {
                MessagePolicy.requireEncryptedMessage(raw, true)
            }
        }
    }
}
