package com.goreecloud.messenger

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Rule
import org.junit.Test

/**
 * Synthetic UI checks only. Never submits a username or password and never
 * contacts a homeserver or mutates a real user's Matrix account.
 */
class MessengerOnboardingInstrumentedTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun initialScreenHasSecurityDisclosureAndDisabledLogin() {
        compose.onNodeWithText("Connect to your homeserver").assertExists()
        compose.onNodeWithText("Device keys are encrypted using Android Keystore",
            substring = true).assertExists()
        compose.onNodeWithTag("matrix-sign-in").assertIsNotEnabled()
    }

    @Test fun passwordAloneDoesNotEnableSignIn() {
        compose.onNodeWithTag("matrix-password").performTextInput("synthetic-test-only-password")
        compose.onNodeWithTag("matrix-sign-in").assertIsNotEnabled()
    }

    @Test fun testOnlyFieldsEnableButtonWithoutSubmitting() {
        compose.onNodeWithTag("matrix-username").performTextInput("@synthetic:example.invalid")
        compose.onNodeWithTag("matrix-password").performTextInput("synthetic-test-only-password")
        compose.onNodeWithTag("matrix-sign-in").assertIsEnabled()
    }
}
